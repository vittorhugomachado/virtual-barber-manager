// // components/settings/security-settings-form.tsx
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
// import { Input } from "@/components/ui/input";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { Button } from "../ui/button";
// import { useState, useEffect } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { EmailChangeConfirmationModal } from "../modals/settings/email-change-confirmation-modal";
// import { PasswordConfirmModal } from "../modals/password/password-confirm-modal";
// import { checkEmailExists } from "@/utils/check-email-exist";
// import { verifyPassword } from "@/utils/verify-password";
// import { toast } from "sonner";
// import { Eye, EyeOff } from "lucide-react";
// 
// type PendingSecurityAction = "email" | "password" | null;
// 
// export function SecuritySettingsForm() {
//   const { barbershop } = useBarbershopStore();
//   const [currentEmail, setCurrentEmail] = useState("");
//   const [newEmail, setNewEmail] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [confirmNewPassword, setConfirmNewPassword] = useState("");
//   const [isCheckingEmail, setIsCheckingEmail] = useState(false);
//   const [showPasswordModal, setShowPasswordModal] = useState(false);
//   const [showConfirmationModal, setShowConfirmationModal] = useState(false);
//   const [emailToConfirm, setEmailToConfirm] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
//   const [passwordError, setPasswordError] = useState<string | null>(null);
//   const [pendingAction, setPendingAction] =
//     useState<PendingSecurityAction>(null);
// 
//   const handleClearPasswordError = () => {
//     setPasswordError(null);
//   };
// 
//   useEffect(() => {
//     const fetchCurrentEmail = async () => {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (user?.email) {
//         setCurrentEmail(user.email);
//       } else if (barbershop?.email) {
//         setCurrentEmail(barbershop.email);
//       }
//     };
// 
//     fetchCurrentEmail();
// 
//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange((event, session) => {
//       if (event === "USER_UPDATED" && session?.user?.email) {
//         setCurrentEmail(session.user.email);
//       }
//     });
// 
//     return () => subscription.unsubscribe();
//   }, [barbershop?.email]);
// 
//   const handleEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
// 
//     const nextEmail = newEmail.trim();
// 
//     if (!nextEmail || nextEmail === currentEmail) {
//       toast.error("Por favor, insira um email diferente do atual");
//       return;
//     }
// 
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(nextEmail)) {
//       toast.error("Por favor, insira um email válido");
//       return;
//     }
// 
//     setIsCheckingEmail(true);
// 
//     try {
//       const emailExists = await checkEmailExists(nextEmail);
// 
//       if (emailExists) {
//         toast.error("Este email já está em uso. Por favor, use outro email.");
//         return;
//       }
// 
//       setNewEmail(nextEmail);
//       setPasswordError(null);
//       setPendingAction("email");
//       setShowPasswordModal(true);
//     } catch (error) {
//       console.error("Erro ao verificar email:", error);
//       toast.error(
//         "Erro ao verificar disponibilidade do email. Tente novamente.",
//       );
//     } finally {
//       setIsCheckingEmail(false);
//     }
//   };
// 
//   const handlePasswordChange = (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
// 
//     if (newPassword.length < 6) {
//       toast.error("A nova senha deve ter pelo menos 6 caracteres");
//       return;
//     }
// 
//     if (newPassword !== confirmNewPassword) {
//       toast.error("As senhas não coincidem");
//       return;
//     }
// 
//     setPasswordError(null);
//     setPendingAction("password");
//     setShowPasswordModal(true);
//   };
// 
//   const handlePasswordConfirm = async (password: string) => {
//     setIsVerifyingPassword(true);
//     setPasswordError(null);
// 
//     try {
//       const isPasswordValid = await verifyPassword(password);
// 
//       if (!isPasswordValid) {
//         setPasswordError("Senha incorreta. Tente novamente.");
//         throw new Error("Senha incorreta");
//       }
// 
//       if (pendingAction === "password") {
//         await updatePassword();
//         return;
//       }
// 
//       if (pendingAction === "email") {
//         await updateEmail();
//       }
//     } catch (error) {
//       if (error instanceof Error && error.message === "Senha incorreta") {
//         throw error;
//       }
// 
//       if (!(error instanceof Error) || error.message !== "Senha incorreta") {
//         console.error("Erro inesperado:", error);
//         toast.error("Ocorreu um erro inesperado. Tente novamente.");
//       }
//     } finally {
//       setIsVerifyingPassword(false);
//     }
//   };
// 
//   const updateEmail = async () => {
//     const { error } = await supabase.auth.updateUser(
//       { email: newEmail },
//       {
//         emailRedirectTo: `${window.location.origin}/auth/email-change-confirmed`,
//       },
//     );
// 
//     if (error) {
//       console.error("Erro ao solicitar alteração de email:", error.message);
// 
//       if (error.message.includes("already been registered")) {
//         toast.error("Este email já está registrado em outra conta.");
//       } else {
//         toast.error(`Erro: ${error.message}`);
//       }
// 
//       setShowPasswordModal(false);
//       setPendingAction(null);
//       return;
//     }
// 
//     setEmailToConfirm(newEmail);
//     setShowConfirmationModal(true);
//     setShowPasswordModal(false);
//     setPendingAction(null);
//     setNewEmail("");
//     toast.success("Link de confirmação enviado! Verifique seu novo email.");
//   };
// 
//   const updatePassword = async () => {
//     const { error } = await supabase.auth.updateUser({
//       password: newPassword,
//     });
// 
//     if (error) {
//       console.error("Erro ao alterar senha:", error.message);
//       if (
//         error.message.includes(
//           "New password should be different from the old password",
//         )
//       ) {
//         toast.error("A nova senha precisa ser diferente da senha atual");
//       } else {
//         toast.error(`Erro: ${error.message}`);
//       }
//       setShowPasswordModal(false);
//       setPendingAction(null);
//       return;
//     }
// 
//     setShowPasswordModal(false);
//     setPendingAction(null);
//     setNewPassword("");
//     setConfirmNewPassword("");
//     toast.success("Senha alterada com sucesso!");
//   };
// 
//   const handleClosePasswordModal = () => {
//     setShowPasswordModal(false);
//     setPasswordError(null);
//     setPendingAction(null);
//   };
// 
//   const handleCloseConfirmationModal = () => {
//     setShowConfirmationModal(false);
//     setEmailToConfirm("");
// 
//     const refreshCurrentEmail = async () => {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (user?.email) {
//         setCurrentEmail(user.email);
//       }
//     };
//     refreshCurrentEmail();
//   };
// 
//   const passwordModalDescription =
//     pendingAction === "password"
//       ? "Digite sua senha atual para confirmar a alteração da senha"
//       : `Digite sua senha para confirmar a alteração do email de ${currentEmail} para ${newEmail}`;
// 
//   return (
//     <>
//       <div className="w-full max-w-180 mx-auto md:px-16 mt-2 mb-18 flex flex-col gap-8">
//         <Card className="bg-transparent border-none">
//           <CardHeader className="mt-3">
//             <div className="flex flex-col w-fit">
//               <CardTitle className="font-semibold text-2xl">
//                 Segurança
//               </CardTitle>
//               <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
//             </div>
//           </CardHeader>
// 
//           <CardContent>
//             <form onSubmit={handleEmailChange} className="flex flex-col gap-6">
//               <FieldGroup className="gap-3">
//                 <Field>
//                   <FieldLabel htmlFor="settings-security-current-email">
//                     Email atual
//                   </FieldLabel>
//                   <Input
//                     id="settings-security-current-email"
//                     type="email"
//                     value={currentEmail}
//                     disabled
//                     className="bg-gray-50"
//                   />
//                   <p className="text-xs text-gray-500">
//                     Seu email atual cadastrado
//                   </p>
//                 </Field>
// 
//                 <Field>
//                   <FieldLabel htmlFor="settings-security-new-email">
//                     Novo email
//                   </FieldLabel>
//                   <Input
//                     id="settings-security-new-email"
//                     type="email"
//                     value={newEmail}
//                     onChange={event => setNewEmail(event.target.value)}
//                     placeholder="novo@email.com"
//                     disabled={isCheckingEmail || isVerifyingPassword}
//                   />
//                   <p className="text-xs text-gray-500">
//                     Você receberá um link de confirmação no novo email
//                   </p>
//                 </Field>
//               </FieldGroup>
// 
//               <Button
//                 type="submit"
//                 disabled={isCheckingEmail || isVerifyingPassword || !newEmail}
//                 className="w-60 mx-auto rounded-full"
//               >
//                 {isCheckingEmail ? "Verificando..." : "Alterar email"}
//               </Button>
//             </form>
//           </CardContent>
//         </Card>
// 
//         <Card className="bg-transparent border-none">
//           <CardContent>
//             <form
//               onSubmit={handlePasswordChange}
//               className="flex flex-col gap-6"
//             >
//               <FieldGroup className="gap-3">
//                 <Field>
//                   <FieldLabel htmlFor="settings-security-new-password">
//                     Nova senha
//                   </FieldLabel>
//                   <div className="relative">
//                     <Input
//                       id="settings-security-new-password"
//                       type={showPassword ? "text" : "password"}
//                       value={newPassword}
//                       onChange={event => setNewPassword(event.target.value)}
//                       placeholder="Digite a nova senha"
//                       autoComplete="new-password"
//                       disabled={isVerifyingPassword}
//                     />
//                     <button
//                       type="button"
//                       onClick={() => setShowPassword(v => !v)}
//                       className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                       tabIndex={-1}
//                     >
//                       {showPassword ? (
//                         <EyeOff className="h-4 w-4" />
//                       ) : (
//                         <Eye className="h-4 w-4" />
//                       )}
//                     </button>
//                   </div>
//                   <p className="text-xs text-gray-500">
//                     Use pelo menos 6 caracteres
//                   </p>
//                 </Field>
// 
//                 <Field>
//                   <FieldLabel htmlFor="settings-security-confirm-new-password">
//                     Confirmar nova senha
//                   </FieldLabel>
//                   <div className="relative">
//                     <Input
//                       id="settings-security-confirm-new-password"
//                       type={showPassword ? "text" : "password"}
//                       value={confirmNewPassword}
//                       onChange={event =>
//                         setConfirmNewPassword(event.target.value)
//                       }
//                       placeholder="Repita a nova senha"
//                       autoComplete="new-password"
//                       disabled={isVerifyingPassword}
//                     />
//                     <button
//                       type="button"
//                       onClick={() => setShowPassword(v => !v)}
//                       className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                       tabIndex={-1}
//                     >
//                       {showPassword ? (
//                         <EyeOff className="h-4 w-4" />
//                       ) : (
//                         <Eye className="h-4 w-4" />
//                       )}
//                     </button>
//                   </div>
//                 </Field>
//               </FieldGroup>
// 
//               <Button
//                 type="submit"
//                 disabled={
//                   isVerifyingPassword || !newPassword || !confirmNewPassword
//                 }
//                 className="w-60 mx-auto rounded-full"
//               >
//                 Alterar senha
//               </Button>
//             </form>
//           </CardContent>
//         </Card>
//       </div>
// 
//       <PasswordConfirmModal
//         key={pendingAction ?? "security-action"}
//         open={showPasswordModal}
//         onClose={handleClosePasswordModal}
//         onConfirm={handlePasswordConfirm}
//         onClearError={handleClearPasswordError}
//         title={
//           pendingAction === "password"
//             ? "Confirmar alteração de senha"
//             : "Confirmar alteração de email"
//         }
//         description={passwordModalDescription}
//         isLoading={isVerifyingPassword}
//         errorMessage={passwordError}
//       />
// 
//       <EmailChangeConfirmationModal
//         open={showConfirmationModal}
//         newEmail={emailToConfirm}
//         onClose={handleCloseConfirmationModal}
//       />
//     </>
//   );
// }
