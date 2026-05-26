// import { supabase } from "../supabase";
// import { toast } from "sonner";
//
// export async function toggleActiveService(
//   id: string,
//   isActive: boolean,
// ): Promise<boolean> {
//   const { error } = await supabase
//     .from("services")
//     .update({ is_active: isActive, updated_at: new Date().toISOString() })
//     .eq("id", id);
//
//   if (error) {
//     if (error.message.includes("service_plan_limit_exceeded")) {
//       toast.error("Limite de serviços atingido. Faça upgrade do plano.");
//     } else {
//       toast.error("Erro ao atualizar serviço");
//     }
//     return false;
//   }
//
//   return true;
// }
