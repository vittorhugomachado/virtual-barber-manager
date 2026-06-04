// =============================================================================
// Edge Function: correct-pending-email
//
// Corrige o email de um cadastro AINDA NÃO CONFIRMADO (usuário sem sessão).
//
// Por que existe:
//   Se o usuário digita o email errado no cadastro, ele nunca recebe o link de
//   confirmação e fica "preso": o celular dele já está ocupado pela conta com
//   email errado, então um novo cadastro falha em check_phone_exists. Como ele
//   não tem sessão (nunca confirmou), supabase.auth.updateUser() do client não
//   funciona. A troca só é possível via Admin API (service_role), aqui dentro.
//
// Autorização SEM sessão:
//   O cadastro gera um signup_change_token (UUID) e o guarda no user_metadata
//   e no sessionStorage do navegador. Esta função só autoriza a troca se o
//   token enviado bater com o do metadata. Após a troca, o token é rotacionado
//   e devolvido, para uso único.
//
// Fluxo:
//   1. Valida inputs (userId, changeToken, newEmail).
//   2. Busca o usuário (admin).
//   3. Recusa se a conta já estiver confirmada (não é caminho de troca de
//      email de conta ativa — isso é o fluxo autenticado de configurações).
//   4. Confere o signup_change_token.
//   5. Recusa email igual ao atual e email já em uso.
//   6. updateUserById -> novo email, email_confirm: false, token rotacionado.
//   7. Devolve o novo token. O ENVIO do email de confirmação fica a cargo do
//      front (resend com captcha), pois o projeto exige Turnstile no GoTrue.
//
// Contrato de resposta (casado com src/lib/supabase/auth/correct-pending-email.ts):
//   sucesso    -> 200 { newChangeToken: "<uuid>" }
//   negócio    -> 200 { error: "<codigo>" }
//   inesperado -> 4xx/5xx { error: "internal_error" }
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Erros de negócio: 200 + { error } para casar com o contrato do front.
function fail(code: string): Response {
  return json({ error: code }, 200);
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

// Validação de email pragmática (a confirmação real é o próprio link).
function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "internal_error" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente service_role: bypassa RLS e acessa a Admin API.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Body + validação -----------------------------------------------------
    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return json({ error: "internal_error" }, 400);

    const userId = body.userId;
    const changeToken = body.changeToken;
    const newEmail =
      typeof body.newEmail === "string"
        ? body.newEmail.trim().toLowerCase()
        : "";

    if (!isUuid(userId)) return fail("invalid_input");
    if (!isUuid(changeToken)) return fail("invalid_token");
    if (!isEmail(newEmail)) return fail("invalid_email");

    // 2. Busca o usuário -------------------------------------------------------
    const { data: userRes, error: getErr } =
      await admin.auth.admin.getUserById(userId);
    if (getErr || !userRes?.user) return fail("user_not_found");

    const user = userRes.user;

    // 3. Só corrige conta AINDA NÃO confirmada --------------------------------
    if (user.email_confirmed_at) return fail("already_confirmed");

    // 4. Autorização via token (sem sessão) -----------------------------------
    const storedToken = (user.user_metadata ?? {})["signup_change_token"];
    if (!isUuid(storedToken) || storedToken !== changeToken) {
      return fail("invalid_token");
    }

    // 5. Recusa email igual e pré-filtra email já em uso ----------------------
    if (user.email?.toLowerCase() === newEmail) return fail("same_email");

    // Pré-filtro best-effort. ATENÇÃO: check_email_exists costuma olhar só
    // dados de contas confirmadas (ex.: profiles), então NÃO enxerga cadastros
    // pendentes. A validação autoritativa de disponibilidade é a unique
    // constraint de auth.users, tratada no erro do updateUserById abaixo.
    const { data: emailExists, error: existsErr } = await admin.rpc(
      "check_email_exists",
      { p_email: newEmail },
    );
    if (existsErr) return json({ error: "internal_error" }, 500);
    if (emailExists) return fail("email_already_exists");

    // 6. Atualiza email + rotaciona o token -----------------------------------
    const newChangeToken = crypto.randomUUID();

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: false,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        signup_change_token: newChangeToken,
      },
    });
    if (updateErr) {
      // auth.users tem unique constraint no email — é a checagem AUTORITATIVA
      // de disponibilidade e pega até cadastros pendentes que o pré-filtro
      // acima não vê. Mapeia o conflito para o código de email já em uso.
      const code = (updateErr as { code?: string }).code ?? "";
      const msg = updateErr.message?.toLowerCase() ?? "";
      const isDuplicate =
        code === "email_exists" ||
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already in use") ||
        msg.includes("duplicate");
      return fail(isDuplicate ? "email_already_exists" : "failed_to_update");
    }

    // O envio do email de confirmação fica no front (resend com captcha).
    return json({ newChangeToken }, 200);
  } catch (error) {
    return json({ error: "internal_error", error }, 500);
  }
});
