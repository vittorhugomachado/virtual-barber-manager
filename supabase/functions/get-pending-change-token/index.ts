// =============================================================================
// Edge Function: get-pending-change-token
//
// Retorna o userId e o signup_change_token de uma conta AINDA NÃO CONFIRMADA,
// permitindo que o usuário corrija o email pelo fluxo de login (não só pelo
// fluxo de cadastro, onde o token já está no sessionStorage).
//
// Segurança:
//   A verificação de senha usa o cliente ANON (não service_role), para que o
//   GoTrue aplique normalmente captcha e rate limit por email. Isso impede que
//   esta função seja usada como proxy de força-bruta sem captcha.
//
// Fluxo:
//   1. Valida inputs (email, password).
//   2. Chama signInWithPassword com chave ANON + captchaToken do browser.
//      - 200 (conta confirmada)  → fail("already_confirmed") + revoga sessão.
//      - 400 "Email not confirmed" → credenciais válidas, prossegue.
//      - 400 outro               → fail("invalid_credentials").
//   3. Busca o usuário por email via GoTrue admin endpoint.
//   4. Confirma que a conta está realmente não-confirmada (defensivo).
//   5. Lê o signup_change_token do user_metadata e devolve junto com o userId.
//
// Contrato de resposta (casado com src/lib/supabase/auth/get-pending-change-token.ts):
//   sucesso    -> 200 { userId: "<uuid>", changeToken: "<uuid>" }
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

function fail(code: string): Response {
  return json({ error: code });
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return json({ error: "invalid_input" }, 400);

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const captchaToken =
      typeof body.captchaToken === "string" ? body.captchaToken : undefined;

    if (!isEmail(email) || !password) return fail("invalid_input");

    // 1. Verifica credenciais com chave ANON ---------------------------------
    //
    // NÃO usa service_role aqui: o ANON preserva a verificação de captcha e o
    // rate limit por email do GoTrue. Usar service_role contornaria essas
    // proteções e transformaria esta função em um proxy de força-bruta.
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInErr } =
      await anon.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : {},
      });

    if (!signInErr) {
      // Credenciais válidas E conta confirmada — não é o fluxo de pendência.
      // Revoga a sessão criada acidentalmente (best-effort).
      if (signInData?.session) {
        await anon.auth.signOut().catch(() => {});
      }
      return fail("already_confirmed");
    }

    const errMsg = signInErr.message?.toLowerCase() ?? "";
    const isNotConfirmed =
      errMsg.includes("email not confirmed") ||
      errMsg.includes("not confirmed");

    if (!isNotConfirmed) {
      return fail("invalid_credentials");
    }

    // 2. Busca o usuário por email via admin ----------------------------------
    //
    // O filter do GoTrue faz busca textual; filtramos client-side para garantir
    // correspondência exata, mesmo que versões mais antigas retornem mais linhas.
    const searchRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=20`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
      },
    );

    type GoTrueUser = {
      id?: string;
      email?: string;
      email_confirmed_at?: string | null;
      user_metadata?: Record<string, unknown>;
    };

    const searchData = (await searchRes.json().catch(() => ({}))) as {
      users?: GoTrueUser[];
    };

    const user = Array.isArray(searchData?.users)
      ? searchData.users.find(
          (u) => typeof u.email === "string" && u.email.toLowerCase() === email,
        )
      : null;

    if (!user?.id) return fail("user_not_found");

    // 3. Defensivo: só retorna token para contas realmente não-confirmadas ----
    if (user.email_confirmed_at) return fail("already_confirmed");

    const changeToken = user.user_metadata?.["signup_change_token"];
    if (typeof changeToken !== "string" || !changeToken) {
      return fail("no_token_available");
    }

    return json({ userId: user.id, changeToken });
  } catch (err) {
    console.error("get-pending-change-token erro inesperado:", err);
    return json({ error: "internal_error" }, 500);
  }
});
