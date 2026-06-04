// =============================================================================
// Edge Function: create-member
//
// Cria um membro de barbearia de forma segura. É a ÚNICA porta de criação:
// a RLS de barbershop_members não permite INSERT a nenhum role do cliente, só
// o service_role (esta função) passa. Isso torna o limite de plano inviolável.
//
// Fluxo:
//   1. Valida o JWT do chamador (owner) — identidade vem do token, nunca do body.
//   2. Valida os inputs.
//   3. Confirma que o chamador é DONO do barbershop_id recebido.
//   4. Reforça o limite de membros do plano (server-side).
//   5. Gera um username único por barbearia a partir do nome.
//   6. Cria o usuário no Auth (admin API) com email sintético + email_confirm.
//      role != 'barbershop' => o trigger handle_new_barbershop_user NÃO cria
//      barbearia/profile para o membro.
//   7. Insere a linha em barbershop_members.
//   8. Em qualquer falha após criar o auth user, faz rollback (deleta o auth
//      user) para nunca deixar órfão.
//
// Contrato de resposta (casado com src/lib/supabase/members/create-member.ts):
//   sucesso    -> 200 { member: { id, username, role, created_at } }
//   negócio    -> 200 { error: "<codigo>" }   (functions.invoke só popula
//                 data.error em respostas 2xx)
//   inesperado -> 4xx/5xx { error: "internal_error" }
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MemberRole = "admin" | "reader";

// Limite de membros por barbearia. Conecte ao seu modelo de plano quando ele
// existir (ex.: ler de uma tabela subscriptions). Default conservador via env.
const MAX_MEMBERS = Number(Deno.env.get("MAX_MEMBERS_PER_BARBERSHOP") ?? "10");

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

// Deriva username (^[a-z0-9._-]{2,30}$) a partir do nome digitado.
function slugifyUsername(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-") // inválidos -> hífen
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, ""); // tira pontuação das pontas
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "internal_error" }, 405);

  try {
    // 1. Autorização -----------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return fail("missing_authorization");
    }
    const jwt = authHeader.slice("Bearer ".length).trim();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente service_role: bypassa RLS. NÃO recebe o header do usuário.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Identidade do chamador a partir do JWT (não confiar no body) ----------
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return fail("invalid_token");
    const callerId = userData.user.id;

    // 3. Body + validação ------------------------------------------------------
    const body = (await req.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!body) return json({ error: "internal_error" }, 400);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;
    const barbershopId = body.barbershop_id;

    if (name.length < 2 || name.length > 50) return fail("invalid_name");
    if (password.length < 8 || password.length > 72) {
      return fail("invalid_password");
    }
    if (role !== "admin" && role !== "reader") return fail("invalid_role");
    if (!isUuid(barbershopId)) return fail("invalid_barbershop_id");

    const memberRole = role as MemberRole;

    // 4. Ownership — checagem crítica, via service_role ------------------------
    const { data: shop, error: shopErr } = await admin
      .from("barbershops")
      .select("id")
      .eq("id", barbershopId)
      .eq("owner_id", callerId)
      .maybeSingle();
    if (shopErr) return json({ error: "internal_error" }, 500);
    if (!shop) return fail("not_barbershop_owner");

    // 5. Limite de plano -------------------------------------------------------
    const { count, error: countErr } = await admin
      .from("barbershop_members")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId);
    if (countErr) return json({ error: "internal_error" }, 500);
    if ((count ?? 0) >= MAX_MEMBERS) return fail("member_limit_reached");

    // 6. Username único por barbearia ------------------------------------------
    let base = slugifyUsername(name);
    if (base.length < 2) base = "membro";
    base = base.slice(0, 30);

    const { data: rows, error: rowsErr } = await admin
      .from("barbershop_members")
      .select("username")
      .eq("barbershop_id", barbershopId)
      .ilike("username", `${base}%`);
    if (rowsErr) return json({ error: "internal_error" }, 500);

    const used = new Set((rows ?? []).map((r) => r.username as string));
    let username = base;
    let n = 1;
    while (used.has(username)) {
      const suffix = String(n);
      username = `${base.slice(0, 30 - suffix.length)}${suffix}`;
      n += 1;
      if (n > 9999) return fail("username_already_exists");
    }

    // 7. Email sintético — DEVE casar com get_member_auth_email:
    //    username || '@' || barbershop_id || '.member'
    const email = `${username}@${barbershopId}.member`;

    // 8. Cria o auth user (admin). email_confirm => login imediato.
    //    role 'barbershop_member' (!= 'barbershop') e sem barbershop_name:
    //    o trigger handle_new_barbershop_user retorna cedo e NÃO cria barbearia.
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "barbershop_member",
          name,
          barbershop_id: barbershopId,
        },
      });
    if (createErr || !created.user) return fail("failed_to_create_auth_user");

    const userId = created.user.id;

    // 9. Cria o profile do membro (role barbershop_member). O trigger
    //    handle_new_barbershop_user NÃO cria profile para membros, então é
    //    responsabilidade desta função. upsert por segurança/idempotência.
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(
        { id: userId, name, role: "barbershop_member" },
        { onConflict: "id" },
      );
    if (profileErr) {
      // Rollback: remove o auth user para não deixar órfão.
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return fail("failed_to_create_member");
    }

    // 10. Insere o membro; rollback de profile + auth user em qualquer falha ---
    const { data: member, error: memberErr } = await admin
      .from("barbershop_members")
      .insert({
        barbershop_id: barbershopId,
        user_id: userId,
        role: memberRole,
        username,
      })
      .select("id, username, role, created_at")
      .single();

    if (memberErr || !member) {
      // Desfaz profile e auth user (best-effort) para não deixar órfão.
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      // 23505 = unique_violation (corrida no username ou no user_id)
      if (memberErr?.code === "23505") return fail("username_already_exists");
      return fail("failed_to_create_member");
    }

    return json({ member }, 200);
  } catch (_err) {
    return json({ error: "internal_error" }, 500);
  }
});
