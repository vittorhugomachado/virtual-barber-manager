import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ImageCropper } from "@/components/ui/image-cropped";
import { updateService } from "@/lib/supabase/services/update-service";
import { deleteService } from "@/lib/supabase/services/delete-service";
import { useBarbershopStore } from "@/store/barbershop.store";
import { useBarbers } from "@/hooks/use-barbers";
import { supabase } from "@/lib/supabase/supabase";
import type { Service } from "@/types/services";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useFutureAppointmentsCount } from "@/hooks/use-future-appointments-count";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z
    .string()
    .max(100, "Descrição deve ter no máximo 100 caracteres")
    .optional(),
  price: z.number({ error: "Preço é obrigatório" }).min(0, "Preço inválido"),
  duration_min: z
    .number({ error: "Duração é obrigatória" })
    .min(1, "Duração inválida"),
  barberIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateServiceModalProps {
  open: boolean;
  service: Service | null;
  onClose: () => void;
  onUpdated: (service: Service) => void;
  onDeleted: (id: string) => void;
}

export function UpdateServiceModal({
  open,
  service,
  onClose,
  onUpdated,
  onDeleted,
}: UpdateServiceModalProps) {
  const { barbershop } = useBarbershopStore();
  const { barbers } = useBarbers();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { count: futureCount, loading: countLoading } =
    useFutureAppointmentsCount(
      "service_id",
      open ? (service?.id ?? null) : null,
    );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      price: undefined,
      duration_min: undefined,
      barberIds: [],
    },
  });

  useEffect(() => {
    if (!service) return;

    supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", service.id)
      .then(({ data }) => {
        form.reset({
          name: service.name,
          description: service.description ?? "",
          price: service.price ?? undefined,
          duration_min: service.duration_min ?? undefined,
          barberIds: data?.map(d => d.barber_id) ?? [],
        });
        setImagePreview(service.image_url);
        setImageFile(null);
        setRemoveImage(false);
      });
  }, [service, form]);

  async function deleteStorageImage(serviceId: string) {
    const folder = `${barbershop!.owner_id}/services/`;
    const { data: files } = await supabase.storage
      .from("barbershop-assets")
      .list(folder);
    const matches = files?.filter(f => f.name.startsWith(serviceId)) ?? [];
    if (matches.length > 0) {
      await supabase.storage
        .from("barbershop-assets")
        .remove(matches.map(f => `${folder}${f.name}`));
    }
  }

  async function onSubmit(data: FormValues) {
    if (!service || !barbershop?.id) return;

    let imageUrl = service.image_url;

    if (removeImage && service.image_url) {
      await deleteStorageImage(service.id);
      imageUrl = null;
      await supabase
        .from("services")
        .update({ image_url: null })
        .eq("id", service.id);
    }

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `${barbershop.owner_id}/services/${service.id}.${fileExt}`;
      const { data: uploaded } = await supabase.storage
        .from("barbershop-assets")
        .upload(filePath, imageFile, { upsert: true });

      if (uploaded) {
        const { data: urlData } = await supabase.storage
          .from("barbershop-assets")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);
        if (urlData) {
          imageUrl = urlData.signedUrl;
          await supabase
            .from("services")
            .update({ image_url: imageUrl })
            .eq("id", service.id);
        }
      }
    }

    const success = await updateService({
      id: service.id,
      name: data.name,
      description: data.description,
      price: data.price,
      duration_min: data.duration_min,
    });

    if (!success) {
      toast.error("Erro ao atualizar serviço");
      return;
    }

    // Atualiza vínculos de barbeiros: delete todos e reinsere
    await supabase
      .from("barber_services")
      .delete()
      .eq("service_id", service.id);

    if (data.barberIds.length > 0) {
      await supabase.from("barber_services").insert(
        data.barberIds.map(barberId => ({
          barber_id: barberId,
          service_id: service.id,
        })),
      );
    }

    toast.success("Serviço atualizado!");
    onUpdated({
      ...service,
      name: data.name,
      description: data.description ?? null,
      price: data.price ?? null,
      duration_min: data.duration_min ?? null,
      image_url: imageUrl,
    });
    onClose();
  }

  async function handleDelete() {
    if (!service) return;
    setDeleting(true);
    const success = await deleteService(service.id);

    if (!success) {
      setDeleting(false);
      toast.error("Erro ao excluir serviço");
      return;
    }

    if (service.image_url && barbershop) {
      await deleteStorageImage(service.id);
    }

    setDeleting(false);
    toast.success("Serviço excluído!");
    onDeleted(service.id);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="mb-4">Editar serviço</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Editar serviço
          </DialogDescription>
          <form
            id="update-service-form"
            onSubmit={form.handleSubmit(onSubmit, errors => {
              const first = Object.values(errors)[0];
              if (first?.message) toast.error(first.message as string);
            })}
            className="flex flex-col gap-6 mb-4 px-1"
          >
            {/* Imagem */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs text-center px-1">
                    Sem imagem
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  className="rounded-full"
                  type="button"
                  size="sm"
                  onClick={() =>
                    document.getElementById("update-service-image")?.click()
                  }
                >
                  Alterar imagem
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      setRemoveImage(true);
                    }}
                  >
                    Remover foto
                  </Button>
                )}
                <input
                  id="update-service-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCropperImageUrl(URL.createObjectURL(file));
                    setCropperOpen(true);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <FieldGroup>
              {/* Nome */}
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="update-service-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="update-service-name"
                      placeholder="Ex: Corte degradê"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Descrição */}
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="update-service-description">
                        Descrição
                      </FieldLabel>
                      <span
                        className={`text-xs ${(field.value?.length ?? 0) > 100 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {field.value?.length ?? 0}/100
                      </span>
                    </div>
                    <Textarea
                      {...field}
                      id="update-service-description"
                      placeholder="Descreva o serviço..."
                      aria-invalid={fieldState.invalid}
                      maxLength={100}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Preço e Duração lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="price"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="update-service-price">
                        Preço (R$)
                      </FieldLabel>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        onChange={e =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                        id="update-service-price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="duration_min"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="update-service-duration">
                        Duração (min)
                      </FieldLabel>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        onChange={e =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                        id="update-service-duration"
                        type="number"
                        min="1"
                        placeholder="30"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>

            {/* Barbeiros */}
            {barbers.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Barbeiros</Label>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {barbers.map(barber => (
                    <Controller
                      key={barber.id}
                      name="barberIds"
                      control={form.control}
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`update-barber-${barber.id}`}
                            checked={field.value.includes(barber.id)}
                            onCheckedChange={checked => {
                              field.onChange(
                                checked
                                  ? [...field.value, barber.id]
                                  : field.value.filter(id => id !== barber.id),
                              );
                            }}
                          />
                          <label
                            htmlFor={`update-barber-${barber.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {barber.name}
                          </label>
                        </div>
                      )}
                    />
                  ))}
                </div>
                {form.formState.errors.barberIds && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.barberIds.message}
                  </p>
                )}
              </div>
            )}
          </form>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {!countLoading && futureCount > 0
                      ? "Conflito com agenda"
                      : "Excluir serviço?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="flex flex-col gap-2 mt-2">
                      {!countLoading && futureCount > 0 ? (
                        <span className="text-orange-500 font-medium">
                          ⚠️ Existem {futureCount} agendamento
                          {futureCount !== 1 ? "s" : ""} futuro
                          {futureCount !== 1 ? "s" : ""} vinculado
                          {futureCount !== 1 ? "s" : ""} a este serviço.
                          Cancele-os antes de excluir.
                        </span>
                      ) : (
                        <span>
                          Essa ação não pode ser desfeita. O serviço será
                          removido permanentemente.
                        </span>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  {futureCount === 0 && (
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting || countLoading}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {deleting ? "Excluindo..." : "Excluir"}
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-full"
              >
                Cancelar
              </Button>
              <Button
                className="rounded-full"
                type="submit"
                form="update-service-form"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageCropper
        open={cropperOpen}
        imageUrl={cropperImageUrl}
        aspect={16 / 9}
        cropShape="rect"
        onConfirm={file => {
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
          setCropperOpen(false);
        }}
        onCancel={() => setCropperOpen(false)}
      />
    </>
  );
}
