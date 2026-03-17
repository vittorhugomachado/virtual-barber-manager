import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  CalendarDays,
  Clock,
  User,
  Scissors,
  Sparkles,
  Pencil,
} from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { useCustomers } from "@/hooks/use-customers";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-service";
import type { AppointmentWithRelations } from "@/types/create-appointment";

interface EditAppointmentModalProps {
  open: boolean;
  appointment: AppointmentWithRelations | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

const SELECT_CLS =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer";

export function UpdateAppointmentModal({
  open,
  appointment,
  onClose,
  onSuccess,
}: EditAppointmentModalProps) {
  const { customers, loading: loadingCustomers } = useCustomers();
  const { barbers, loading: loadingBarbers } = useBarbers();
  const { services, loading: loadingServices } = useServices();

  const [customerId, setCustomerId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-preenche com os dados do agendamento ao abrir
  useEffect(() => {
    if (open && appointment) {
      setCustomerId(appointment.customer.id);
      setBarberId(appointment.barber.id);
      setServiceId(appointment.service.id);

      const d = new Date(appointment.starts_at);
      setDate(d.toISOString().split("T")[0]);
      setTime(
        d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
      setError(null);
    }
  }, [open, appointment]);

  useEffect(() => {
    if (!open) {
      setCustomerId("");
      setBarberId("");
      setServiceId("");
      setDate("");
      setTime("");
      setError(null);
    }
  }, [open]);

  if (!open || !appointment) return null;

  const loadingOptions = loadingCustomers || loadingBarbers || loadingServices;
  const valid = customerId && barberId && serviceId && date && time;
  const todayStr = new Date().toISOString().split("T")[0];

  async function handleConfirm() {
    if (!appointment) return; // 👈 guard antes de usar
    setSubmitting(true);
    setError(null);

    try {
      const { error: err } = await supabase
        .from("appointments")
        .update({ status: "cancelled_by_barbershop" })
        .eq("id", appointment.id); // sem o "!" agora

      if (err) throw err;

      onSuccess?.();
      onClose();
    } catch {
      setError("Erro ao cancelar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Editar agendamento</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center p-1 rounded-xs bg-[#FB2C36] text-white border-0 opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {loadingOptions ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Carregando opções...
            </div>
          ) : (
            <>
              <Field label="Cliente" icon={<User className="h-3.5 w-3.5" />}>
                <select
                  className={SELECT_CLS}
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Barbeiro"
                icon={<Scissors className="h-3.5 w-3.5" />}
              >
                <select
                  className={SELECT_CLS}
                  value={barberId}
                  onChange={e => setBarberId(e.target.value)}
                >
                  <option value="">Selecione um barbeiro</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Serviço"
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                <select
                  className={SELECT_CLS}
                  value={serviceId}
                  onChange={e => setServiceId(e.target.value)}
                >
                  <option value="">Selecione um serviço</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.duration_min ? ` — ${s.duration_min} min` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Data"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                >
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={date}
                      min={todayStr}
                      onChange={e => setDate(e.target.value)}
                      style={{ colorScheme: "light" }}
                      className="h-9 w-full rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </Field>

                <Field label="Horário" icon={<Clock className="h-3.5 w-3.5" />}>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text"
                  />
                </Field>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!valid || submitting || loadingOptions}
            className="cursor-pointer"
          >
            {submitting ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
