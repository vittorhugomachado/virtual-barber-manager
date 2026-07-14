// ============================================================================
// EDGE FUNCTION: update-member
// ============================================================================
// Atualiza username, senha e/ou perfil de acesso de um membro.
//
// Body:
//   { member_id, username?, password?, role? }
//
// IMPORTANTE: member_id e barbershop_members.id, nao o user_id do Auth.
//
// Fluxo:
//   1. Valida JWT e confirma que o membro pertence ao owner autenticado.
//   2. Valida apenas os campos realmente enviados.
//   3. Atualiza profile + barbershop_members pela RPC transacional.
//   4. Atualiza e-mail interno e/ou senha pela Admin API do Auth.
//   5. Se o Auth falhar, restaura username e role anteriores no banco.
//
// A compensacao reduz o risco de divergencia entre Auth e tabelas publicas.
// O codigo update_inconsistent indica que a compensacao tambem falhou e deve
// ser investigado antes de repetir a operacao.
// ============================================================================

// Arquivo autocontido para colar diretamente no editor manual do Dashboard.
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type MemberRole = "admin" | "reader";
type OwnedMember = {
  id: string;
  user_id: string;
  barbershop_id: string;
  username: string;
  role: MemberRole;
};

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

function normalizeUsername(value: unknown): string {
  const username = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    throw new MemberFunctionError("invalid_username", 400);
  }
  return username;
}

function parsePassword(value: unknown): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 72) {
    throw new MemberFunctionError("invalid_password", 400);
  }
  return password;
}

function parseRole(value: unknown): MemberRole {
  if (value !== "admin" && value !== "reader") {
    throw new MemberFunctionError("invalid_role", 400);
  }
  return value;
}

// Busca o membro e o owner em uma consulta. A checagem explicita e obrigatoria
// porque o cliente service_role ignora as policies RLS.
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
    .select(
      "id, user_id, barbershop_id, username, role, barbershops!inner(owner_id)",
    )
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
  return {
    id: data.id,
    user_id: data.user_id,
    barbershop_id: data.barbershop_id,
    username: data.username,
    role: data.role as MemberRole,
  };
}

function getRpcErrorCode(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  const codes = [
    "member_not_found",
    "username_already_exists",
    "invalid_username",
    "invalid_role",
  ];
  return codes.find(code => message.includes(code)) ?? "internal_error";
}

Deno.serve(async (req: Request) => {
  // O OPTIONS nao possui Bearer token; somente prepara o POST no navegador.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST")
    return json(req, { error: "method_not_allowed" }, 405);

  try {
    const admin = createAdminClient();
    const ownerId = await authenticate(admin, req);
    const body = await parseBody(req);
    // Consulta membro + barbearia e autoriza usando o owner do banco.
    const member = await getOwnedMember(admin, ownerId, body.member_id);

    // Diferencia campo ausente de campo enviado explicitamente.
    const hasUsername = Object.hasOwn(body, "username");
    const hasPassword = Object.hasOwn(body, "password");
    const hasRole = Object.hasOwn(body, "role");
    if (!hasUsername && !hasPassword && !hasRole) {
      throw new MemberFunctionError("no_changes", 400);
    }

    const username = hasUsername ? normalizeUsername(body.username) : null;
    const password = hasPassword ? parsePassword(body.password) : null;
    const role = hasRole ? parseRole(body.role) : null;
    const usernameChanged = username !== null && username !== member.username;
    const roleChanged = role !== null && role !== member.role;

    // Mantem profile e barbershop_members na mesma transacao SQL.
    if (usernameChanged || roleChanged) {
      const { error } = await admin.rpc("update_barbershop_member_record", {
        p_owner_id: ownerId,
        p_member_id: member.id,
        p_username: usernameChanged ? username : null,
        p_role: roleChanged ? role : null,
      });
      if (error) {
        const code = getRpcErrorCode(error);
        throw new MemberFunctionError(
          code,
          code === "username_already_exists" ? 409 : 400,
        );
      }
    }

    // E-mail e senha somente podem ser alterados pela Admin API no servidor.
    if (usernameChanged || password) {
      const { error: authError } = await admin.auth.admin.updateUserById(
        member.user_id,
        {
          ...(usernameChanged
            ? {
                email: `${username}@${member.barbershop_id}.member`,
                email_confirm: true,
              }
            : {}),
          ...(password ? { password } : {}),
        },
      );

      if (authError) {
        // A parte SQL ja ocorreu; tenta restaura-la se o Auth rejeitar.
        if (usernameChanged || roleChanged) {
          const { error: rollbackError } = await admin.rpc(
            "update_barbershop_member_record",
            {
              p_owner_id: ownerId,
              p_member_id: member.id,
              p_username: usernameChanged ? member.username : null,
              p_role: roleChanged ? member.role : null,
            },
          );
          if (rollbackError) {
            // Falha critica e rara: banco e Auth podem estar divergentes.
            throw new MemberFunctionError("update_inconsistent", 500);
          }
        }
        throw new MemberFunctionError("failed_to_update_auth_user", 500);
      }
    }

    return json(req, {
      success: true,
      member: {
        id: member.id,
        user_id: member.user_id,
        username: usernameChanged ? username : member.username,
        role: roleChanged ? role : member.role,
      },
    });
  } catch (error) {
    return handleError(req, error);
  }
});
