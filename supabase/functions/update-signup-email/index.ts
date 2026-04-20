import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, current_email, new_email, change_token } =
      await req.json();

    if (!user_id || !current_email || !new_email || !change_token) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatorios ausentes." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedCurrentEmail = String(current_email).trim().toLowerCase();
    const normalizedNewEmail = String(new_email).trim().toLowerCase();

    if (!isValidEmail(normalizedNewEmail)) {
      return new Response(
        JSON.stringify({ error: "Informe um e-mail valido." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(user_id);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Usuario nao encontrado." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const savedToken = userData.user.user_metadata?.signup_change_token;
    const currentUserEmail = userData.user.email?.trim().toLowerCase();

    if (
      savedToken !== change_token ||
      currentUserEmail !== normalizedCurrentEmail
    ) {
      return new Response(JSON.stringify({ error: "Solicitacao invalida." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingBarbershop } = await adminClient
      .from("barbershops")
      .select("id")
      .eq("email", normalizedNewEmail)
      .maybeSingle();

    if (existingBarbershop) {
      return new Response(
        JSON.stringify({ error: "Este e-mail ja esta em uso." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: authUpdateError } =
      await adminClient.auth.admin.updateUserById(user_id, {
        email: normalizedNewEmail,
        email_confirm: false,
      });

    if (authUpdateError) {
      return new Response(JSON.stringify({ error: authUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: barbershopUpdateError } = await adminClient
      .from("barbershops")
      .update({ email: normalizedNewEmail })
      .eq("owner_id", user_id);

    if (barbershopUpdateError) {
      await adminClient.auth.admin.updateUserById(user_id, {
        email: normalizedCurrentEmail,
        email_confirm: false,
      });

      return new Response(
        JSON.stringify({ error: barbershopUpdateError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: normalizedNewEmail,
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
