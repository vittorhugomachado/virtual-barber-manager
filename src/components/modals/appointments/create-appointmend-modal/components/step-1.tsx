import { useCustomers } from "@/hooks/use-customers";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { maskPhone } from "@/utils/masked-input-phone";
import {
  ChevronLeft,
  Phone,
  Search,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Field, INPUT_CLS } from "./field";
import { Button } from "@/components/ui/button";

type CustomerMode = "existing" | "new" | null;

interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  isNew?: boolean;
}

export function Step1Customer({
  onSelect,
}: {
  onSelect: (customer: SelectedCustomer) => void;
}) {
  const { customers, loading } = useCustomers();
  const { barbershop } = useBarbershopStore();
  const [mode, setMode] = useState<CustomerMode>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const normalizeStr = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const searchDigits = search.replace(/\D/g, "");

  const filtered = customers.filter(c => {
    if (!search.trim()) return true;
    const nameMatch = normalizeStr(c.name).includes(normalizeStr(search));
    const phoneMatch =
      searchDigits.length > 0 &&
      (c.phone?.replace(/\D/g, "") ?? "").includes(searchDigits);
    return nameMatch || phoneMatch;
  });

  async function handleCreateCustomer(e: React.SubmitEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    setSubmitting(true);
    setError(null);
    setPhoneError(null);

    const digits = newPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Telefone inválido. Digite DDD + número.");
      setSubmitting(false);
      return;
    }

    const { data: existingList } = await supabase
      .from("customers")
      .select("id, name")
      .eq("barbershop_id", barbershop!.id)
      .eq("phone", digits)
      .limit(1);

    if (existingList && existingList.length > 0) {
      setPhoneError(
        `Telefone já cadastrado para "${existingList[0].name}". Busque pelo cliente existente.`,
      );
      setSubmitting(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("customers")
      .insert({
        barbershop_id: barbershop!.id,
        name: newName.trim(),
        phone: digits,
      })
      .select()
      .single();

    if (err || !data) {
      setError("Erro ao criar cliente. Tente novamente.");
      setSubmitting(false);
      return;
    }

    onSelect({ id: data.id, name: data.name, phone: data.phone, isNew: true });
    setSubmitting(false);
  }

  if (mode === null) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <p className="text-sm text-muted-foreground text-center">
          O cliente já possui cadastro?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              key: "existing" as const,
              icon: <Users className="h-6 w-6" />,
              title: "Cliente existente",
              sub: "Buscar na lista",
            },
            {
              key: "new" as const,
              icon: <UserPlus className="h-6 w-6" />,
              title: "Novo cliente",
              sub: "Cadastrar agora",
            },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors text-muted-foreground group-hover:text-primary">
                {opt.icon}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{opt.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt.sub}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "existing") {
    return (
      <div className="flex flex-col gap-4 px-4 py-5">
        <button
          onClick={() => setMode(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
            }}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            autoFocus
          />
        </div>

        <div className="flex flex-col overflow-y-auto rounded-md border border-border divide-y divide-border">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() =>
                  onSelect({ id: c.id, name: c.name, phone: c.phone ?? "" })
                }
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left cursor-pointer"
              >
                <div className="w-full flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex flex-2 flex-col md:flex-row md:justify-between">
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.phone && (
                      <span className="text-xs text-muted-foreground">
                        {maskPhone(c.phone)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <button
        onClick={() => setMode(null)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>
      <form onSubmit={handleCreateCustomer} className="flex flex-col gap-4">
        <Field label="Nome completo" icon={<User className="h-3.5 w-3.5" />}>
          <input
            type="text"
            placeholder="Ex: João Silva"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className={INPUT_CLS}
            autoFocus
          />
        </Field>

        <Field
          label="Telefone / WhatsApp"
          icon={<Phone className="h-3.5 w-3.5" />}
          error={phoneError}
        >
          <input
            type="text"
            placeholder="(11) 99999-9999"
            value={newPhone}
            onChange={e => {
              setNewPhone(maskPhone(e.target.value));
              setPhoneError(null);
            }}
            className={INPUT_CLS}
            maxLength={15}
          />
        </Field>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        <Button
          disabled={!newName.trim() || !newPhone.trim() || submitting}
          className="cursor-pointer w-full"
        >
          {submitting ? "Cadastrando…" : "Cadastrar e continuar"}
        </Button>
      </form>
    </div>
  );
}
