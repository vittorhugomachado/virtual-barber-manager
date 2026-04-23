import { supabase } from "@/lib/supabase/supabase";

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("barbershops")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Erro ao verificar email:", error);
      throw new Error("Erro ao verificar disponibilidade do email");
    }

    return !!data;
  } catch (error) {
    console.error("Erro na verificação:", error);
    throw error;
  }
}
