import { useState } from "react";
import { changeManagerAppointmentStatus } from "@/lib/supabase/appointments/appointments";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CancelAppointmentModalProps {
  open: boolean;
  appointment: AppointmentWithRelations | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatDateTime(isoString: string, timezone: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: timezone,
    }) +
    " às " +
    d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })
  );
}

export function DeleteAppointmentModal({
  open,
  appointment,
  onClose,
  onSuccess,
}: CancelAppointmentModalProps) {
  const timezone = useBarbershopStore(
    state => state.barbershop?.timezone ?? "America/Sao_Paulo",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      if (!appointment) return;
      await changeManagerAppointmentStatus({
        appointmentId: appointment.id,
        expectedStatus: appointment.status,
        newStatus: "cancelled_by_barbershop",
      });

      onSuccess?.();
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (message.includes("subscription_inactive")) {
        setError(
          "A assinatura da barbearia está inativa. Regularize o pagamento para alterar a agenda.",
        );
      } else if (message.includes("barbershop_inactive")) {
        setError(
          "A barbearia está desativada. Reative a conta para alterar a agenda.",
        );
      } else {
        setError("Erro ao cancelar agendamento. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={o => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="w-full flex flex-col gap-3">
              <span>Tem certeza que deseja cancelar o agendamento abaixo?</span>

              {appointment && (
                <div className="w-full rounded-lg border bg-muted/30 px-4 py-3 flex flex-col gap-1.5 text-sm">
                  <div className="font-medium text-foreground">
                    {appointment.customer?.name}
                  </div>
                  <div className="text-muted-foreground">
                    {appointment.service?.name} · {appointment.barber?.name}
                  </div>
                  <div className="text-muted-foreground capitalize">
                    {formatDateTime(appointment.starts_at, timezone)}
                  </div>
                </div>
              )}

              <span className="text-xs">Esta ação não pode ser desfeita.</span>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting} onClick={onClose}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {submitting ? "Cancelando..." : "Sim, cancelar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
