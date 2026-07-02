// import { useEffect, useState } from "react";
// import { useForm, Controller, type Resolver } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import { toast } from "sonner";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Field,
//   FieldError,
//   FieldGroup,
//   FieldLabel,
// } from "@/components/ui/field";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
//   AlertDialogTrigger,
// } from "@/components/ui/alert-dialog";
// import { Trash2 } from "lucide-react";
// import { updateCustomer } from "@/lib/supabase/customers/update-customer";
// import { deleteCustomer } from "@/lib/supabase/customers/delete-customer";
// import type { Customer } from "@/types/customer";
// import { maskPhone } from "@/utils/masked-input-phone";
// import { CustomerConflictModal } from "./customer-conflict-modal";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { useFutureAppointmentsCount } from "@/hooks/use-future-appointments-count";
//
// const formSchema = z.object({
//   name: z.string().min(1, "Nome e obrigatorio"),
//   phone: z
//     .string()
//     .min(1, "Telefone e obrigatorio")
//     .regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Formato inválido: (XX) XXXXX-XXXX"),
// });
//
// type FormValues = z.infer<typeof formSchema>;
//
// interface UpdateCustomerModalProps {
//   open: boolean;
//   customer: Customer | null;
//   onClose: () => void;
//   onUpdated: (customer: Customer) => void;
//   onDeleted: (id: string) => void;
//   onEditExisting?: (customer: Customer) => void;
// }
//
// export function UpdateCustomerModal({
//   open,
//   customer,
//   onClose,
//   onUpdated,
//   onDeleted,
//   onEditExisting,
// }: UpdateCustomerModalProps) {
//   const { barbershop } = useBarbershopStore();
//   const [deleting, setDeleting] = useState(false);
//   const [conflictCustomer, setConflictCustomer] = useState<Customer | null>(
//     null,
//   );
//   const [conflictOpen, setConflictOpen] = useState(false);
//   const customerField =
//     customer?.source === "customers_auth"
//       ? "customer_id"
//       : "manual_customer_id";
//   const { count: futureCount, loading: countLoading } =
//     useFutureAppointmentsCount(
//       customerField,
//       open ? (customer?.id ?? null) : null,
//     );
//
//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema) as Resolver<FormValues>,
//     defaultValues: { name: "", phone: "" },
//   });
//
//   useEffect(() => {
//     if (!customer) return;
//
//     Promise.resolve().then(() => {
//       form.reset({
//         name: customer.name,
//         phone: maskPhone(customer.phone ?? ""),
//       });
//     });
//   }, [customer, form]);
//
//   async function onSubmit(data: FormValues) {
//     if (!customer || !barbershop?.id) return;
//
//     const result = await updateCustomer({
//       id: customer.id,
//       barbershopId: barbershop.id,
//       name: data.name,
//       phone: data.phone,
//     });
//
//     if (result.status === "conflict") {
//       setConflictCustomer(result.existing);
//       setConflictOpen(true);
//       return;
//     }
//
//     if (result.status === "error") {
//       toast.error("Erro ao atualizar cliente.");
//       return;
//     }
//
//     toast.success("Cliente atualizado!");
//     onUpdated({ ...customer, name: data.name, phone: data.phone });
//     onClose();
//   }
//
//   async function handleDelete() {
//     if (!customer) return;
//
//     setDeleting(true);
//     const result = await deleteCustomer(customer.id);
//     setDeleting(false);
//
//     if (result.status === "conflict") {
//       toast.error(
//         "Este cliente possui agendamentos vinculados e nao pode ser excluido.",
//       );
//       return;
//     }
//
//     if (result.status !== "deleted") {
//       toast.error("Erro ao excluir cliente.");
//       return;
//     }
//
//     toast.success("Cliente excluido!");
//     onDeleted(customer.id);
//     onClose();
//   }
//
//   return (
//     <>
//       <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
//         <DialogContent className="max-w-md w-[calc(100%-2rem)]">
//           <DialogHeader>
//             <DialogTitle className="mb-4">Editar cliente</DialogTitle>
//           </DialogHeader>
//           <DialogDescription className="sr-only">
//             Editar cliente
//           </DialogDescription>
//
//           <form
//             id="update-customer-form"
//             onSubmit={form.handleSubmit(onSubmit)}
//             className="mb-4 flex flex-col gap-6"
//           >
//             <FieldGroup>
//               <Controller
//                 name="name"
//                 control={form.control}
//                 render={({ field, fieldState }) => (
//                   <Field data-invalid={fieldState.invalid}>
//                     <FieldLabel htmlFor="update-customer-name">Nome</FieldLabel>
//                     <Input
//                       {...field}
//                       id="update-customer-name"
//                       placeholder="Nome do cliente"
//                       aria-invalid={fieldState.invalid}
//                     />
//                     {fieldState.invalid && (
//                       <FieldError errors={[fieldState.error]} />
//                     )}
//                   </Field>
//                 )}
//               />
//
//               <Controller
//                 name="phone"
//                 control={form.control}
//                 render={({ field, fieldState }) => (
//                   <Field data-invalid={fieldState.invalid}>
//                     <FieldLabel htmlFor="update-customer-phone">
//                       Telefone
//                     </FieldLabel>
//                     <Input
//                       {...field}
//                       id="update-customer-phone"
//                       placeholder="(51) 99999-9999"
//                       aria-invalid={fieldState.invalid}
//                       onChange={event =>
//                         field.onChange(maskPhone(event.target.value))
//                       }
//                     />
//                     {fieldState.invalid && (
//                       <FieldError errors={[fieldState.error]} />
//                     )}
//                   </Field>
//                 )}
//               />
//             </FieldGroup>
//           </form>
//
//           <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
//             <AlertDialog>
//               <AlertDialogTrigger asChild>
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="sm"
//                   className="cursor-pointer text-destructive hover:text-destructive"
//                 >
//                   <Trash2 className="mr-1 h-4 w-4" />
//                   Excluir
//                 </Button>
//               </AlertDialogTrigger>
//               <AlertDialogContent>
//                 <AlertDialogHeader>
//                   <AlertDialogTitle>
//                     {!countLoading && futureCount > 0
//                       ? "Conflito com agenda"
//                       : "Excluir cliente?"}
//                   </AlertDialogTitle>
//                   <AlertDialogDescription asChild>
//                     <div className="mt-2 flex flex-col gap-2">
//                       {!countLoading && futureCount > 0 ? (
//                         <span className="font-medium text-orange-500">
//                           Existem {futureCount} agendamento
//                           {futureCount !== 1 ? "s" : ""} futuro
//                           {futureCount !== 1 ? "s" : ""} vinculado
//                           {futureCount !== 1 ? "s" : ""} a este cliente.
//                           Cancele-os antes de excluir.
//                         </span>
//                       ) : (
//                         <span>
//                           Essa acao nao pode ser desfeita. O cliente sera
//                           removido permanentemente.
//                         </span>
//                       )}
//                     </div>
//                   </AlertDialogDescription>
//                 </AlertDialogHeader>
//                 <AlertDialogFooter>
//                   <AlertDialogCancel>Voltar</AlertDialogCancel>
//                   {futureCount === 0 && (
//                     <AlertDialogAction
//                       onClick={handleDelete}
//                       disabled={deleting || countLoading}
//                       className="bg-destructive hover:bg-destructive/90"
//                     >
//                       {deleting ? "Excluindo..." : "Excluir"}
//                     </AlertDialogAction>
//                   )}
//                 </AlertDialogFooter>
//               </AlertDialogContent>
//             </AlertDialog>
//
//             <div className="flex gap-2">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={onClose}
//                 className="rounded-full"
//               >
//                 Cancelar
//               </Button>
//               <Button
//                 type="submit"
//                 form="update-customer-form"
//                 disabled={form.formState.isSubmitting}
//                 className="rounded-full"
//               >
//                 {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
//               </Button>
//             </div>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//
//       <CustomerConflictModal
//         open={conflictOpen}
//         customer={conflictCustomer}
//         onClose={() => {
//           setConflictOpen(false);
//           setConflictCustomer(null);
//         }}
//         onEdit={existing => {
//           setConflictOpen(false);
//           setConflictCustomer(null);
//           onClose();
//           onEditExisting?.(existing);
//         }}
//         onDelete={async existing => {
//           const result = await deleteCustomer(existing.id);
//
//           if (result.status === "deleted") {
//             setConflictOpen(false);
//             setConflictCustomer(null);
//             onDeleted(existing.id);
//             toast.success(
//               "Cliente excluido. Agora voce pode salvar novamente.",
//             );
//             return;
//           }
//
//           if (result.status === "conflict") {
//             toast.error(
//               "Este cliente possui agendamentos vinculados e nao pode ser excluido.",
//             );
//             return;
//           }
//
//           toast.error("Erro ao excluir cliente.");
//         }}
//       />
//     </>
//   );
// }
