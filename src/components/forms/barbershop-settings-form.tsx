import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase/supabase";
import { handleUploadBanner } from "@/lib/supabase/storage/handle-upload-banner";
import { handleUploadLogo } from "@/lib/supabase/storage/handle-upload-logo";
import { toast } from "sonner";
import { useBarbershopStore } from "@/store/barbershop.store";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { maskPhone } from "@/utils/masked-input-phone";
import { Copy } from "lucide-react";
import { getOptimizedPublicImageUrl } from "@/lib/supabase/storage/get-optimized-public-image-url";

const ImageCropper = lazy(() =>
  import("../ui/image-cropped").then(module => ({
    default: module.ImageCropper,
  })),
);

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Nome da barbearia é obrigatório")
    .max(30, "Nome deve ter no máximo 30 caracteres"),
  phone: z
    .string()
    .refine(v => v.replace(/\D/g, "").length === 11, "Celular inválido"),
  slug: z.string().optional(),
  description: z.string().optional(),
  ownerName: z.string().min(1, "Nome do proprietário é obrigatório"),
  email: z.email("Email inválido"),
});

type FormValues = z.infer<typeof formSchema>;

export function BarbershopSettingsForm() {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState("");
  const [cropperType, setCropperType] = useState<"logo" | "banner">("logo");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [, setUploadingBanner] = useState(false);
  const { barbershop, setBarbershop } = useBarbershopStore();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const DOMAIN = import.meta.env.VITE_DOMAIN;
  const optimizedLogoUrl = getOptimizedPublicImageUrl(barbershop?.logo_url, {
    width: 280,
    height: 280,
    quality: 75,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: barbershop?.name ?? "",
      phone: maskPhone(barbershop?.phone ?? ""),
      slug: barbershop?.slug ?? "",
      description: barbershop?.description ?? "",
      ownerName: barbershop?.owner_name ?? "",
      email: barbershop?.email ?? "",
    },
  });

  useEffect(() => {
    if (barbershop) {
      form.reset({
        name: barbershop.name ?? "",
        phone: maskPhone(barbershop.phone ?? ""),
        slug: barbershop.slug ?? "",
        description: barbershop.description ?? "",
        ownerName: barbershop.owner_name ?? "",
        email: barbershop.email ?? "",
      });
    }
  }, [barbershop, form]);

  async function handleImageUpload(file: File, type: "logo" | "banner") {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo deve ser uma imagem");
      return;
    }

    if (!barbershop?.id || !barbershop?.owner_id) return;

    const setUploading =
      type === "logo" ? setUploadingLogo : setUploadingBanner;
    setUploading(true);

    try {
      const params = {
        file,
        barbershopId: barbershop.id,
        ownerId: barbershop.owner_id,
      };

      const { publicUrl, error } =
        type === "logo"
          ? await handleUploadLogo(params)
          : await handleUploadBanner(params);

      if (error || !publicUrl) {
        toast.error(`Erro ao atualizar ${type === "logo" ? "foto" : "banner"}`);
        return;
      }

      setBarbershop({
        ...barbershop,
        ...(type === "logo"
          ? { logo_url: publicUrl }
          : { banner_url: publicUrl }),
      });

      toast.success(
        type === "logo" ? "Foto atualizada!" : "Banner atualizado!",
      );
    } catch (error) {
      console.error(`Erro no upload do ${type}:`, error);
      toast.error(
        `Erro inesperado ao atualizar ${type === "logo" ? "foto" : "banner"}`,
      );
    } finally {
      setUploading(false);
      if (type === "logo" && logoInputRef.current) {
        logoInputRef.current.value = "";
      } else if (type === "banner" && bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
    }
  }

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    const rawPhone = data.phone.replace(/\D/g, "");

    const [barbershopResult, profileResult] = await Promise.all([
      supabase
        .from("barbershops")
        .update({
          name: data.name,
          slug: data.slug,
          phone: rawPhone,
          email: data.email,
          description: data.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", barbershop.id)
        .select()
        .single(),

      supabase
        .from("profiles")
        .update({
          name: data.ownerName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", barbershop.owner_id),
    ]);

    if (barbershopResult.error) {
      const msg = barbershopResult.error.message;
      if (
        msg.includes("barbershops_name_max_length") ||
        msg.includes("name_max_length")
      ) {
        form.setError("name", {
          message: "Nome deve ter no máximo 30 caracteres",
        });
      } else if (msg.includes("barbershops_slug_key") || msg.includes("slug")) {
        form.setError("slug", { message: "Este slug já está em uso" });
      } else if (
        msg.includes("barbershops_phone_key") ||
        msg.includes("phone")
      ) {
        form.setError("phone", { message: "Este celular já está cadastrado" });
      } else if (
        msg.includes("barbershops_email_key") ||
        msg.includes("email")
      ) {
        form.setError("email", { message: "Este email já está cadastrado" });
      } else {
        toast.error("Erro ao salvar dados da barbearia");
      }
      return;
    }

    if (profileResult.error) {
      const msg = profileResult.error.message;
      if (msg.includes("profiles_phone_key") || msg.includes("phone")) {
        form.setError("phone", { message: "Este celular já está cadastrado" });
      } else {
        toast.error("Erro ao salvar dados do proprietário");
      }
      return;
    }

    setBarbershop({
      ...barbershop,
      ...barbershopResult.data,
      owner_name: data.ownerName,
    });
    toast.success("Alterações salvas!");
  }

  async function handleCopySite() {
    const slug = form.getValues("slug")?.trim();

    if (!slug) {
      form.setError("slug", { message: "Digite um slug para copiar o site" });
      return;
    }

    try {
      await navigator.clipboard.writeText(`${DOMAIN}${slug}`);
      toast.success("Link do site copiado!");
    } catch (error) {
      console.error("Erro ao copiar site:", error);
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="w-full max-w-180 md:px-16 mt-2 mb-18 flex flex-col gap-8"
    >
      {/* ── SEÇÃO: Dados da Barbearia ── */}
      <Card className="bg-transparent border-none">
        <CardHeader className="mt-3">
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">
              Dados da Barbearia
            </CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Logo */}
          <div className="w-full flex items-center gap-4">
            <Avatar className="h-23 w-23 md:h-35 md:w-35">
              <AvatarImage
                src={optimizedLogoUrl}
                width={140}
                height={140}
                decoding="async"
              />
              <AvatarFallback>
                {barbershop?.name?.slice(0, 2).toUpperCase() ?? "BB"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Label>Foto de perfil</Label>
              <Button
                type="button"
                size="sm"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
                className="rounded-full"
              >
                {uploadingLogo ? "Enviando..." : "Alterar foto"}
              </Button>
              <Input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCropperImageUrl(URL.createObjectURL(file));
                  setCropperType("logo");
                  setCropperOpen(true);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-name">
                    Nome da barbearia
                  </FieldLabel>
                  <Input
                    {...field}
                    id="settings-name"
                    placeholder="Barbearia do João"
                    maxLength={30}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-phone">Celular</FieldLabel>
                  <Input
                    {...field}
                    id="settings-phone"
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    aria-invalid={fieldState.invalid}
                    onChange={e => field.onChange(maskPhone(e.target.value))}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="slug"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-slug">Site</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-62.5 flex-1">
                      <span className="h-full w-37 flex items-center pl-3 rounded-l-lg absolute text-muted-foreground text-sm pointer-events-none">
                        {DOMAIN}
                      </span>
                      <Input
                        {...field}
                        id="settings-slug"
                        placeholder="nome-da-barbearia"
                        className="pl-36"
                        aria-invalid={fieldState.invalid}
                        onChange={e => {
                          const value = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "");
                          field.onChange(value);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={handleCopySite}
                      style={{ fontSize: "13px" }}
                    >
                      <Copy className="h-3 w-3" />
                      <span className="hidden md:block">Copiar</span>
                    </Button>
                  </div>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Separator />

      {/* ── SEÇÃO: Dados do Proprietário ── */}
      <Card className="bg-transparent border-none">
        <CardHeader className="mt-3">
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">
              Dados do Proprietário
            </CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Controller
              name="ownerName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-owner-name">
                    Nome do proprietário
                  </FieldLabel>
                  <Input
                    {...field}
                    id="settings-owner-name"
                    placeholder="Seu nome"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="settings-email"
                    placeholder="barbearia@email.com"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting || !form.formState.isDirty}
        className="w-60 mx-auto rounded-full"
      >
        {form.formState.isSubmitting ? "Salvando..." : "Salvar alterações"}
      </Button>
      {cropperOpen && (
        <Suspense fallback={null}>
          <ImageCropper
            open={cropperOpen}
            imageUrl={cropperImageUrl}
            aspect={cropperType === "logo" ? 1 : 4}
            cropShape={cropperType === "logo" ? "round" : "rect"}
            onConfirm={(croppedFile: File) => {
              setCropperOpen(false);
              handleImageUpload(croppedFile, cropperType);
            }}
            onCancel={() => setCropperOpen(false)}
          />
        </Suspense>
      )}
    </form>
  );
}
