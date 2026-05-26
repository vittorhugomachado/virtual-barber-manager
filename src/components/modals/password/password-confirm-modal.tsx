// // components/modals/password/password-confirm-modal.tsx
// import { useState } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
// import { Eye, EyeOff, Lock } from "lucide-react";
// 
// interface PasswordConfirmModalProps {
//   open: boolean;
//   onClose: () => void;
//   onConfirm: (password: string) => Promise<void>;
//   onClearError?: () => void;
//   title?: string;
//   description?: string;
//   isLoading?: boolean;
//   errorMessage?: string | undefined | null;
// }
// 
// export function PasswordConfirmModal({
//   open,
//   onClose,
//   onConfirm,
//   onClearError,
//   title = "Confirmar senha",
//   description = "Por segurança, digite sua senha para continuar",
//   isLoading = false,
//   errorMessage,
// }: PasswordConfirmModalProps) {
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [localError, setLocalError] = useState<string | null>(null);
// 
//   // Usa erro local ou erro externo
//   const displayError = localError || errorMessage;
// 
//   const handleConfirm = async () => {
//     if (!password) {
//       setLocalError("Senha é obrigatória");
//       return;
//     }
// 
//     setLocalError(null);
//     try {
//       await onConfirm(password);
//       // Só limpa se for bem sucedido
//       setPassword("");
//       setShowPassword(false);
//     } catch (err) {
//       console.error("Erro na confirmação:", err);
//     }
//   };
// 
//   const handleClose = () => {
//     // Limpa tudo ao fechar
//     setPassword("");
//     setShowPassword(false);
//     setLocalError(null);
//     if (onClearError) {
//       onClearError();
//     }
//     onClose();
//   };
// 
//   // Limpa TODOS os erros quando o usuário digita
//   const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setPassword(e.target.value);
//     setLocalError(null);
//     if (onClearError) {
//       onClearError();
//     }
//   };
// 
//   // Reseta o estado quando o modal abre usando key prop no pai
//   // Em vez de useEffect, usamos um padrão de reset via key
// 
//   return (
//     <Dialog open={open} onOpenChange={o => !o && handleClose()}>
//       <DialogContent className="max-w-md w-[calc(100%-2rem)]">
//         <DialogHeader className="text-center flex flex-col items-center">
//           <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
//             <Lock className="h-6 w-6 text-[#0458EE]" />
//           </div>
//           <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
//           <DialogDescription className="text-center mt-2 whitespace-pre-line">
//             {description}
//           </DialogDescription>
//         </DialogHeader>
// 
//         <div className="mt-4">
//           <FieldGroup>
//             <Field>
//               <FieldLabel htmlFor="password-confirm">Senha</FieldLabel>
//               <div className="relative">
//                 <Input
//                   id="password-confirm"
//                   type={showPassword ? "text" : "password"}
//                   value={password}
//                   onChange={handlePasswordChange}
//                   placeholder="Digite sua senha"
//                   disabled={isLoading}
//                   className={`pr-10 ${displayError ? "border-red-500" : ""}`}
//                   onKeyDown={e => {
//                     if (e.key === "Enter" && !isLoading) {
//                       handleConfirm();
//                     }
//                   }}
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
//                   disabled={isLoading}
//                 >
//                   {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//                 </button>
//               </div>
//               {displayError && (
//                 <p className="text-sm text-red-500 mt-1">{displayError}</p>
//               )}
//             </Field>
//           </FieldGroup>
//         </div>
// 
//         <DialogFooter className="mt-6 gap-2">
//           <Button
//             type="button"
//             variant="outline"
//             onClick={handleClose}
//             disabled={isLoading}
//             className="rounded-full"
//           >
//             Cancelar
//           </Button>
//           <Button
//             type="button"
//             onClick={handleConfirm}
//             disabled={isLoading}
//             className="rounded-full bg-[#0458EE] hover:bg-[#0458EE]/90"
//           >
//             {isLoading ? "Verificando..." : "Confirmar"}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }
