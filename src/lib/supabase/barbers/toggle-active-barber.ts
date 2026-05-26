// import { supabase } from "../supabase";
// import { toast } from "sonner";
//
// export async function toggleActiveBarber(
//   id: string,
//   isActive: boolean,
// ): Promise<boolean> {
//   const { error } = await supabase
//     .from("barbers")
//     .update({ is_active: isActive })
//     .eq("id", id);
//
//   if (error) {
//     if (error.message.includes("plan_limit_exceeded")) {
//       toast.error(
//         "Limite de barbeiros ativos atingido. Faça upgrade do plano.",
//       );
//     } else {
//       toast.error("Erro ao atualizar barbeiro");
//     }
//     return false;
//   }
//
//   return true;
// }
