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
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { Checkbox } from "@/components/ui/checkbox";
// import {
//   Field,
//   FieldError,
//   FieldGroup,
//   FieldLabel,
// } from "@/components/ui/field";
// import { ImageCropper } from "@/components/ui/image-cropped";
// import { updateService } from "@/lib/supabase/services/update-service";
// import { deleteService } from "@/lib/supabase/services/delete-service";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { useBarbers } from "@/hooks/use-barbers";
// import { supabase } from "@/lib/supabase/supabase";
// import type { Service } from "@/types/services";
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
// import { useFutureAppointmentsCount } from "@/hooks/use-future-appointments-count";
// 
// function formatPriceInput(value?: number) {
//   if (value == null || Number.isNaN(value)) return "";
//   return value.toLocaleString("pt-BR", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   });
// }
// 
// function parsePriceInput(value: string) {
//   const digits = value.replace(/\D/g, "");
//   if (!digits) return undefined;
//   return Number(digits) / 100;
// }
// 
// const formSchema = z.object({
//   name: z.string().min(1, "Nome e obrigatorio"),
//   description: z
//     .string()
//     .max(100, "Descricao deve ter no maximo 100 caracteres")
//     .optional(),
//   price: z.number({ error: "Preco e obrigatorio" }).min(0, "Preco invalido"),
//   duration_min: z
//     .number({ error: "Duracao e obrigatoria" })
//     .min(1, "Duracao invalida"),
//   barberIds: z.array(z.string()),
// });
// 
// type FormValues = z.infer<typeof formSchema>;
// 
// interface UpdateServiceModalProps {
//   open: boolean;
//   service: Service | null;
//   onClose: () => void;
//   onUpdated: (service: Service) => void;
//   onDeleted: (id: string) => void;
// }
// 
// export function UpdateServiceModal({
//   open,
//   service,
//   onClose,
//   onUpdated,
//   onDeleted,
// }: UpdateServiceModalProps) {
//   const { barbershop } = useBarbershopStore();
//   const { barbers } = useBarbers();
//   const [imageFile, setImageFile] = useState<File | null>(null);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);
//   const [removeImage, setRemoveImage] = useState(false);
//   const [cropperOpen, setCropperOpen] = useState(false);
//   const [cropperImageUrl, setCropperImageUrl] = useState("");
//   const [deleting, setDeleting] = useState(false);
//   const { count: futureCount, loading: countLoading } =
//     useFutureAppointmentsCount(
//       "service_id",
//       open ? (service?.id ?? null) : null,
//     );
// 
//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema) as Resolver<FormValues>,
//     defaultValues: {
//       name: "",
//       description: "",
//       price: undefined,
//       duration_min: undefined,
//       barberIds: [],
//     },
//   });
// 
//   useEffect(() => {
//     if (!service) return;
// 
//     supabase
//       .from("barber_services")
//       .select("barber_id")
//       .eq("service_id", service.id)
//       .then(({ data }) => {
//         form.reset({
//           name: service.name,
//           description: service.description ?? "",
//           price: service.price ?? undefined,
//           duration_min: service.duration_min ?? undefined,
//           barberIds: data?.map(item => item.barber_id) ?? [],
//         });
//         setImagePreview(service.image_url);
//         setImageFile(null);
//         setRemoveImage(false);
//       });
//   }, [service, form]);
// 
//   async function deleteStorageImage(serviceId: string) {
//     const folder = `${barbershop!.owner_id}/services/`;
//     const { data: files } = await supabase.storage
//       .from("barbershop-assets")
//       .list(folder);
//     const matches =
//       files?.filter(file => file.name.startsWith(serviceId)) ?? [];
//     if (matches.length > 0) {
//       await supabase.storage
//         .from("barbershop-assets")
//         .remove(matches.map(file => `${folder}${file.name}`));
//     }
//   }
// 
//   async function onSubmit(data: FormValues) {
//     if (!service || !barbershop?.id) return;
// 
//     let imageUrl = service.image_url;
// 
//     if (removeImage && service.image_url) {
//       await deleteStorageImage(service.id);
//       imageUrl = null;
//       await supabase
//         .from("services")
//         .update({ image_url: null })
//         .eq("id", service.id);
//     }
// 
//     if (imageFile) {
//       const fileExt = imageFile.name.split(".").pop();
//       const filePath = `${barbershop.owner_id}/services/${service.id}.${fileExt}`;
//       const { data: uploaded } = await supabase.storage
//         .from("barbershop-assets")
//         .upload(filePath, imageFile, { upsert: true });
// 
//       if (uploaded) {
//         const { data: urlData } = await supabase.storage
//           .from("barbershop-assets")
//           .createSignedUrl(filePath, 60 * 60 * 24 * 365);
//         if (urlData) {
//           imageUrl = urlData.signedUrl;
//           await supabase
//             .from("services")
//             .update({ image_url: imageUrl })
//             .eq("id", service.id);
//         }
//       }
//     }
// 
//     const success = await updateService({
//       id: service.id,
//       name: data.name,
//       description: data.description,
//       price: data.price,
//       duration_min: data.duration_min,
//     });
// 
//     if (!success) {
//       toast.error("Erro ao atualizar servico");
//       return;
//     }
// 
//     await supabase
//       .from("barber_services")
//       .delete()
//       .eq("service_id", service.id);
// 
//     if (data.barberIds.length > 0) {
//       await supabase.from("barber_services").insert(
//         data.barberIds.map(barberId => ({
//           barber_id: barberId,
//           service_id: service.id,
//         })),
//       );
//     }
// 
//     toast.success("Servico atualizado!");
//     onUpdated({
//       ...service,
//       name: data.name,
//       description: data.description ?? null,
//       price: data.price ?? null,
//       duration_min: data.duration_min ?? null,
//       image_url: imageUrl,
//     });
//     onClose();
//   }
// 
//   async function handleDelete() {
//     if (!service) return;
//     setDeleting(true);
//     const success = await deleteService(service.id);
// 
//     if (!success) {
//       setDeleting(false);
//       toast.error("Erro ao excluir servico");
//       return;
//     }
// 
//     if (service.image_url && barbershop) {
//       await deleteStorageImage(service.id);
//     }
// 
//     setDeleting(false);
//     toast.success("Servico excluido!");
//     onDeleted(service.id);
//     onClose();
//   }
// 
//   return (
//     <>
//       <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
//         <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
//           <DialogHeader>
//             <DialogTitle className="mb-4">Editar servico</DialogTitle>
//           </DialogHeader>
//           <DialogDescription className="sr-only">
//             Editar servico
//           </DialogDescription>
//           <form
//             id="update-service-form"
//             onSubmit={form.handleSubmit(onSubmit, errors => {
//               const first = Object.values(errors)[0];
//               if (first?.message) toast.error(first.message as string);
//             })}
//             className="mb-4 flex flex-col gap-6 px-1"
//           >
//             <div className="flex items-center gap-4">
//               <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
//                 {imagePreview ? (
//                   <img
//                     src={imagePreview}
//                     alt="preview"
//                     className="h-full w-full object-cover"
//                   />
//                 ) : (
//                   <div className="flex h-full w-full items-center justify-center px-1 text-center text-xs text-muted-foreground">
//                     Sem imagem
//                   </div>
//                 )}
//               </div>
//               <div className="flex flex-col gap-1">
//                 <Button
//                   className="rounded-full"
//                   type="button"
//                   size="sm"
//                   onClick={() =>
//                     document.getElementById("update-service-image")?.click()
//                   }
//                 >
//                   Alterar imagem
//                 </Button>
//                 {imagePreview && (
//                   <Button
//                     type="button"
//                     size="sm"
//                     variant="ghost"
//                     className="rounded-full text-destructive hover:text-destructive"
//                     onClick={() => {
//                       setImagePreview(null);
//                       setImageFile(null);
//                       setRemoveImage(true);
//                     }}
//                   >
//                     Remover foto
//                   </Button>
//                 )}
//                 <input
//                   id="update-service-image"
//                   type="file"
//                   accept="image/*"
//                   className="hidden"
//                   onChange={event => {
//                     const file = event.target.files?.[0];
//                     if (!file) return;
//                     setCropperImageUrl(URL.createObjectURL(file));
//                     setCropperOpen(true);
//                     event.target.value = "";
//                   }}
//                 />
//               </div>
//             </div>
// 
//             <FieldGroup>
//               <Controller
//                 name="name"
//                 control={form.control}
//                 render={({ field, fieldState }) => (
//                   <Field data-invalid={fieldState.invalid}>
//                     <FieldLabel htmlFor="update-service-name">Nome</FieldLabel>
//                     <Input
//                       {...field}
//                       id="update-service-name"
//                       placeholder="Ex: Corte degrade"
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
//                 name="description"
//                 control={form.control}
//                 render={({ field, fieldState }) => (
//                   <Field data-invalid={fieldState.invalid}>
//                     <div className="flex items-center justify-between">
//                       <FieldLabel htmlFor="update-service-description">
//                         Descrição
//                       </FieldLabel>
//                       <span
//                         className={`text-xs ${(field.value?.length ?? 0) > 100 ? "text-destructive" : "text-muted-foreground"}`}
//                       >
//                         {field.value?.length ?? 0}/100
//                       </span>
//                     </div>
//                     <Textarea
//                       {...field}
//                       id="update-service-description"
//                       placeholder="Descreva o servico..."
//                       aria-invalid={fieldState.invalid}
//                       maxLength={100}
//                     />
//                     {fieldState.invalid && (
//                       <FieldError errors={[fieldState.error]} />
//                     )}
//                   </Field>
//                 )}
//               />
// 
//               <div className="grid grid-cols-2 gap-3">
//                 <Controller
//                   name="price"
//                   control={form.control}
//                   render={({ field, fieldState }) => (
//                     <Field data-invalid={fieldState.invalid}>
//                       <FieldLabel htmlFor="update-service-price">
//                         Preço
//                       </FieldLabel>
//                       <div className="relative">
//                         <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
//                           R$
//                         </span>
//                         <Input
//                           name={field.name}
//                           ref={field.ref}
//                           value={formatPriceInput(field.value)}
//                           onBlur={field.onBlur}
//                           onChange={event =>
//                             field.onChange(parsePriceInput(event.target.value))
//                           }
//                           id="update-service-price"
//                           type="text"
//                           inputMode="numeric"
//                           placeholder="0,00"
//                           className="pl-10"
//                           aria-invalid={fieldState.invalid}
//                         />
//                       </div>
//                       {fieldState.invalid && (
//                         <FieldError errors={[fieldState.error]} />
//                       )}
//                     </Field>
//                   )}
//                 />
// 
//                 <Controller
//                   name="duration_min"
//                   control={form.control}
//                   render={({ field, fieldState }) => (
//                     <Field data-invalid={fieldState.invalid}>
//                       <FieldLabel htmlFor="update-service-duration">
//                         Duração
//                       </FieldLabel>
//                       <div className="relative">
//                         <Input
//                           {...field}
//                           value={field.value ?? ""}
//                           onChange={event =>
//                             field.onChange(
//                               event.target.value === ""
//                                 ? undefined
//                                 : Number(event.target.value),
//                             )
//                           }
//                           id="update-service-duration"
//                           type="number"
//                           min="1"
//                           placeholder="30"
//                           className="pr-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
//                           aria-invalid={fieldState.invalid}
//                         />
//                         <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
//                           minutos
//                         </span>
//                       </div>
//                       {fieldState.invalid && (
//                         <FieldError errors={[fieldState.error]} />
//                       )}
//                     </Field>
//                   )}
//                 />
//               </div>
//             </FieldGroup>
// 
//             {barbers.length > 0 && (
//               <div className="flex flex-col gap-2">
//                 <Label>Barbeiros</Label>
//                 <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
//                   {barbers.map(barber => (
//                     <Controller
//                       key={barber.id}
//                       name="barberIds"
//                       control={form.control}
//                       render={({ field }) => (
//                         <div className="flex items-center gap-2">
//                           <Checkbox
//                             id={`update-barber-${barber.id}`}
//                             checked={field.value.includes(barber.id)}
//                             onCheckedChange={checked => {
//                               field.onChange(
//                                 checked
//                                   ? [...field.value, barber.id]
//                                   : field.value.filter(id => id !== barber.id),
//                               );
//                             }}
//                           />
//                           <label
//                             htmlFor={`update-barber-${barber.id}`}
//                             className="cursor-pointer text-sm"
//                           >
//                             {barber.name}
//                           </label>
//                         </div>
//                       )}
//                     />
//                   ))}
//                 </div>
//                 {form.formState.errors.barberIds && (
//                   <p className="mt-1 text-sm text-destructive">
//                     {form.formState.errors.barberIds.message}
//                   </p>
//                 )}
//               </div>
//             )}
//           </form>
// 
//           <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
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
//                       : "Excluir servico?"}
//                   </AlertDialogTitle>
//                   <AlertDialogDescription asChild>
//                     <div className="mt-2 flex flex-col gap-2">
//                       {!countLoading && futureCount > 0 ? (
//                         <span className="font-medium text-orange-500">
//                           Existem {futureCount} agendamento
//                           {futureCount !== 1 ? "s" : ""} futuro
//                           {futureCount !== 1 ? "s" : ""} vinculado
//                           {futureCount !== 1 ? "s" : ""} a este servico.
//                           Cancele-os antes de excluir.
//                         </span>
//                       ) : (
//                         <span>
//                           Essa acao nao pode ser desfeita. O servico sera
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
//             <div className="flex justify-center gap-2">
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
//                 form="update-service-form"
//                 disabled={form.formState.isSubmitting}
//               >
//                 {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
//               </Button>
//             </div>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
// 
//       <ImageCropper
//         open={cropperOpen}
//         imageUrl={cropperImageUrl}
//         aspect={16 / 9}
//         cropShape="rect"
//         onConfirm={file => {
//           setImageFile(file);
//           setImagePreview(URL.createObjectURL(file));
//           setCropperOpen(false);
//         }}
//         onCancel={() => setCropperOpen(false)}
//       />
//     </>
//   );
// }
