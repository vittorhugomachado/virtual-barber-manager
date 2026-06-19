/* eslint-disable @typescript-eslint/no-unused-vars */
// buy-pack/index.ts
// ============================================================================
// Compra um pack semestral ou anual como cobranca UNICA (POST /payments).
//
// Chamada PELO DONO logado no manager (verify_jwt = true).
//
// Diferente do create-monthly-subscription:
//   - Usa POST /payments (cobranca avulsa), nao POST /subscriptions.
//   - Nao ha asaas_subscription_id — a barbearia nao tem assinatura recorrente.
//   - Se havia assinatura mensal ativa, ela e cancelada no Asaas.
//   - Apos pagamento confirmado, current_period_end = agora + 6 ou 12 meses.
//   - Renovacao manual: sem auto-renovacao no Asaas.
//
// Renovacao antecipada:
//   - Permitida se current_period_end <= agora + 7 dias.
//   - O novo periodo e calculado a partir do current_period_end atual (se
//     ainda valido) ou do now (se ja expirou), preservando dias restantes.
// ============================================================================

import {
  ALLOWED_BILLING,
  AsaasError,
  AsaasPayment,
  AsaasPixQrCode,
  BillingAddress,
  BillingType,
  CONFIRMING_STATUSES,
  CYCLE_MONTHS,
  CouponInfo,
  CustomerPayload,
  applyCouponDiscount,
  asaasFetch,
  computeNewPeriodEnd,
  corsHeaders,
  createCustomer,
  deleteAsaasSubscription,
  digits,
  dueDateInDays,
  findCustomerByExternalReference,
  getPixQrCode,
  getRemoteIp,
  getSupabaseAdmin,
  getUserClient,
  isValidCpfCnpj,
  parseCardExpiry,
  updateCustomer,
} from "../_shared/asaas.ts";

const PACK_CYCLES = new Set(["SEMIANNUALLY", "YEARLY"]);

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
  installment_count?: number;
  credit_card?: {
    number?: string;
    expiry?: string;
    ccv?: string;
    holder_name?: string;
  };
};

// Cria cobranca unica no Asaas (POST /payments).
// installmentCount > 1 ativa parcelamento no cartao (PIX ignora — sempre 1x).
async function createOneTimePayment(params: {
  customer: string;
  billingType: BillingType;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  holderName: string;
  cpfCnpj: string;
  email: string;
  mobilePhone?: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
  installmentCount?: number;
  creditCard?: {
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    holderName: string;
  };
  remoteIp?: string;
}) {
  const payload: Record<string, unknown> = {
    customer: params.customer,
    billingType: params.billingType,
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
    externalReference: params.externalReference,
  };

  if (params.billingType === "CREDIT_CARD" && params.creditCard) {
    // Parcelamento: so para cartao e quando > 1 parcela.
    const installments =
      params.installmentCount && params.installmentCount > 1
        ? params.installmentCount
        : undefined;
    if (installments) {
      payload.installmentCount = installments;
      payload.installmentValue = parseFloat(
        (params.value / installments).toFixed(2),
      );
    }

    payload.creditCard = {
      holderName: params.creditCard.holderName,
      number: params.creditCard.number,
      expiryMonth: params.creditCard.expiryMonth,
      expiryYear: params.creditCard.expiryYear,
      ccv: params.creditCard.ccv,
    };
    payload.creditCardHolderInfo = {
      name: params.holderName,
      email: params.email,
      cpfCnpj: params.cpfCnpj,
      mobilePhone: params.mobilePhone,
      postalCode: params.postalCode,
      addressNumber: params.addressNumber,
      addressComplement: params.addressComplement,
    };
    payload.remoteIp = params.remoteIp;
  }

  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

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
  // Parcelamento: valido apenas para cartao; ignorado para PIX.
  const installmentCount =
    billingType === "CREDIT_CARD" &&
    typeof body.installment_count === "number" &&
    body.installment_count > 1
      ? Math.floor(body.installment_count)
      : 1;

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
    { p_key: `buy-pack:${userId}`, p_max: 8, p_window_seconds: 60 },
  );
  if (rateLimitError)
    console.error("Erro no rate limit:", rateLimitError.message);
  else if (!allowed) {
    return json(429, {
      error: "rate_limited",
      message: "Muitas tentativas. Aguarde um instante e tente novamente.",
    });
  }

  let packPaymentCreated = false;
  let claimedSubId: string | null = null;

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

    // Esta funcao so processa packs semestrais e anuais.
    if (!PACK_CYCLES.has(plan.asaas_cycle))
      return json(400, { error: "plan_not_pack" });

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

    // Bloqueia se ativo com mais de 7 dias restantes.
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

    // Se havia assinatura mensal recorrente, cancela no Asaas.
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

    // Cria a cobranca unica.
    const finalPriceCents = coupon
      ? applyCouponDiscount(plan.price_cents, coupon)
      : plan.price_cents;

    const payment = await createOneTimePayment({
      customer: customerId,
      billingType,
      value: finalPriceCents / 100,
      dueDate: dueDateInDays(0),
      description: `Virtual Barber - ${plan.name}`,
      externalReference: barbershopId,
      holderName,
      cpfCnpj,
      email,
      mobilePhone,
      postalCode,
      addressNumber,
      addressComplement,
      installmentCount,
      creditCard,
      remoteIp,
    });

    // Persiste o pagamento na tabela payments.
    await supabase.from("payments").insert({
      subscription_id: sub.id,
      asaas_payment_id: payment.id,
      amount_cents: finalPriceCents,
      billing_type: billingType,
      status: payment.status ?? "PENDING",
      due_date: payment.dueDate ?? null,
    });

    if (coupon) {
      await supabase
        .from("coupons")
        .update({ uses_count: coupon.uses_count + 1 })
        .eq("id", coupon.id);
    }

    // Atualiza plan_id e limpa o lock. Status e period_end dependem da confirmacao.
    const months = CYCLE_MONTHS[plan.asaas_cycle] ?? 6;
    const isConfirmed = CONFIRMING_STATUSES.has(payment.status ?? "");
    const newPeriodEnd = isConfirmed
      ? computeNewPeriodEnd(sub.current_period_end, months)
      : null;

    const { data: updatedRows, error: updateError } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        asaas_subscription_id: null, // pack nao tem assinatura recorrente
        provisioning_started_at: null,
        ...(isConfirmed
          ? {
              status: "active",
              current_period_end: newPeriodEnd!.toISOString(),
            }
          : { status: "incomplete" }),
      })
      .eq("id", sub.id)
      .select("id");

    if (updateError) throw updateError;
    if (!updatedRows?.length) throw new Error("db_update_zero_rows");

    packPaymentCreated = true;

    // PIX: busca QR code para exibir na interface.
    let pix: AsaasPixQrCode | null = null;
    if (billingType === "PIX" && !isConfirmed) {
      try {
        const qr = await getPixQrCode(payment.id);
        if (qr?.payload) {
          pix = {
            encodedImage: qr.encodedImage,
            payload: qr.payload,
            expirationDate: qr.expirationDate,
          };
        }
      } catch (_e) {
        /* webhook entrega quando confirmado */
      }
    }

    return json(200, {
      ok: true,
      billing_type: billingType,
      ...(pix ? { pix } : {}),
      ...(isConfirmed ? { status: "active" } : {}),
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
    if (claimedSubId && !packPaymentCreated) {
      await supabase
        .from("subscriptions")
        .update({ provisioning_started_at: null })
        .eq("id", claimedSubId);
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

    console.error("Erro inesperado em buy-pack:", error);
    return json(500, { error: "internal_error" });
  }
});
