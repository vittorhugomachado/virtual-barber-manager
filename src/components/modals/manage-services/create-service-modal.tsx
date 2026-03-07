import { useState } from "react";
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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ImageCropper } from "@/components/ui/image-cropped";
import { createService } from "@/lib/supabase/services/create-service";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";
import type { Service } from "@/types/services";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  price: z.preprocess(
    val =>
      val === "" || val === undefined || val === null ? undefined : Number(val),
    z.number({ error: "Preço é obrigatório" }).min(0, "Preço inválido"),
  ),
  duration_min: z.preprocess(
    val =>
      val === "" || val === undefined || val === null ? undefined : Number(val),
    z.number({ error: "Duração é obrigatória" }).min(1, "Duração inválida"),
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateServiceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (service: Service) => void;
}

export function CreateServiceModal({
  open,
  onClose,
  onCreated,
}: CreateServiceModalProps) {
  const { barbershop } = useBarbershopStore();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      price: undefined,
      duration_min: undefined,
    },
  });

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    const result = await createService({
      barbershopId: barbershop.id,
      name: data.name,
      description: data.description,
      price: data.price,
      duration_min: data.duration_min,
    });

    if (!result) {
      toast.error("Erro ao criar serviço");
      return;
    }

    let imageUrl: string | null = null;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `${barbershop.owner_id}/services/${result.id}.${fileExt}`;
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
            .eq("id", result.id);
        }
      }
    }

    toast.success("Serviço criado!");
    onCreated({
      id: result.id,
      barbershop_id: barbershop.id,
      name: data.name,
      description: data.description ?? null,
      image_url: imageUrl,
      price: data.price ?? null,
      duration_min: data.duration_min ?? null,
      is_active: true,
    });
    form.reset();
    setImageFile(null);
    setImagePreview(null);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="mb-4">Novo serviço</DialogTitle>
          </DialogHeader>

          <form
            id="create-service-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6 mb-4"
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
                <Label>Imagem</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("create-service-image")?.click()
                  }
                >
                  Selecionar imagem
                </Button>
                <input
                  id="create-service-image"
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
                    <FieldLabel htmlFor="create-service-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="create-service-name"
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
                    <FieldLabel htmlFor="create-service-description">
                      Descrição
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="create-service-description"
                      placeholder="Descreva o serviço..."
                      aria-invalid={fieldState.invalid}
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
                      <FieldLabel htmlFor="create-service-price">
                        Preço (R$)
                      </FieldLabel>
                      <Input
                        {...field}
                        id="create-service-price"
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
                      <FieldLabel htmlFor="create-service-duration">
                        Duração (min)
                      </FieldLabel>
                      <Input
                        {...field}
                        id="create-service-duration"
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
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-service-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Criando..." : "Criar serviço"}
            </Button>
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
