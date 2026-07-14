import { supabase } from "@/lib/supabase/supabase";

export async function checkEmailExists(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const { data, error } = await supabase.rpc("check_email_exists", {
    p_email: normalizedEmail,
  });

  if (error) {
    throw new Error("Não foi possível verificar a disponibilidade do email.");
  }

  if (typeof data !== "boolean") {
    throw new Error("Resposta inválida ao verificar o email.");
  }

  return data;
}
