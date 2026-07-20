import { createClient } from "@supabase/supabase-js";

import { clearSettingsCache } from "@/lib/settings-cache";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

console.log("🔑 SUPABASE_URL:", supabaseUrl ? "✅" : "❌");
console.log("🔑 SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅" : "❌");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const PASSWORD_RECOVERY_STORAGE_KEY = "virtual-password-recovery";

if (typeof window !== "undefined") {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const hasRecoveryUrl =
    window.location.pathname === "/criar-nova-senha" &&
    (searchParams.has("code") ||
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      searchParams.has("token_hash") ||
      hashParams.has("access_token"));

  if (hasRecoveryUrl) {
    sessionStorage.setItem(
      PASSWORD_RECOVERY_STORAGE_KEY,
      Date.now().toString(),
    );
  }

  supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") clearSettingsCache();

    if (event === "PASSWORD_RECOVERY") {
      sessionStorage.setItem(
        PASSWORD_RECOVERY_STORAGE_KEY,
        Date.now().toString(),
      );
    }
  });
}
