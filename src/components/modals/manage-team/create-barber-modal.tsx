import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/ui/image-cropped";
import { createBarber } from "@/lib/supabase/barbers/create-barber";
import { useBarbershopServices } from "@/hooks/use-barbershop-services";
import { useBarbershopStore } from "@/store/barbershop.store";
import {
  defaultAvailability,
  saveBarberAvailability,
} from "@/hooks/use-barber-availability";
import type { DayAvailability } from "@/hooks/use-barber-availability";
import { AvailabilitySection } from "@/components/sections/manage-team/availability-section";
import { validateAvailability } from "@/components/sections/manage-team/availability-section.constants";
import type { Barber } from "@/types/barber";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  serviceIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateBarberModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (barber: Barber) => void;
}

export function CreateBarberModal({
  open,
  onClose,
  onCreated,
}: CreateBarberModalProps) {
  const { barbershop } = useBarbershopStore();
  const { services } = useBarbershopServices();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState("");
  const [availability, setAvailability] =
    useState<DayAvailability[]>(defaultAvailability);
  const [availabilityErrors, setAvailabilityErrors] = useState<
    Record<string, string>
  >({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", serviceIds: [] },
  });

  function handleAvailabilityChange(next: DayAvailability[]) {
    setAvailability(next);
    setAvailabilityErrors(validateAvailability(next));
  }

  function clearError(key: string) {
    setAvailabilityErrors(prev => {
      const e = { ...prev };
      delete e[key];
      return e;
    });
  }

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    const errors = validateAvailability(availability);
    if (Object.keys(errors).length > 0) {
      setAvailabilityErrors(errors);
      toast.error("Corrija os horários destacados em vermelho.");
      return;
    }

    const result = await createBarber({
      barbershopId: barbershop.id,
      name: data.name,
      serviceIds: data.serviceIds,
    });

    if (!result) {
      toast.error("Erro ao criar barbeiro");
      return;
    }

    if (avatarFile) {
      const { supabase } = await import("@/lib/supabase/supabase");
      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${barbershop.owner_id}/barbers/${result.id}.${fileExt}`;
      const { data: uploaded } = await supabase.storage
        .from("barbershop-assets")
        .upload(filePath, avatarFile, { upsert: true });

      if (uploaded) {
        const { data: urlData } = await supabase.storage
          .from("barbershop-assets")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);
        if (urlData) {
          await supabase
            .from("barbers")
            .update({ avatar_url: urlData.signedUrl })
            .eq("id", result.id);
        }
      }
    }

    await saveBarberAvailability(result.id, barbershop.id, availability);

    toast.success("Barbeiro criado!");
    onCreated({
      id: result.id,
      barbershop_id: barbershop.id,
      name: data.name,
      description: null,
      avatar_url: avatarPreview,
      is_active: false,
    });
    form.reset();
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvailability(defaultAvailability());
    setAvailabilityErrors({});
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="mb-4">Novo barbeiro</DialogTitle>
          </DialogHeader>

          <form
            id="create-barber-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6 mb-4"
          >
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-23 w-23 md:h-35 md:w-35">
                <AvatarImage src={avatarPreview ?? undefined} />
                <AvatarFallback>
                  {form.watch("name")?.slice(0, 2).toUpperCase() || "BB"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <Label>Foto</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("create-barber-avatar")?.click()
                  }
                >
                  Selecionar foto
                </Button>
                <input
                  id="create-barber-avatar"
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

            {/* Nome */}
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="create-barber-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="create-barber-name"
                      placeholder="Nome do barbeiro"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            {/* Serviços */}
            {services.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Serviços</Label>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {services.map(service => (
                    <Controller
                      key={service.id}
                      name="serviceIds"
                      control={form.control}
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`create-service-${service.id}`}
                            checked={field.value.includes(service.id)}
                            onCheckedChange={checked => {
                              field.onChange(
                                checked
                                  ? [...field.value, service.id]
                                  : field.value.filter(id => id !== service.id),
                              );
                            }}
                          />
                          <label
                            htmlFor={`create-service-${service.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {service.name}
                          </label>
                        </div>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Disponibilidade */}
            <AvailabilitySection
              availability={availability}
              onChange={handleAvailabilityChange}
              errors={availabilityErrors}
              onClearError={clearError}
            />
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-barber-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Criando..." : "Criar barbeiro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageCropper
        open={cropperOpen}
        imageUrl={cropperImageUrl}
        aspect={1}
        cropShape="round"
        onConfirm={file => {
          setAvatarFile(file);
          setAvatarPreview(URL.createObjectURL(file));
          setCropperOpen(false);
        }}
        onCancel={() => setCropperOpen(false)}
      />
    </>
  );
}
