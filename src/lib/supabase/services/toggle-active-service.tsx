import { supabase } from "../supabase";
import { toast } from "sonner";

export async function toggleActiveService(
  id: string,
  isActive: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.message.includes("service_plan_limit_exceeded")) {
      toast.error("Limite de servi�os atingido. Fa�a upgrade do plano.");
    } else {
      toast.error("Erro ao atualizar servi�o");
    }
    return false;
  }

  return true;
}
