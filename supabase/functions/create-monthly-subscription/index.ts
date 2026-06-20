/* eslint-disable @typescript-eslint/no-unused-vars */
// create-monthly-subscription/index.ts
// ============================================================================
// Converte um trial em assinatura MENSAL recorrente (checkout transparente).
//
// Chamada PELO DONO logado no manager (verify_jwt = true).
//
// Fluxo:
//   1. Autentica o usuario (JWT do Supabase).
//   2. Valida que ele e DONO da barbershop.
//   3. Le o plano do banco — deve ser MONTHLY. Preco/ciclo nunca vem do request.
//   4. Cria/reusa customer no Asaas.
//   5. Cria a assinatura recorrente no Asaas.
//      - CREDIT_CARD: envia creditCard + creditCardHolderInfo.
//      - PIX: cria assinatura e devolve o QR code da primeira cobranca.
//   6. Grava IDs no banco. Se houver cobranca pendente, cancela e recria.
//   7. Devolve pix quando existir, ou status:'active' se confirmado na hora.
//
// Renovacao antecipada:
//   - Permitida se current_period_end <= agora + 7 dias.
//   - O novo periodo e calculado a partir do current_period_end atual (se
//     ainda valido) ou do now (se ja expirou), preservando dias restantes.
//
// Seguranca:
//   - Nunca salva numero do cartao nem CVV.
//   - Escrita via service_role.
//   - Customer/assinatura usam externalReference = barbershopId para idempotencia.
// ============================================================================

import {
  ALLOWED_BILLING,
  AsaasError,
  BillingType,
  BillingAddress,
  CONFIRMING_STATUSES,
  CYCLE_MONTHS,
  CouponInfo,
  CustomerPayload,
  AsaasPixQrCode,
  applyCouponDiscount,
  computeNewPeriodEnd,
  corsHeaders,
  createCustomer,
  createSubscription,
  deleteAsaasSubscription,
  digits,
  dueDateInDays,
  findCustomerByExternalReference,
  findSubscriptionByExternalReference,
  getPixQrCode,
  getRemoteIp,
  getSupabaseAdmin,
  getUserClient,
  isValidCpfCnpj,
  listSubscriptionPayments,
  parseCardExpiry,
  pickOldestUnpaidPayment,
  updateCustomer,
} from "../_shared/asaas.ts";

type RequestBody = {
  barbershop_id?: string;
  plan_id?: string;
  billing_type?: BillingType;
  holder_name?: string;
  company_name?: string;
  cpf_cnpj?: string;
  email?: string;
  mobile_phone?: string;
  coupon_code?: string;
  credit_card?: {
    number?: string;
    expiry?: string;
    ccv?: string;
    holder_name?: string;
  };
};

