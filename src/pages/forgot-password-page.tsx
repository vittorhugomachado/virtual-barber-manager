// import { Logo } from "@/components/common/logo";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   Field,
//   FieldError,
//   FieldGroup,
//   FieldLabel,
// } from "@/components/ui/field";
// import { Input } from "@/components/ui/input";
// import { supabase } from "@/lib/supabase/supabase";
// import { checkEmailExists } from "@/utils/check-email-exist";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { Controller, useForm } from "react-hook-form";
// import { useNavigate } from "react-router";
// import { toast } from "sonner";
// import { useState } from "react";
// import * as z from "zod";
//
// const forgotPasswordSchema = z.object({
//   email: z.email("Email inválido"),
// });
//
// export function ForgotPasswordPage() {
//   return (
//     <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex items-center justify-center px-4 lg:justify-between lg:px-0">
//       <Logo style="w-55 md:w-80 absolute top-8 lg:left-8" />
//       <div className="hidden lg:block antonio text-5xl leading-snug max-w-xs">
//         <h3 className="absolute bottom-8 left-4">
//           Bem vindo a <strong className="text-[#0458EE]">Virtual</strong>!{" "}
//           <br /> Gestão inteligente, <br />
//           resultados reais
//         </h3>
//       </div>
//       <ForgotPasswordForm />
//     </main>
//   );
// }
//
// function ForgotPasswordForm() {
//   const navigate = useNavigate();
//   const [isLoading, setIsLoading] = useState(false);
//
//   const form = useForm<z.infer<typeof forgotPasswordSchema>>({
//     resolver: zodResolver(forgotPasswordSchema),
//     defaultValues: { email: "" },
//   });
//
//   async function onSubmit(data: z.infer<typeof forgotPasswordSchema>) {
//     if (isLoading) return;
//
//     setIsLoading(true);
//
//     try {
//       const email = data.email.trim().toLowerCase();
//       const emailExists = await checkEmailExists(email);
//
//       if (!emailExists) {
//         form.setError("email", { message: "Email não encontrado" });
//         return;
//       }
//
//       const { error } = await supabase.auth.resetPasswordForEmail(email, {
//         redirectTo: `${window.location.origin}/criar-nova-senha`,
//       });
//
//       if (error) {
//         toast.error("Erro ao enviar link de recuperação", {
//           description: error.message,
//         });
//         return;
//       }
//
//       toast.success("Link de recuperação enviado! Verifique seu email.");
//       form.reset();
//     } finally {
//       setIsLoading(false);
//     }
//   }
//
//   return (
//     <div className="w-full max-w-lg lg:max-w-285 lg:flex lg:items-center justify-center lg:h-screen lg:w-[50vw] lg:bg-card text-card-foreground lg:border-l border-zinc-300 dark:border-none">
//       <Card className="w-full max-w-lg lg:border-none lg:rounded-none lg:shadow-none">
//         <CardHeader>
//           <CardTitle className="lg:text-3xl lg:-translate-y-20">
//             Recuperar senha
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <form
//             id="forgot-password-form"
//             onSubmit={form.handleSubmit(onSubmit)}
//           >
//             <FieldGroup>
//               <Controller
//                 name="email"
//                 control={form.control}
//                 render={({ field, fieldState }) => (
//                   <Field data-invalid={fieldState.invalid}>
//                     <FieldLabel htmlFor="forgot-password-email">
//                       Email
//                     </FieldLabel>
//                     <Input
//                       {...field}
//                       id="forgot-password-email"
//                       placeholder="barbearia@email.com"
//                       aria-invalid={fieldState.invalid}
//                       disabled={isLoading}
//                     />
//                     {fieldState.invalid && (
//                       <FieldError errors={[fieldState.error]} />
//                     )}
//                   </Field>
//                 )}
//               />
//             </FieldGroup>
//           </form>
//         </CardContent>
//         <CardFooter className="flex-col gap-2">
//           <Button
//             type="submit"
//             form="forgot-password-form"
//             disabled={isLoading}
//             className="w-full max-w-44 rounded-full"
//           >
//             {isLoading ? "Enviando..." : "Recuperar senha"}
//           </Button>
//
//           <Button
//             type="button"
//             variant="link"
//             onClick={() => navigate("/entrar")}
//             className="rounded-full"
//           >
//             Voltar para login
//           </Button>
//         </CardFooter>
//       </Card>
//     </div>
//   );
// }
