import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/supabase";

export async function verifyPassword(password: string): Promise<boolean> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    throw new Error("Sessão inválida. Entre novamente.");
  }

  // Cliente efêmero: a verificação não persiste/renova a sessão principal e
  // não dispara os listeners de autenticação usados pela aplicação.
  const verifier = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { error } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (!error) return true;
  if (error.code === "invalid_credentials") return false;

  throw new Error("Não foi possível confirmar a senha agora.");
}
