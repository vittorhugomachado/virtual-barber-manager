// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { Button } from "@/components/ui/button";
// import { useNavigate } from "react-router";
// import { CheckCircle2, CircleX } from "lucide-react";
// import { Logo } from "@/components/common/logo";
// import { formatPhone } from "@/utils/format-phone";
// 
// export function EmailChangeConfirmedPage() {
//   const [status, setStatus] = useState<"loading" | "success" | "error">(
//     "loading",
//   );
// 
//   const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE;
//   const phone = formatPhone(SUPPORT_PHONE);
// 
//   const navigate = useNavigate();
// 
//   useEffect(() => {
//     async function checkSession() {
//       const { data, error } = await supabase.auth.getSession();
//       console.log("Session data:", data);
//       console.log("Session error:", error);
//       if (error) {
//         setStatus("error");
//         return;
//       }
// 
//       if (data.session) {
//         setStatus("success");
//       } else {
//         setStatus("error");
//       }
//     }
// 
//     checkSession();
//   }, []);
// 
//   if (status === "loading") {
//     return <h1>Confirmando alteração de email...</h1>;
//   }
// 
//   if (status === "success") {
//     return (
//       <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
//         <Logo style="w-55 md:w-60 mb-8" />
// 
//         <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
//           <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
//             <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-4 dark:text-green-400" />
// 
//             <h1 className="text-2xl font-bold mb-2">
//               E-mail confirmado com sucesso
//             </h1>
// 
//             <p className="text-muted-foreground mb-6">
//               Voce ja pode fazer seu login com seguranca e acessar sua conta.
//             </p>
// 
//             <Button
//               type="button"
//               className="w-full"
//               onClick={() => navigate("/entrar")}
//             >
//               Fazer login
//             </Button>
//           </div>
//         </div>
//       </main>
//     );
//   }
// 
//   return (
//     <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
//       <Logo style="w-55 md:w-60 mb-8" />
// 
//       <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
//         <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
//           <CircleX className="w-8 h-8 text-red-600 mx-auto mb-4" />
// 
//           <h1 className="text-2xl font-bold mb-2">Link inválido ou expirado</h1>
// 
//           <p className="text-muted-foreground mb-6">
//             Faça uma nova solicitação de alteração de email para receber um novo
//             link de confirmação.
//             <br /> Se o problema persistir, entre em contato com o suporte.
//           </p>
// 
//           <p className="text-muted-foreground mb-6">{phone}</p>
//           <Button
//             type="button"
//             className="w-full"
//             onClick={() => navigate("/entrar")}
//           >
//             Voltar
//           </Button>
//         </div>
//       </div>
//     </main>
//   );
// }
