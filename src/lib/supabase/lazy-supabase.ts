import type { SupabaseClient } from "@supabase/supabase-js";

let supabasePromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient() {
  if (!supabasePromise) {
    supabasePromise = import("@supabase/supabase-js").then(
      ({ createClient }) =>
        createClient(
          import.meta.env.VITE_SUPABASE_URL!,
          import.meta.env.VITE_SUPABASE_ANON_KEY!,
        ),
    );
  }

  return supabasePromise;
}
