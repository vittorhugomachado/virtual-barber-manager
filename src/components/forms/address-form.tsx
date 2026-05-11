import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

const formSchema = z.object({
  zip_code: z
    .string()
    .refine(v => v.replace(/\D/g, "").length === 8, "CEP inválido"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(1, "Estado é obrigatório"),
  country: z.string().min(1, "País é obrigatório"),
});

type FormValues = z.infer<typeof formSchema>;

export function AddressForm({ onSaved }: { onSaved?: () => void }) {
  const { barbershop } = useBarbershopStore();
  const [loading, setLoading] = useState(true);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [mapEmbedUrl, setMapEmbedUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      zip_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      country: "Brasil",
    },
  });

  // Watch fields to build live map preview
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    const { street, number, neighborhood, city, state } = watched;
    if (!street || !number) return;

    let queryAddress = `${street}, ${number}`;
    if (city && state) {
      queryAddress += `, ${city} - ${state}`;
    }
    if (neighborhood) {
      queryAddress += `, ${neighborhood}`;
    }

    console.log("Buscando endereço:", queryAddress);

    const timer = setTimeout(() => {
      // ENDPOINT OFICIAL DE EMBED - Funciona 100% no iframe
      // Porém, requer API Key gratuita
      const API_KEY = import.meta.env.VITE_API_GOOGLE_MAPS; // Você precisa gerar no Google Cloud Console

      const finalUrl = `https://www.google.com/maps/embed/v1/search?key=${API_KEY}&q=${encodeURIComponent(queryAddress)}&zoom=16`;

      setMapEmbedUrl(finalUrl);
    }, 1000);

    return () => clearTimeout(timer);
  }, [watched]);

  useEffect(() => {
    if (!barbershop?.id) return;
    let mounted = true;

    supabase
      .from("addresses")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          setAddressId(data.id);
          const values = {
            zip_code: maskCep(data.zip_code ?? ""),
            street: data.street ?? "",
            number: data.number ?? "",
            complement: data.complement ?? "",
            neighborhood: data.neighborhood ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
            country: data.country ?? "Brasil",
          };
          form.reset(values);

          // Build initial map URL from saved address
          const query = data.neighborhood
            ? `${data.street}, ${data.number}, ${data.neighborhood}, ${data.city}, ${data.state}`
            : `${data.street}, ${data.number}`;
          if (query) {
            setMapEmbedUrl(
              `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`,
            );
          }
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [barbershop?.id, form]);

  async function handleCepBlur(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();

      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }

      form.setValue("street", data.logradouro ?? "", { shouldDirty: true });
      form.setValue("neighborhood", data.bairro ?? "", { shouldDirty: true });
      form.setValue("city", data.localidade ?? "", { shouldDirty: true });
      form.setValue("state", data.uf ?? "", { shouldDirty: true });
      form.setValue("country", "Brasil", { shouldDirty: true });
      form.clearErrors(["street", "neighborhood", "city", "state"]);

      toast.success("Endereço preenchido automaticamente");
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setFetchingCep(false);
    }
  }

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    const payload = {
      barbershop_id: barbershop.id,
      zip_code: data.zip_code.replace(/\D/g, ""),
      street: data.street,
      number: data.number,
      complement: data.complement || null,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      country: data.country,
      updated_at: new Date().toISOString(),
    };

    let error;

    if (addressId) {
      ({ error } = await supabase
        .from("addresses")
        .update(payload)
        .eq("id", addressId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("addresses")
        .insert(payload)
        .select("id")
        .single();
      error = insertError;
      if (inserted) setAddressId(inserted.id);
    }

    if (error) {
      toast.error("Erro ao salvar endereço");
      return;
    }

    toast.success("Endereço salvo!");
    form.reset(data);
    onSaved?.();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="w-full max-w-180 lg:mx-auto md:px-16 flex flex-col gap-6 mb-6"
    >
      <Card className="bg-transparent border-none">
        <CardHeader className="mt-3">
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">Endereço</CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
        </CardHeader>

        {loading ? (
          <CardContent className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </CardContent>
        ) : (
          <CardContent className="px-3 flex flex-col gap-6">
            {!addressId && (
              <div className="mt-2 w-full flex justify-center items-center gap-2 rounded-full bg-yellow-500/10 text-yellow-500 px-6 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="whitespace-normal text-left text-sm">
                  Cadastre seu endereço para melhorar sua página de agendamentos
                </span>
              </div>
            )}
            <FieldGroup>
              {/* CEP + Estado */}
              <div className="flex gap-3">
                <Controller
                  name="zip_code"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex-1">
                      <FieldLabel htmlFor="addr-zip">
                        CEP
                        {fetchingCep && (
                          <Loader2 className="inline ml-1.5 h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="addr-zip"
                        placeholder="00000-000"
                        inputMode="numeric"
                        aria-invalid={fieldState.invalid}
                        onChange={e => field.onChange(maskCep(e.target.value))}
                        onBlur={e => {
                          field.onBlur();
                          handleCepBlur(e.target.value);
                        }}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="state"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="w-32">
                      <FieldLabel htmlFor="addr-state">Estado</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="addr-state"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZIL_STATES.map(uf => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              {/* Rua */}
              <Controller
                name="street"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="addr-street">Rua</FieldLabel>
                    <Input
                      {...field}
                      id="addr-street"
                      placeholder="Rua das Flores"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Número + Complemento */}
              <div className="flex gap-3">
                <Controller
                  name="number"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="w-28">
                      <FieldLabel htmlFor="addr-number">Número</FieldLabel>
                      <Input
                        {...field}
                        id="addr-number"
                        placeholder="123"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="complement"
                  control={form.control}
                  render={({ field }) => (
                    <Field className="flex-1">
                      <FieldLabel htmlFor="addr-complement">
                        Complemento{" "}
                        <span className="text-muted-foreground font-normal">
                          (opcional)
                        </span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="addr-complement"
                        placeholder="Sala 2, Bloco B..."
                      />
                    </Field>
                  )}
                />
              </div>

              {/* Bairro + Cidade */}
              <div className="flex gap-3">
                <Controller
                  name="neighborhood"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex-1">
                      <FieldLabel htmlFor="addr-neighborhood">
                        Bairro
                      </FieldLabel>
                      <Input
                        {...field}
                        id="addr-neighborhood"
                        placeholder="Centro"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="city"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex-1">
                      <FieldLabel htmlFor="addr-city">Cidade</FieldLabel>
                      <Input
                        {...field}
                        id="addr-city"
                        placeholder="São Paulo"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              {/* País */}
              <Controller
                name="country"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="w-36">
                    <FieldLabel htmlFor="addr-country">País</FieldLabel>
                    <Input
                      {...field}
                      id="addr-country"
                      placeholder="Brasil"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            {/* Preview do mapa */}
            {mapEmbedUrl ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    Preview do mapa — verifique se o local está correto antes de
                    salvar
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border h-56">
                  <iframe
                    key={mapEmbedUrl}
                    title="Preview do endereço"
                    src={mapEmbedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full"
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        )}
      </Card>

      <Button
        type="submit"
        disabled={
          form.formState.isSubmitting || !form.formState.isDirty || loading
        }
        className="w-60 mx-auto rounded-full"
      >
        {form.formState.isSubmitting ? "Salvando..." : "Salvar endereço"}
      </Button>
    </form>
  );
}
