// ============================================================================
// EDGE FUNCTION: create-member
// ============================================================================
// Cria um novo acesso de membro usando a Admin API do Supabase Auth.
//
// Body:
//   { username, password, role, barbershop_id }
//   - username: 3 a 30 caracteres (a-z, 0-9 e underscore)
//   - password: 8 a 72 caracteres
//   - role: "admin" ou "reader"
//   - barbershop_id: UUID da barbearia
//
// Fluxo:
//   1. Valida o Bearer token e identifica o usuario pelo JWT.
//   2. Valida todos os campos recebidos.
//   3. Confirma que o chamador e owner da barbearia.
//   4. Cria o usuario no Auth com um e-mail interno sintetico.
//   5. A RPC register_barbershop_member grava profile + membro atomicamente.
//   6. Se a RPC falhar, remove o Auth user criado para nao deixar orfao.
//
// Seguranca:
//   A service_role existe somente no ambiente da Edge Function. Nunca deve ser
//   enviada pelo frontend nem salva em variaveis VITE_*.
// ============================================================================

// Este arquivo e autocontido para poder ser colado diretamente no editor
// manual de Edge Functions do Dashboard, que nao inclui arquivos ../_shared.
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type MemberRole = "admin" | "reader";

class MemberFunctionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

// Monta os headers de CORS. Em producao, ALLOWED_ORIGINS deve conter somente
// os dominios confiaveis, separados por virgula.
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

// Nao envia detalhes inesperados do banco ou do Auth para o navegador.
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

// verify_jwt=false libera o OPTIONS no gateway; o POST e protegido aqui.
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
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

async function assertBarbershopOwner(
  admin: SupabaseClient,
  ownerId: string,
  barbershopId: string,
) {
  const { data, error } = await admin
    .from("barbershops")
    .select("id")
    .eq("id", barbershopId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new MemberFunctionError("internal_error", 500);
  if (!data) throw new MemberFunctionError("not_barbershop_owner", 403);
}

function getRpcErrorCode(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  const codes = [
    "not_barbershop_owner",
    "member_limit_reached",
    "username_already_exists",
    "invalid_username",
    "invalid_role",
  ];
  return codes.find(code => message.includes(code)) ?? "internal_error";
}

// Limite configuravel por secret; entradas ausentes ou invalidas usam 10.
const configuredLimit = Number(
  Deno.env.get("MAX_MEMBERS_PER_BARBERSHOP") ?? "10",
);
const maxMembers =
  Number.isInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 10;

Deno.serve(async (req: Request) => {
  // Preflight CORS do navegador. Nao executa regra de negocio.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST")
    return json(req, { error: "method_not_allowed" }, 405);

  let createdUserId: string | null = null;
  try {
    // Cliente privilegiado criado somente no servidor.
    const admin = createAdminClient();
    // A identidade vem do token validado, nunca de um owner_id no body.
    const ownerId = await authenticate(admin, req);
    const body = await parseBody(req);
    // `name` permanece como fallback durante a migração do contrato antigo.
    const username = normalizeUsername(body.username ?? body.name);
    const password = parsePassword(body.password);
    const role = parseRole(body.role);
    const barbershopId = body.barbershop_id;
    if (!isUuid(barbershopId)) {
      throw new MemberFunctionError("invalid_barbershop_id", 400);
    }
    // Impede a criacao de membros em barbearias de outro proprietario.
    await assertBarbershopOwner(admin, ownerId, barbershopId);

    // Deve manter o mesmo formato esperado por get_member_auth_email.
    const email = `${username}@${barbershopId}.member`;
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "barbershop_member",
          name: username,
          barbershop_id: barbershopId,
        },
      });

    if (createError || !created.user) {
      const duplicate = createError?.message.toLowerCase().includes("already");
      throw new MemberFunctionError(
        duplicate ? "username_already_exists" : "failed_to_create_auth_user",
        duplicate ? 409 : 500,
      );
    }
    createdUserId = created.user.id;

    // A RPC aplica lock na barbearia, valida o limite e insere profile + membro
    // na mesma transacao PostgreSQL.
    const { data: member, error: registerError } = await admin.rpc(
      "register_barbershop_member",
      {
        p_owner_id: ownerId,
        p_barbershop_id: barbershopId,
        p_user_id: createdUserId,
        p_username: username,
        p_role: role,
        p_max_members: maxMembers,
      },
    );

    if (registerError) {
      const code = getRpcErrorCode(registerError);
      throw new MemberFunctionError(
        code,
        code === "member_limit_reached"
          ? 409
          : code === "internal_error"
            ? 500
            : 400,
      );
    }

    return json(req, { member }, 201);
  } catch (error) {
    // Rollback compensatorio: evita Auth users orfaos quando o banco falha.
    if (createdUserId) {
      try {
        await createAdminClient().auth.admin.deleteUser(createdUserId);
      } catch {
        // Limpeza best-effort; o erro original continua sendo retornado.
      }
    }
    return handleError(req, error);
  }
});
