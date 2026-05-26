// import { useEffect, useState } from "react";
// import { useForm, Controller, useWatch } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import { toast } from "sonner";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
//   DialogDescription,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Label } from "@/components/ui/label";
// import {
//   Field,
//   FieldError,
//   FieldGroup,
//   FieldLabel,
// } from "@/components/ui/field";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { ImageCropper } from "@/components/ui/image-cropped";
// import { Trash2 } from "lucide-react";
// import { updateBarber } from "@/lib/supabase/barbers/update-barber";
// import { deleteBarber } from "@/lib/supabase/barbers/delete-barber";
// import { useBarbershopServices } from "@/hooks/use-barbershop-services";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { supabase } from "@/lib/supabase/supabase";
// import {
//   useBarberAvailability,
//   saveBarberAvailability,
// } from "@/hooks/use-barber-availability";
// import { AvailabilitySection } from "@/components/modals/manage-team/availability-section";
// import { validateAvailability } from "@/utils/validate-availability.constants";
// import type { Barber } from "@/types/barber";
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
// import { useFutureAppointmentsCount } from "@/hooks/use-future-appointments-count";
// 
// const formSchema = z.object({
//   name: z.string().min(1, "Nome é obrigatório"),
//   serviceIds: z.array(z.string()),
// });
// 
// type FormValues = z.infer<typeof formSchema>;
// 
// interface UpdateBarberModalProps {
//   open: boolean;
//   barber: Barber | null;
//   onClose: () => void;
//   onUpdated: (barber: Barber) => void;
//   onDeleted: (id: string) => void;
// }
// 
// export function UpdateBarberModal({
//   open,
//   barber,
//   onClose,
//   onUpdated,
//   onDeleted,
// }: UpdateBarberModalProps) {
//   const { barbershop } = useBarbershopStore();
//   const { services } = useBarbershopServices();
//   const [avatarFile, setAvatarFile] = useState<File | null>(null);
//   const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
//   const [removeAvatar, setRemoveAvatar] = useState(false);
//   const [cropperOpen, setCropperOpen] = useState(false);
//   const [cropperImageUrl, setCropperImageUrl] = useState("");
//   const [deleting, setDeleting] = useState(false);
//   const [availabilityErrors, setAvailabilityErrors] = useState<
//     Record<string, string>
//   >({});
//   const { count: futureCount, loading: countLoading } =
//     useFutureAppointmentsCount("barber_id", open ? (barber?.id ?? null) : null);
// 
//   const {
//     availability,
//     setAvailability,
//     loading: loadingAvailability,
//   } = useBarberAvailability(open ? (barber?.id ?? null) : null);
// 
//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { name: "", serviceIds: [] },
//   });
// 
//   const watchedName = useWatch({ control: form.control, name: "name" });
// 
//   useEffect(() => {
//     if (!barber) return;
//     supabase
//       .from("barber_services")
//       .select("service_id")
//       .eq("barber_id", barber.id)
//       .then(({ data }) => {
//         form.reset({
//           name: barber.name,
//           serviceIds: data?.map(d => d.service_id) ?? [],
//         });
//         setAvatarPreview(barber.avatar_url);
//         setAvatarFile(null);
//         setRemoveAvatar(false);
//       });
//   }, [barber, form]);
// 
//   function handleAvailabilityChange(next: typeof availability) {
//     setAvailability(next);
//     setAvailabilityErrors(validateAvailability(next));
//   }
// 
//   function clearError(key: string) {
//     setAvailabilityErrors(prev => {
//       const e = { ...prev };
//       delete e[key];
//       return e;
//     });
//   }
// 
//   async function onSubmit(data: FormValues) {
//     if (!barber || !barbershop?.id) return;
// 
//     const errors = validateAvailability(availability);
//     if (Object.keys(errors).length > 0) {
//       setAvailabilityErrors(errors);
//       toast.error("Corrija os horários destacados em vermelho.");
//       return;
//     }
// 
//     let avatarUrl = barber.avatar_url;
// 
//     if (removeAvatar && barber.avatar_url) {
//       const folder = `${barbershop.owner_id}/barbers/`;
//       const { data: files } = await supabase.storage
//         .from("barbershop-assets")
//         .list(folder);
//       const matches = files?.filter(f => f.name.startsWith(barber.id)) ?? [];
//       if (matches.length > 0) {
//         await supabase.storage
//           .from("barbershop-assets")
//           .remove(matches.map(f => `${folder}${f.name}`));
//       }
//       avatarUrl = null;
//       await supabase
//         .from("barbers")
//         .update({ avatar_url: null })
//         .eq("id", barber.id);
//     }
// 
//     if (avatarFile) {
//       const fileExt = avatarFile.name.split(".").pop();
//       const filePath = `${barbershop.owner_id}/barbers/${barber.id}.${fileExt}`;
//       const { data: uploaded } = await supabase.storage
//         .from("barbershop-assets")
//         .upload(filePath, avatarFile, { upsert: true });
// 
//       if (uploaded) {
//         const { data: urlData } = await supabase.storage
//           .from("barbershop-assets")
//           .createSignedUrl(filePath, 60 * 60 * 24 * 365);
//         if (urlData) {
//           avatarUrl = urlData.signedUrl;
//           await supabase
//             .from("barbers")
//             .update({ avatar_url: avatarUrl })
//             .eq("id", barber.id);
//         }
//       }
//     }
// 
//     const success = await updateBarber({
//       id: barber.id,
//       name: data.name,
//       serviceIds: data.serviceIds,
//     });
// 
//     if (!success) {
//       toast.error("Erro ao atualizar barbeiro");
//       return;
//     }
// 
//     await saveBarberAvailability(barber.id, barbershop.id, availability);
// 
//     toast.success("Barbeiro atualizado!");
//     onUpdated({ ...barber, name: data.name, avatar_url: avatarUrl });
//     onClose();
//   }
// 
//   async function handleDelete() {
//     if (!barber) return;
//     setDeleting(true);
//     const success = await deleteBarber(barber.id);
// 
//     if (!success) {
//       setDeleting(false);
//       toast.error("Erro ao excluir barbeiro");
//       return;
//     }
// 
//     if (barber.avatar_url && barbershop) {
//       const folder = `${barbershop.owner_id}/barbers/`;
//       const { data: files } = await supabase.storage
//         .from("barbershop-assets")
//         .list(folder);
//       const matches = files?.filter(f => f.name.startsWith(barber.id)) ?? [];
//       if (matches.length > 0) {
//         await supabase.storage
//           .from("barbershop-assets")
//           .remove(matches.map(f => `${folder}${f.name}`));
//       }
//     }
// 
//     setDeleting(false);
//     toast.success("Barbeiro excluído!");
//     onDeleted(barber.id);
//     onClose();
//   }
// 
//   return (
//     <>
//       <Dialog open={open} onOpenChange={o => !o && onClose()}>
//         <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
//           <DialogHeader>
//             <DialogTitle className="mb-4">Editar barbeiro</DialogTitle>
//           </DialogHeader>
//           <DialogDescription className="sr-only">
//             Editar barbeiro
//           </DialogDescription>
//           <form
//             id="update-barber-form"
//             onSubmit={form.handleSubmit(onSubmit)}
//             className="flex flex-col gap-6 mb-4"
//           >
//             {/* Avatar */}
//             <div className="flex items-center gap-4">
//               <Avatar className="h-23 w-23 md:h-35 md:w-35">
//                 <AvatarImage src={avatarPreview ?? undefined} />
//                 <AvatarFallback>
//                   {watchedName?.slice(0, 2).toUpperCase() || "BB"}
//                 </AvatarFallback>
//               </Avatar>
//               <div className="flex flex-col gap-1">
//                 <Button
//                   className="rounded-full"
//                   type="button"
//                   size="sm"
//                   onClick={() =>
//                     document.getElementById("update-barber-avatar")?.click()
//                   }
//                 >
//                   Alterar foto
//                 </Button>
//                 {avatarPreview && (
//                   <Button
//                     type="button"
//                     size="sm"
//                     variant="ghost"
//                     className="rounded-full text-destructive hover:text-destructive"
//                     onClick={() => {
//                       setAvatarPreview(null);
//                       setAvatarFile(null);
//                       setRemoveAvatar(true);
//                     }}
//                   >
//                     Remover foto
//                   </Button>
//                 )}
//                 <input
//                   id="update-barber-avatar"
//                   type="file"
//                   accept="image/*"
//                   className="hidden"
//                   onChange={e => {
//                     const file = e.target.files?.[0];
//                     if (!file) return;
//                     setCropperImageUrl(URL.createObjectURL(file));
//                     setCropperOpen(true);
//                     e.target.value = "";
//                   }}
//                 />
//               </div>
//             </div>
// 
//             {/* Nome */}
//             <FieldGroup>
//               <Controller
//                 name="name"
//                 control={form.control}
//                 render={({ field, fieldState }) => (
//                   <Field data-invalid={fieldState.invalid}>
//                     <FieldLabel htmlFor="update-barber-name">Nome</FieldLabel>
//                     <Input
//                       {...field}
//                       id="update-barber-name"
//                       placeholder="Nome do barbeiro"
//                       aria-invalid={fieldState.invalid}
//                     />
//                     {fieldState.invalid && (
//                       <FieldError errors={[fieldState.error]} />
//                     )}
//                   </Field>
//                 )}
//               />
//             </FieldGroup>
// 
//             {/* Serviços */}
//             {services.length > 0 && (
//               <div className="flex flex-col gap-2">
//                 <Label>Serviços</Label>
//                 <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
//                   {services.map(service => (
//                     <Controller
//                       key={service.id}
//                       name="serviceIds"
//                       control={form.control}
//                       render={({ field }) => (
//                         <div className="flex items-center gap-2">
//                           <Checkbox
//                             id={`update-service-${service.id}`}
//                             checked={field.value.includes(service.id)}
//                             onCheckedChange={checked => {
//                               field.onChange(
//                                 checked
//                                   ? [...field.value, service.id]
//                                   : field.value.filter(id => id !== service.id),
//                               );
//                             }}
//                           />
//                           <label
//                             htmlFor={`update-service-${service.id}`}
//                             className="text-sm cursor-pointer"
//                           >
//                             {service.name}
//                           </label>
//                         </div>
//                       )}
//                     />
//                   ))}
//                 </div>
//               </div>
//             )}
// 
//             {/* Disponibilidade */}
//             {loadingAvailability ? (
//               <span className="text-xs text-muted-foreground">
//                 Carregando disponibilidade...
//               </span>
//             ) : (
//               <AvailabilitySection
//                 availability={availability}
//                 onChange={handleAvailabilityChange}
//                 errors={availabilityErrors}
//                 onClearError={clearError}
//               />
//             )}
//           </form>
// 
//           <DialogFooter
//             style={{ justifyContent: "space-between" }}
//             className="flex-row flex-wrap items-center justify-between gap-2"
//           >
//             <div className="flex gap-2 w-full justify-center order-first sm:order-last sm:w-auto">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={onClose}
//                 className="rounded-full"
//               >
//                 Cancelar
//               </Button>
//               <Button
//                 className="rounded-full"
//                 type="submit"
//                 form="update-barber-form"
//                 disabled={form.formState.isSubmitting}
//               >
//                 {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
//               </Button>
//             </div>
//             <AlertDialog>
//               <AlertDialogTrigger asChild className="flex">
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="sm"
//                   className="text-destructive mx-auto sm:mx-0 hover:text-destructive cursor-pointer order-last sm:order-first"
//                 >
//                   <Trash2 className="h-4 w-4 mr-1" />
//                   Excluir
//                 </Button>
//               </AlertDialogTrigger>
//               <AlertDialogContent>
//                 <AlertDialogHeader>
//                   <AlertDialogTitle>
//                     {!countLoading && futureCount > 0
//                       ? "Conflito com agenda"
//                       : "Excluir barbeiro?"}
//                   </AlertDialogTitle>
//                   <AlertDialogDescription asChild>
//                     <div className="flex flex-col gap-2 mt-2">
//                       {!countLoading && futureCount > 0 ? (
//                         <span className="text-orange-500 font-medium">
//                           ⚠️ Existem {futureCount} agendamento
//                           {futureCount !== 1 ? "s" : ""} futuro
//                           {futureCount !== 1 ? "s" : ""} vinculado
//                           {futureCount !== 1 ? "s" : ""} a este barbeiro.
//                           Cancele-os antes de excluir.
//                         </span>
//                       ) : (
//                         <span>
//                           Essa ação não pode ser desfeita. O barbeiro será
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
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
// 
//       <ImageCropper
//         open={cropperOpen}
//         imageUrl={cropperImageUrl}
//         aspect={1}
//         cropShape="round"
//         onConfirm={file => {
//           setAvatarFile(file);
//           setAvatarPreview(URL.createObjectURL(file));
//           setCropperOpen(false);
//         }}
//         onCancel={() => setCropperOpen(false)}
//       />
//     </>
//   );
// }
