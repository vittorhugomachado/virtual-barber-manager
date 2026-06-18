// _shared/supabaseAdmin.ts
// Cliente Supabase com service_role — ÚNICO escritor das tabelas de billing.
// A service_role key é injetada automaticamente pelo runtime das edge functions.
// NUNCA exponha essa key no frontend.

import { createClient } from "jsr:@supabase/supabase-js@2";

export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
