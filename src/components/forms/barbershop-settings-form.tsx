import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateBarbershopSettings } from "@/lib/supabase/settings/update-barbershop-settings";
import { toast } from "sonner";
import { useBarbershopStore } from "@/store/barbershop.store";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { maskPhone } from "@/utils/mask-phone";
import { Copy } from "lucide-react";

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
});

type FormValues = z.infer<typeof formSchema>;

function formatPhoneForInput(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const localPhone =
    digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;

  return maskPhone(localPhone);
}

export function BarbershopSettingsForm() {
  const { barbershop, setBarbershop } = useBarbershopStore();

  const DOMAIN = import.meta.env.VITE_DOMAIN;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: barbershop?.name ?? "",
      phone: formatPhoneForInput(barbershop?.phone ?? ""),
      slug: barbershop?.slug ?? "",
      description: barbershop?.description ?? "",
      ownerName: barbershop?.owner_name ?? "",
    },
  });

  useEffect(() => {
    if (barbershop) {
      form.reset({
        name: barbershop.name ?? "",
        phone: formatPhoneForInput(barbershop.phone ?? ""),
        slug: barbershop.slug ?? "",
        description: barbershop.description ?? "",
        ownerName: barbershop.owner_name ?? "",
      });
    }
  }, [barbershop, form]);

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    try {
      const phoneDigits = data.phone.replace(/\D/g, "");

      const result = await updateBarbershopSettings({
        barbershopId: barbershop.id,
        name: data.name,
        phone: phoneDigits,
        slug: data.slug ?? "",
        description: data.description,
        ownerName: data.ownerName,
      });

      if (result.status !== "updated") {
        const field = result.field;
        if (field === "slug") {
          form.setError("slug", { message: "Este slug já está em uso" });
        } else if (field === "phone") {
          form.setError("phone", {
            message:
              result.status === "conflict"
                ? "Este celular já está cadastrado"
                : "Celular inválido",
          });
        } else if (field === "name") {
          form.setError("name", { message: "Nome inválido" });
        } else if (field === "owner_name") {
          form.setError("ownerName", {
            message:
              result.status === "not_allowed"
                ? "Somente o proprietário pode alterar este nome"
                : "Nome do proprietário inválido",
          });
        } else {
          toast.error("Não foi possível salvar as alterações");
        }
        return;
      }

      setBarbershop(result.barbershop);
      form.reset({
        name: result.barbershop.name,
        phone: formatPhoneForInput(result.barbershop.phone ?? ""),
        slug: result.barbershop.slug,
        description: result.barbershop.description ?? "",
        ownerName: result.barbershop.owner_name ?? data.ownerName,
      });
      toast.success("Alterações salvas!");
    } catch {
      toast.error("Erro ao salvar dados da barbearia");
    }
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
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="w-full max-w-180 h-full relative"
    >
      {/* ── SEÇÃO: Dados da Barbearia ── */}
      <Card className="bg-transparent border-none">
        <CardHeader>
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">
              Dados da Barbearia
            </CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {/* Logo */}
          {/* <div className="w-full flex items-center gap-4">
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
          </div> */}

          <FieldGroup className="max-w-106">
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
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 absolute w-10 md:w-20 right-0.75 h-[85%] top-0.75"
                        onClick={handleCopySite}
                        style={{ fontSize: "13px", borderRadius: "0.375rem" }}
                      >
                        <Copy className="h-3 w-3" />
                        <span className="hidden md:block">Copiar</span>
                      </Button>
                    </div>
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

      <div className="w-full mx-auto rounded-full absolute bottom-4 flex justify-center">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
          className="w-60 mx-auto rounded-full"
        >
          {form.formState.isSubmitting ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
