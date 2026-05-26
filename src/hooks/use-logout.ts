// import { useState } from "react";
// import { useNavigate } from "react-router";
// import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";
//
// export function useLogout() {
//   const navigate = useNavigate();
//   const [isLoading, setIsLoading] = useState(false);
//
//   async function logout() {
//     if (isLoading) return;
//     setIsLoading(true);
//
//     try {
//       const supabase = await getSupabaseClient();
//       await supabase.auth.signOut();
//       navigate("/entrar");
//     } finally {
//       setIsLoading(false);
//     }
//   }
//
//   return { logout, isLoading };
// }
