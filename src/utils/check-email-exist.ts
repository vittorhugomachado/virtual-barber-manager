// // utils/check-email-exist.ts
// import { supabase } from "@/lib/supabase/supabase";
// 
// export async function checkEmailExists(email: string): Promise<boolean> {
//   try {
//     const emailToCheck = email.toLowerCase().trim();
// 
//     console.log("Verificando email:", emailToCheck);
// 
//     // Usar a função RPC
//     const { data, error } = await supabase.rpc("check_email_exists", {
//       email_to_check: emailToCheck,
//     });
// 
//     console.log("Resposta RPC:", { data, error });
// 
//     if (error) {
//       console.error("Erro detalhado do RPC:", error);
//       throw new Error(`Erro ao verificar email: ${error.message}`);
//     }
// 
//     return data === true;
//   } catch (error) {
//     console.error("Erro na verificação:", error);
//     // Em caso de erro, retornamos false para não bloquear o usuário
//     // Mas você pode querer tratar diferente
//     return false;
//   }
// }
