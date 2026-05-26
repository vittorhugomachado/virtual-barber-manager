// import { useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { Controller, useForm } from "react-hook-form";
// import { toast } from "sonner";
// import { useNavigate } from "react-router";
// import * as z from "zod";
// import { Eye, EyeOff } from "lucide-react";
// 
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
// 
// const ownerSchema = z.object({
//   email: z.email("Email inválido"),
//   password: z.string().min(1, "Digite sua senha"),
// });
// 
// const memberSchema = z.object({
//   slug: z.string().min(1, "Digite o site da barbearia"),
//   username: z.string().min(1, "Digite seu nome de usuário"),
//   password: z.string().min(1, "Digite sua senha"),
// });
// 
// const errorMessages: Record<string, string> = {
//   "Invalid login credentials": "Usuário ou senha incorretos",
//   "Email not confirmed": "Email não confirmado",
//   "Too many requests": "Muitas tentativas, aguarde um momento",
// };
// 
// export function LoginForm() {
//   const navigate = useNavigate();
//   const [isLoading, setIsLoading] = useState(false);
//   const [mode, setMode] = useState<"owner" | "member">("owner");
//   const [showOwnerPassword, setShowOwnerPassword] = useState(false);
//   const [showMemberPassword, setShowMemberPassword] = useState(false);
// 
//   const DOMAIN = import.meta.env.VITE_DOMAIN;
// 
//   const ownerForm = useForm<z.infer<typeof ownerSchema>>({
//     resolver: zodResolver(ownerSchema),
//     defaultValues: { email: "", password: "" },
//   });
// 
//   const memberForm = useForm<z.infer<typeof memberSchema>>({
//     resolver: zodResolver(memberSchema),
//     defaultValues: { slug: "", username: "", password: "" },
//   });
// 
//   async function onOwnerSubmit(data: z.infer<typeof ownerSchema>) {
//     if (isLoading) return;
//     setIsLoading(true);
//     try {
//       const { error } = await supabase.auth.signInWithPassword({
//         email: data.email,
//         password: data.password,
//       });
//       if (error) {
//         if (error.message === "Email not confirmed") {
//           const normalizedEmail = data.email.trim().toLowerCase();
//           const response = await fetch(
//             `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prepare-pending-signup`,
//             {
//               method: "POST",
//               headers: {
//                 "Content-Type": "application/json",
//                 apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
//                 Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
//               },
//               body: JSON.stringify({
//                 email: normalizedEmail,
//                 password: data.password,
//               }),
//             },
//           );
// 
//           const payload = (await response.json()) as {
//             error?: string;
//             email?: string;
//             userId?: string;
//             changeToken?: string;
//           };
// 
//           if (
//             !response.ok ||
//             !payload.email ||
//             !payload.userId ||
//             !payload.changeToken
//           ) {
//             toast.error("Erro ao preparar confirmacao de e-mail", {
//               description:
//                 payload.error ?? "Nao foi possivel continuar este login.",
//             });
//             return;
//           }
// 
//           const pendingSignup = {
//             email: payload.email,
//             userId: payload.userId,
//             changeToken: payload.changeToken,
//           };
// 
//           sessionStorage.setItem(
//             "pending-signup",
//             JSON.stringify(pendingSignup),
//           );
//           navigate(`/cadastro-pendente/${pendingSignup.email}`, {
//             state: pendingSignup,
//           });
//           return;
//         }
//         toast.error(errorMessages[error.message] ?? "Erro ao fazer login");
//         return;
//       }
//       navigate("/painel");
//     } finally {
//       setIsLoading(false);
//     }
//   }
// 
//   async function onMemberSubmit(data: z.infer<typeof memberSchema>) {
//     if (isLoading) return;
//     setIsLoading(true);
//     try {
//       const { data: internalEmail, error: lookupError } = await supabase.rpc(
//         "get_member_auth_email",
//         {
//           p_username: data.username.toLowerCase(),
//           p_slug: data.slug.toLowerCase().trim(),
//         },
//       );
// 
//       if (lookupError) {
//         toast.error("Erro ao verificar usuário");
//         return;
//       }
// 
//       if (!internalEmail) {
//         memberForm.setError("slug", {
//           message: "Barbearia não encontrada ou usuário não pertence a ela",
//         });
//         return;
//       }
// 
//       const { error } = await supabase.auth.signInWithPassword({
//         email: internalEmail,
//         password: data.password,
//       });
// 
//       if (error) {
//         memberForm.setError("password", {
//           message: errorMessages[error.message] ?? "Senha incorreta",
//         });
//         return;
//       }
// 
//       navigate("/painel");
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
//             Entrar na Virtual
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           {/* Toggle de modo */}
//           <div className="flex gap-1 mb-6 p-1 bg-muted rounded-full w-fit">
//             <button
//               type="button"
//               onClick={() => setMode("owner")}
//               className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
//                 mode === "owner"
//                   ? "bg-background shadow-sm text-foreground"
//                   : "text-muted-foreground hover:text-foreground"
//               }`}
//             >
//               Proprietário
//             </button>
//             <button
//               type="button"
//               onClick={() => setMode("member")}
//               className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
//                 mode === "member"
//                   ? "bg-background shadow-sm text-foreground"
//                   : "text-muted-foreground hover:text-foreground"
//               }`}
//             >
//               Colaborador
//             </button>
//           </div>
// 
//           {mode === "owner" ? (
//             <div key="owner-mode">
//               <form
//                 id="login-form-owner"
//                 onSubmit={ownerForm.handleSubmit(onOwnerSubmit)}
//               >
//                 <FieldGroup>
//                   <Controller
//                     name="email"
//                     control={ownerForm.control}
//                     render={({ field, fieldState }) => (
//                       <Field data-invalid={fieldState.invalid}>
//                         <FieldLabel htmlFor="login-email">Email</FieldLabel>
//                         <Input
//                           {...field}
//                           id="login-email"
//                           placeholder="barbearia@email.com"
//                           aria-invalid={fieldState.invalid}
//                         />
//                         {fieldState.invalid && (
//                           <FieldError errors={[fieldState.error]} />
//                         )}
//                       </Field>
//                     )}
//                   />
//                   <Controller
//                     name="password"
//                     control={ownerForm.control}
//                     render={({ field, fieldState }) => (
//                       <Field data-invalid={fieldState.invalid}>
//                         <FieldLabel htmlFor="login-password">Senha</FieldLabel>
//                         <div className="relative">
//                           <Input
//                             {...field}
//                             type={showOwnerPassword ? "text" : "password"}
//                             id="login-password"
//                             placeholder="sua senha"
//                             autoComplete="off"
//                             aria-invalid={fieldState.invalid}
//                             className="pr-9"
//                           />
//                           <button
//                             type="button"
//                             onClick={() => setShowOwnerPassword(v => !v)}
//                             className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                             tabIndex={-1}
//                           >
//                             {showOwnerPassword ? (
//                               <EyeOff className="h-4 w-4" />
//                             ) : (
//                               <Eye className="h-4 w-4" />
//                             )}
//                           </button>
//                         </div>
//                         {fieldState.invalid && (
//                           <FieldError errors={[fieldState.error]} />
//                         )}
//                       </Field>
//                     )}
//                   />
//                 </FieldGroup>
//               </form>
// 
//               <CardFooter className="flex-col gap-2 mt-6">
//                 <Button
//                   type="submit"
//                   form="login-form-owner"
//                   disabled={isLoading}
//                   className="w-full max-w-36 rounded-full"
//                 >
//                   {isLoading ? "Entrando..." : "Entrar"}
//                 </Button>
// 
//                 <Button
//                   variant="link"
//                   onClick={() => navigate("/cadastro")}
//                   className="rounded-full"
//                 >
//                   Criar conta
//                 </Button>
//                 <Button
//                   type="button"
//                   variant="link"
//                   onClick={() => navigate("/esqueci-minha-senha")}
//                   className="rounded-full"
//                 >
//                   Esqueci minha senha
//                 </Button>
//               </CardFooter>
//             </div>
//           ) : (
//             <div key="member-mode">
//               <form
//                 id="login-form-member"
//                 onSubmit={memberForm.handleSubmit(onMemberSubmit)}
//               >
//                 <FieldGroup>
//                   <Controller
//                     name="slug"
//                     control={memberForm.control}
//                     render={({ field, fieldState }) => (
//                       <Field data-invalid={fieldState.invalid}>
//                         <div className="flex flex-col gap-1">
//                           <FieldLabel htmlFor="login-slug">
//                             Site da barbearia
//                           </FieldLabel>
// 
//                           <div className="relative">
//                             {/* prefixo dentro do input */}
//                             <span className="h-full w-37 flex items-center pl-3 rounded-l-lg absolute text-muted-foreground text-sm pointer-events-none">
//                               {DOMAIN}
//                             </span>
// 
//                             <Input
//                               {...field}
//                               id="login-slug"
//                               placeholder="nome-da-barbearia"
//                               className="pl-36" // espaço pro prefixo
//                               aria-invalid={fieldState.invalid}
//                               onChange={e => {
//                                 // opcional: normalizar slug
//                                 const value = e.target.value
//                                   .toLowerCase()
//                                   .replace(/[^a-z0-9-]/g, "");
//                                 field.onChange(value);
//                               }}
//                             />
//                           </div>
// 
//                           {fieldState.invalid && (
//                             <FieldError errors={[fieldState.error]} />
//                           )}
//                         </div>
//                       </Field>
//                     )}
//                   />
//                   <Controller
//                     name="username"
//                     control={memberForm.control}
//                     render={({ field, fieldState }) => (
//                       <Field data-invalid={fieldState.invalid}>
//                         <FieldLabel htmlFor="login-username">
//                           Nome de usuário
//                         </FieldLabel>
//                         <Input
//                           {...field}
//                           id="login-username"
//                           placeholder="ex: joao_silva"
//                           aria-invalid={fieldState.invalid}
//                         />
//                         {fieldState.invalid && (
//                           <FieldError errors={[fieldState.error]} />
//                         )}
//                       </Field>
//                     )}
//                   />
//                   <Controller
//                     name="password"
//                     control={memberForm.control}
//                     render={({ field, fieldState }) => (
//                       <Field data-invalid={fieldState.invalid}>
//                         <FieldLabel htmlFor="login-member-password">
//                           Senha
//                         </FieldLabel>
//                         <div className="relative">
//                           <Input
//                             {...field}
//                             type={showMemberPassword ? "text" : "password"}
//                             id="login-member-password"
//                             placeholder="sua senha"
//                             autoComplete="off"
//                             aria-invalid={fieldState.invalid}
//                             className="pr-9"
//                           />
//                           <button
//                             type="button"
//                             onClick={() => setShowMemberPassword(v => !v)}
//                             className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                             tabIndex={-1}
//                           >
//                             {showMemberPassword ? (
//                               <EyeOff className="h-4 w-4" />
//                             ) : (
//                               <Eye className="h-4 w-4" />
//                             )}
//                           </button>
//                         </div>
//                         {fieldState.invalid && (
//                           <FieldError errors={[fieldState.error]} />
//                         )}
//                       </Field>
//                     )}
//                   />
//                 </FieldGroup>
//               </form>
// 
//               <CardFooter className="flex-col gap-2 mt-6">
//                 <Button
//                   type="submit"
//                   form="login-form-member"
//                   disabled={isLoading}
//                   className="w-full max-w-36"
//                 >
//                   {isLoading ? "Entrando..." : "Entrar"}
//                 </Button>
//               </CardFooter>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }
