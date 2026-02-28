import { useState, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase/supabase";
import { handleUploadBanner } from "@/lib/supabase/storage/handle-upload-banner";
import { handleUploadLogo } from "@/lib/supabase/storage/handle-upload-logo";
import { toast } from "sonner";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Barbershop } from "@/types/barbershop";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const formSchema = z.object({
  name: z.string().min(1, "Nome da barbearia é obrigatório"),
  phone: z.string().min(10, "Celular inválido"),
  slug: z.string().optional(),
  description: z.string().optional(),
  ownerName: z.string().min(1, "Nome do proprietário é obrigatório"),
  email: z.email("Email inválido"),
});

type FormValues = z.infer<typeof formSchema>;

interface BarbershopSettingsFormProps {
  barbershop: Barbershop | null;
}

export function BarbershopSettingsForm({
  barbershop,
}: BarbershopSettingsFormProps) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const { setBarbershop } = useBarbershopStore();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: barbershop?.name ?? "",
      phone: barbershop?.phone ?? "",
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
        phone: barbershop.phone ?? "",
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

    const [barbershopResult, profileResult] = await Promise.all([
      supabase
        .from("barbershops")
        .update({
          name: data.name,
          slug: data.slug,
          phone: data.phone,
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
      if (msg.includes("barbershops_slug_key") || msg.includes("slug")) {
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

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-16 mt-8 mb-18 flex flex-col gap-8"
    >
      {/* ── SEÇÃO: Dados da Barbearia ── */}
      <Card className="bg-transparent border-none">
        <CardHeader>
          <CardTitle>Dados da Barbearia</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Banner */}
          <div className="relative h-40 w-full rounded-lg bg-muted">
            {barbershop?.banner_url && (
              <img
                src={barbershop.banner_url}
                alt="banner"
                className="h-full w-full rounded-lg object-cover"
              />
            )}
            <Button
              type="button"
              size="sm"
              disabled={uploadingBanner}
              className="absolute bottom-2 right-2"
              onClick={() => bannerInputRef.current?.click()}
            >
              {uploadingBanner ? "Enviando..." : "Alterar banner"}
            </Button>
            <Input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, "banner");
              }}
            />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={barbershop?.logo_url ?? undefined} />
              <AvatarFallback>
                {barbershop?.name?.slice(0, 2).toUpperCase() ?? "BB"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Label>Foto de perfil</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
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
                  if (file) handleImageUpload(file, "logo");
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
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-description">
                    Descrição
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="settings-description"
                    placeholder="Fale sobre sua barbearia..."
                    aria-invalid={fieldState.invalid}
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
                  <FieldLabel htmlFor="settings-slug">Slug</FieldLabel>
                  <Input
                    {...field}
                    id="settings-slug"
                    placeholder="barbearia-do-joao"
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

      <Separator />

      {/* ── SEÇÃO: Dados do Proprietário ── */}
      <Card className="bg-transparent border-none">
        <CardHeader>
          <CardTitle>Dados do Proprietário</CardTitle>
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
        className="w-full max-w-xs"
      >
        {form.formState.isSubmitting ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
