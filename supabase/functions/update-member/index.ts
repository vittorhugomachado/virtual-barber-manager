import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { member_id, username, password } = await req.json();

    if (!member_id || (!username && !password)) {
      return new Response(
        JSON.stringify({ error: "Nenhuma alteracao valida foi enviada." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Nao autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message ?? "Nao autorizado." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: member, error: memberError } = await adminClient
      .from("barbershop_members")
      .select("id, user_id, username, barbershop_id")
      .eq("user_id", member_id)
      .single();

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ error: "Membro nao encontrado." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: barbershop, error: shopError } = await adminClient
      .from("barbershops")
      .select("id")
      .eq("id", member.barbershop_id)
      .eq("owner_id", user.id)
      .single();

    if (shopError || !barbershop) {
      return new Response(
        JSON.stringify({
          error: "Apenas o proprietario pode alterar membros.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedUsername = username?.trim().toLowerCase();

    if (normalizedUsername && normalizedUsername !== member.username) {
      const { data: existing, error: existingError } = await adminClient
        .from("barbershop_members")
        .select("id")
        .eq("barbershop_id", member.barbershop_id)
        .eq("username", normalizedUsername)
        .neq("user_id", member_id)
        .maybeSingle();

      if (existingError) {
        return new Response(JSON.stringify({ error: existingError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing) {
        return new Response(
          JSON.stringify({
            error: "Este nome de usuario ja esta em uso nessa barbearia.",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: usernameError } = await adminClient
        .from("barbershop_members")
        .update({ username: normalizedUsername })
        .eq("user_id", member_id);

      if (usernameError) {
        return new Response(JSON.stringify({ error: usernameError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (password) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        member_id,
        { password },
      );

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Membro atualizado com sucesso!" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro interno.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
