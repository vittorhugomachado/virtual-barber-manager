import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import type { AppointmentWithRelations } from "@/types/create-appointment";

interface CancelAppointmentModalProps {
  open: boolean;
  appointment: AppointmentWithRelations | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export function DeleteAppointmentModal({
  open,
  appointment,
  onClose,
  onSuccess,
}: CancelAppointmentModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !appointment) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      const { error: err } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment!.id);

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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-base font-semibold">Cancelar agendamento</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja cancelar o agendamento abaixo?
          </p>

          {/* Resumo */}
          <div className="rounded-lg border bg-muted/30 px-4 py-3 flex flex-col gap-1.5 text-sm">
            <div className="font-medium text-foreground">
              {appointment.customer.name}
            </div>
            <div className="text-muted-foreground">
              {appointment.service.name} · {appointment.barber.name}
            </div>
            <div className="text-muted-foreground capitalize">
              {formatDateTime(appointment.starts_at)}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Esta ação não pode ser desfeita.
          </p>

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
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Cancelando..." : "Sim, cancelar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
