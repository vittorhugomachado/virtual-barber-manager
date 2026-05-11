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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatorios ausentes." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const anonKey =
      req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY");

    if (!anonKey) {
      return new Response(
        JSON.stringify({ error: "Chave anon do Supabase nao encontrada." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const publicClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey);
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: signInError } = await publicClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: String(password),
    });

    if (!signInError) {
      return new Response(
        JSON.stringify({ error: "Usuario ja pode autenticar normalmente." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (signInError.message !== "Email not confirmed") {
      return new Response(JSON.stringify({ error: signInError.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: barbershop, error: barbershopError } = await adminClient
      .from("barbershops")
      .select("owner_id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (barbershopError || !barbershop?.owner_id) {
      return new Response(
        JSON.stringify({ error: "Cadastro pendente nao encontrado." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(barbershop.owner_id);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Usuario nao encontrado." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const changeToken = crypto.randomUUID();
    const currentMetadata = userData.user.user_metadata ?? {};

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      barbershop.owner_id,
      {
        user_metadata: {
          ...currentMetadata,
          signup_change_token: changeToken,
        },
      },
    );

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        email: normalizedEmail,
        userId: barbershop.owner_id,
        changeToken,
      }),
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
