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
    const { username, password, role, barbershop_id } = await req.json();

    if (!username || !password || !role || !barbershop_id) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatorios ausentes." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedUsername = username.trim().toLowerCase();

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

    const { data: barbershop, error: shopError } = await adminClient
      .from("barbershops")
      .select("id")
      .eq("id", barbershop_id)
      .eq("owner_id", user.id)
      .single();

    if (shopError || !barbershop) {
      return new Response(
        JSON.stringify({
          error: "Apenas o proprietario pode adicionar membros.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: existing, error: existingError } = await adminClient
      .from("barbershop_members")
      .select("id")
      .eq("barbershop_id", barbershop_id)
      .eq("username", normalizedUsername)
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

    const internalEmail = `${normalizedUsername}@${barbershop_id}.member`;

    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: "barbershop_member",
        },
      });

    if (createError || !newUser?.user) {
      return new Response(
        JSON.stringify({
          error: createError?.message ?? "Erro ao criar usuario.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: newUser.user.id,
      role: "barbershop_member",
      name: normalizedUsername,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: memberError } = await adminClient
      .from("barbershop_members")
      .insert({
        barbershop_id,
        user_id: newUser.user.id,
        role,
        username: normalizedUsername,
      });

    if (memberError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
