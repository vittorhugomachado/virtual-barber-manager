// // lib/supabase/auth/verify-password.ts
// import { supabase } from "@/lib/supabase/supabase";
//
// export async function verifyPassword(password: string): Promise<boolean> {
//   try {
//     // Primeiro, pega o email do usuário atual
//     const {
//       data: { user },
//       error: userError,
//     } = await supabase.auth.getUser();
//
//     if (userError || !user?.email) {
//       throw new Error("Usuário não encontrado");
//     }
//
//     // Tenta fazer login com o email atual e a senha fornecida
//     const { error } = await supabase.auth.signInWithPassword({
//       email: user.email,
//       password: password,
//     });
//
//     if (error) {
//       return false;
//     }
//
//     return true;
//   } catch (error) {
//     console.error("Erro ao verificar senha:", error);
//     return false;
//   }
// }
