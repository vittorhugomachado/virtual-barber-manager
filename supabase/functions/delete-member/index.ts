// ============================================================================
// EDGE FUNCTION: delete-member
// ============================================================================
// Remove completamente um membro, inclusive sua identidade no Supabase Auth.
//
// Body:
//   { member_id }
//
// IMPORTANTE: member_id e barbershop_members.id, nao o user_id do Auth.
//
// Fluxo:
//   1. Valida o Bearer token.
//   2. Busca o membro e confirma que o chamador e owner da barbearia.
//   3. Exclui o auth.users correspondente usando a Admin API.
//   4. As FKs ON DELETE CASCADE removem profiles e barbershop_members.
//
// Pre-requisito:
//   profiles.id -> auth.users.id e barbershop_members.user_id -> profiles.id
//   precisam estar configuradas com ON DELETE CASCADE.
// ============================================================================

// Arquivo autocontido para colar diretamente no editor manual do Dashboard.
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type OwnedMember = { id: string; user_id: string };

class MemberFunctionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const allowOrigin =
    allowed.length === 0
      ? "*"
      : origin && allowed.includes(origin)
        ? origin
        : "";
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function handleError(req: Request, error: unknown): Response {
  return error instanceof MemberFunctionError
    ? json(req, { error: error.code }, error.status)
    : json(req, { error: "internal_error" }, 500);
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    throw new MemberFunctionError("server_misconfigured", 500);
  }
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// A funcao fica com verify_jwt=false somente para liberar o OPTIONS. Todo POST
// precisa passar por auth.getUser e por autorizacao de owner abaixo.
async function authenticate(admin: SupabaseClient, req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new MemberFunctionError("missing_authorization", 401);
  }
  const { data, error } = await admin.auth.getUser(header.slice(7).trim());
  if (error || !data.user) {
    throw new MemberFunctionError("invalid_token", 401);
  }
  return data.user.id;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MemberFunctionError("invalid_body", 400);
  }
  return body as Record<string, unknown>;
}

async function getOwnedMember(
  admin: SupabaseClient,
  ownerId: string,
  memberId: unknown,
): Promise<OwnedMember> {
  if (
    typeof memberId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      memberId,
    )
  ) {
    throw new MemberFunctionError("invalid_member_id", 400);
  }
  const { data, error } = await admin
    .from("barbershop_members")
    .select("id, user_id, barbershops!inner(owner_id)")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new MemberFunctionError("internal_error", 500);
  if (!data) throw new MemberFunctionError("member_not_found", 404);

  const shop = Array.isArray(data.barbershops)
    ? data.barbershops[0]
    : data.barbershops;
  if (!shop || shop.owner_id !== ownerId) {
    throw new MemberFunctionError("not_barbershop_owner", 403);
  }
  return { id: data.id, user_id: data.user_id };
}

Deno.serve(async (req: Request) => {
  // Responde ao preflight sem acessar Auth ou banco.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST")
    return json(req, { error: "method_not_allowed" }, 405);

  try {
    const admin = createAdminClient();
    const ownerId = await authenticate(admin, req);
    const body = await parseBody(req);
    // A autorizacao usa a relacao membro -> barbearia -> owner no servidor.
    const member = await getOwnedMember(admin, ownerId, body.member_id);

    // A exclusao do Auth user e a raiz do cascade relacional.
    const { error } = await admin.auth.admin.deleteUser(member.user_id);
    if (error) {
      throw new MemberFunctionError("failed_to_delete_member", 500);
    }

    return json(req, { success: true, member_id: member.id });
  } catch (error) {
    return handleError(req, error);
  }
});