Deno.serve(async req => {
  const cors = corsHeaders(req);
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });

  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "missing_authorization" });

  const userClient = getUserClient(authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user)
    return json(401, { error: "invalid_token" });

  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const barbershopId = body.barbershop_id;
  const planId = body.plan_id;
  const billingType = body.billing_type ?? "CREDIT_CARD";
  const holderName = body.holder_name?.trim();
  const companyName = body.company_name?.trim();
  const cpfCnpj = digits(body.cpf_cnpj);
  const email = body.email?.trim();
  const mobilePhone = digits(body.mobile_phone) || undefined;
  const couponCode = body.coupon_code?.trim().toUpperCase() || undefined;
  const remoteIp = getRemoteIp(req);

  if (!barbershopId || !planId)
    return json(400, { error: "missing_barbershop_id_or_plan_id" });
  if (!ALLOWED_BILLING.has(billingType as BillingType))
    return json(400, { error: "invalid_billing_type" });
  if (!holderName) return json(400, { error: "missing_holder_name" });
  if (!email) return json(400, { error: "missing_email" });
  if (!isValidCpfCnpj(cpfCnpj)) return json(400, { error: "invalid_cpf_cnpj" });

  const expiry = parseCardExpiry(body.credit_card?.expiry);
  const creditCard =
    billingType === "CREDIT_CARD"
      ? {
          number: digits(body.credit_card?.number),
          ccv: digits(body.credit_card?.ccv),
          holderName: body.credit_card?.holder_name?.trim() || holderName,
          expiryMonth: expiry?.expiryMonth ?? "",
          expiryYear: expiry?.expiryYear ?? "",
        }
      : undefined;

  if (billingType === "CREDIT_CARD") {
    if (!remoteIp) return json(400, { error: "missing_remote_ip" });
    if (!creditCard || creditCard.number.length < 13)
      return json(400, { error: "missing_credit_card_number" });
    if (!expiry) return json(400, { error: "invalid_credit_card_expiry" });
    if (creditCard.ccv.length < 3)
      return json(400, { error: "missing_credit_card_ccv" });
  }

  const supabase = getSupabaseAdmin();

  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    "asaas_rate_limit_hit",
    { p_key: `create-sub:${userId}`, p_max: 8, p_window_seconds: 60 },
  );
  if (rateLimitError)
    console.error("Erro no rate limit:", rateLimitError.message);
  else if (!allowed) {
    return json(429, {
      error: "rate_limited",
      message: "Muitas tentativas. Aguarde um instante e tente novamente.",
    });
  }

  let subscriptionCreated = false;
  let claimedSubId: string | null = null;
  let reservedCouponId: string | null = null;

  try {
    const { data: barbershop, error: barbershopError } = await supabase
      .from("barbershops")
      .select("id, name, owner_id")
      .eq("id", barbershopId)
      .maybeSingle();

    if (barbershopError) throw barbershopError;
    if (!barbershop || barbershop.owner_id !== userId)
      return json(403, { error: "not_barbershop_owner" });

    const { data: billingAddress, error: addressError } = await supabase
      .from("addresses")
      .select("zip_code, street, number, complement, neighborhood")
      .eq("barbershop_id", barbershopId)
      .maybeSingle();
    if (addressError) throw addressError;

    const address = billingAddress as BillingAddress | null;
    const postalCode = digits(address?.zip_code) || undefined;
    const addressStreet = address?.street?.trim();
    const addressNumber = address?.number?.trim();
    const addressComplement = address?.complement?.trim();
    const province = address?.neighborhood?.trim();

    if (billingType === "CREDIT_CARD") {
      if (!address) return json(400, { error: "missing_billing_address" });
      if (!postalCode || postalCode.length !== 8)
        return json(400, { error: "missing_postal_code" });
      if (!addressNumber) return json(400, { error: "missing_address_number" });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, price_cents, asaas_cycle, is_active")
      .eq("id", planId)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan || !plan.is_active)
      return json(400, { error: "invalid_or_inactive_plan" });

    // Esta função só processa planos mensais.
    if (plan.asaas_cycle !== "MONTHLY")
      return json(400, { error: "plan_not_monthly" });

    // Validação do cupom (opcional).
    let coupon: CouponInfo | null = null;
    if (couponCode) {
      const { data: couponRow, error: couponError } = await supabase
        .from("coupons")
        .select(
          "id, discount_type, discount_value, description, uses_count, max_uses, expires_at",
        )
        .eq("is_active", true)
        .ilike("code", couponCode)
        .maybeSingle();
      if (couponError) throw couponError;
      if (!couponRow) return json(422, { error: "invalid_coupon" });
      if (couponRow.expires_at && new Date(couponRow.expires_at) <= new Date())
        return json(422, { error: "coupon_expired" });
      if (
        couponRow.max_uses !== null &&
        couponRow.uses_count >= couponRow.max_uses
      )
        return json(422, { error: "coupon_exhausted" });
      coupon = couponRow as CouponInfo;
    }

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select(
        "id, status, current_period_end, asaas_customer_id, asaas_subscription_id",
      )
      .eq("barbershop_id", barbershopId)
      .maybeSingle();
    if (subError) throw subError;
    if (!sub) return json(409, { error: "no_subscription_row" });

    // Bloqueia renovação se ativo com mais de 7 dias restantes.
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);
    const canRenew =
      !sub.current_period_end ||
      new Date(sub.current_period_end) <= sevenDaysFromNow;
    if (sub.status === "active" && !canRenew) {
      return json(409, { error: "subscription_already_active" });
    }

    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_subscription_provisioning",
      { p_id: sub.id },
    );
    if (claimError) throw claimError;
    if (!claimed) return json(409, { error: "provisioning_in_progress" });
    claimedSubId = sub.id;

    // Cancela assinatura pendente anterior para criar uma nova.
    let mustCreateFresh = false;
    if (sub.asaas_subscription_id) {
      try {
        await deleteAsaasSubscription(sub.asaas_subscription_id);
      } catch (cancelError) {
        if (!(cancelError instanceof AsaasError) || cancelError.status !== 404)
          throw cancelError;
      }
      const { error: clearError } = await supabase
        .from("subscriptions")
        .update({ asaas_subscription_id: null })
        .eq("id", sub.id);
      if (clearError) throw clearError;
      sub.asaas_subscription_id = null;
      mustCreateFresh = true;
    }

    const customerPayload: CustomerPayload = {
      name: holderName,
      companyName,
      cpfCnpj,
      email,
      mobilePhone,
      postalCode,
      address: addressStreet,
      addressNumber,
      complement: addressComplement,
      province,
      externalReference: barbershopId,
    };

    let customerId = sub.asaas_customer_id;
    if (!customerId) {
      const existing = await findCustomerByExternalReference(barbershopId);
      customerId = existing
        ? existing.id
        : (await createCustomer(customerPayload)).id;
      const { error: customerUpdateError } = await supabase
        .from("subscriptions")
        .update({ asaas_customer_id: customerId })
        .eq("id", sub.id);
      if (customerUpdateError) throw customerUpdateError;
    }
    await updateCustomer(customerId, customerPayload);

    let subscription = mustCreateFresh
      ? null
      : await findSubscriptionByExternalReference(barbershopId);

    // Com cupom, sempre cria assinatura nova no Asaas para garantir o valor
    // descontado — nunca reaproveita uma existente com preço errado.
    if (subscription && coupon) {
      try {
        await deleteAsaasSubscription(subscription.id);
      } catch (e) {
        if (!(e instanceof AsaasError) || (e as AsaasError).status !== 404)
          throw e;
      }
      subscription = null;
    }

    if (!subscription) {
      const finalPriceCents = coupon
        ? applyCouponDiscount(plan.price_cents, coupon)
        : plan.price_cents;

      // Reserva ATÔMICA do cupom antes de criar a cobrança no Asaas.
      // increment_coupon_usage faz o incremento com guarda max_uses numa única
      // operação, evitando estourar o limite por concorrência. Se a criação
      // falhar adiante, o catch faz o decrement (release).
      if (coupon) {
        const { data: reserved, error: reserveError } = await supabase.rpc(
          "increment_coupon_usage",
          { p_coupon_id: coupon.id },
        );
        if (reserveError) throw reserveError;
        if (!reserved) {
          await supabase
            .from("subscriptions")
            .update({ provisioning_started_at: null })
            .eq("id", sub.id);
          return json(422, { error: "coupon_exhausted" });
        }
        reservedCouponId = coupon.id;
      }

      subscription = await createSubscription({
        customer: customerId,
        billingType,
        value: finalPriceCents / 100,
        cycle: plan.asaas_cycle,
        nextDueDate: dueDateInDays(0),
        description: `Virtual Barber - ${plan.name}`,
        externalReference: barbershopId,
        holderName,
        cpfCnpj,
        email,
        mobilePhone,
        postalCode,
        addressNumber,
        addressComplement,
        creditCard,
        remoteIp,
      });
    }

    const asaasSubscriptionId = subscription.id;

    // #9: grava o fim PRESERVANDO os dias restantes. Se o pagamento for PIX
    // (confirma depois), o webhook usa este valor ao ativar, em vez de ancorar
    // só no dueDate (que perderia os dias). NÃO libera acesso — é só uma dica.
    const months = CYCLE_MONTHS[plan.asaas_cycle] ?? 1;
    const pendingPeriodEnd = computeNewPeriodEnd(
      sub.current_period_end,
      months,
    ).toISOString();

    const { data: updatedRows, error: updateError } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        asaas_subscription_id: asaasSubscriptionId,
        provisioning_started_at: null,
        pending_period_end: pendingPeriodEnd,
      })
      .eq("id", sub.id)
      .select("id");
    if (updateError) throw updateError;
    if (!updatedRows?.length) throw new Error("db_update_zero_rows");

    subscriptionCreated = true;

    let activatedDirectly = false;
    let pix: AsaasPixQrCode | null = null;
    try {
      const payments = await listSubscriptionPayments(asaasSubscriptionId);
      const list = payments.data ?? [];
      const unpaid = pickOldestUnpaidPayment(list);

      if (billingType === "PIX" && unpaid?.id) {
        try {
          const qr = await getPixQrCode(unpaid.id);
          if (qr?.payload)
            pix = {
              encodedImage: qr.encodedImage,
              payload: qr.payload,
              expirationDate: qr.expirationDate,
            };
        } catch (_e) {
          /* sem QR agora; webhook entrega depois */
        }
      }

      const confirmedPayment = list.find(p =>
        CONFIRMING_STATUSES.has(p.status ?? ""),
      );
      if (confirmedPayment) {
        // reusa `months`/`pendingPeriodEnd` já calculados acima
        const { error: activateError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: pendingPeriodEnd,
            pending_period_end: null, // consumido na ativação direta
          })
          .eq("id", sub.id);
        if (!activateError) activatedDirectly = true;
      }
    } catch (_error) {
      /* webhook PAYMENT_CONFIRMED ainda pode ativar depois */
    }

    return json(200, {
      ok: true,
      billing_type: billingType,
      asaas_subscription_id: asaasSubscriptionId,
      ...(pix ? { pix } : {}),
      ...(activatedDirectly ? { status: "active" } : {}),
      ...(coupon
        ? {
            coupon_applied: {
              discount_type: coupon.discount_type,
              discount_value: coupon.discount_value,
              description: coupon.description,
            },
          }
        : {}),
    });
  } catch (error) {
    if (claimedSubId && !subscriptionCreated) {
      await supabase
        .from("subscriptions")
        .update({ provisioning_started_at: null })
        .eq("id", claimedSubId);
    }

    // Cobrança não concluiu após reservar o cupom: libera a reserva.
    if (reservedCouponId && !subscriptionCreated) {
      await supabase.rpc("decrement_coupon_usage", {
        p_coupon_id: reservedCouponId,
      });
    }

    if (error instanceof AsaasError) {
      console.error("AsaasError:", error.status, error.code, error.message);
      return json(422, {
        error: "asaas_error",
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    console.error("Erro inesperado em create-monthly-subscription:", error);
    return json(500, { error: "internal_error" });
  }
});
