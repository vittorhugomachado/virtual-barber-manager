import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { useServices } from "@/hooks/use-service";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { SelectedCustomer } from "@/types/create-appointment";
import type { Step } from "@/types/create-appointment";
import { Step1Customer } from "./components/step-1";
import { StepIndicator } from "./components/step-indicator";
import { Step2ServiceBarber } from "./components/step-2";
import { Step3DateTime } from "./components/step-3";
import { ConfirmStep } from "./components/confirm-step";

interface CreateAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateAppointmentModal({
  open,
  onClose,
  onSuccess,
}: CreateAppointmentModalProps) {
  const { barbershop } = useBarbershopStore();
  const { services } = useServices();

  const [step, setStep] = useState<Step>(1);
  const [showConfirm, setShowConfirm] = useState(false);

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setShowConfirm(false);
    setCustomer(null);
    setServiceId(null);
    setBarberId(null);
    setDate(null);
    setTime(null);
    setSubmitting(false);
    setSubmitError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);


  async function handleConfirm() {
    if (!customer || !serviceId || !barberId || !date || !time || !barbershop)
      return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const service = services.find(s => s.id === serviceId);
      const durationMin = service?.duration_min ?? 30;
      const startsAt = new Date(`${date}T${time}:00`);
      const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

      const { error: err } = await supabase.from("appointments").insert({
        barbershop_id: barbershop.id,
        customer_id: customer.id,
        barber_id: barberId,
        service_id: serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "scheduled",
      });

      if (err) throw err;

      onSuccess?.();
      handleClose();
    } catch {
      setSubmitError("Erro ao criar agendamento. Tente novamente.");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative z-10 w-full max-w-xl mx-4 rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {showConfirm ? "Confirmar agendamento" : "Novo agendamento"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator (hidden on confirm screen) */}
        {!showConfirm && <StepIndicator current={step} />}

        {/* Body */}
        <div className="overflow-y-auto">
          {!showConfirm && step === 1 && (
            <Step1Customer
              onSelect={c => {
                setCustomer(c);
                setStep(2);
              }}
            />
          )}

          {!showConfirm && step === 2 && (
            <Step2ServiceBarber
              onBack={() => setStep(1)}
              onSelect={(sId, bId) => {
                setServiceId(sId);
                setBarberId(bId);
                setStep(3);
              }}
            />
          )}

          {!showConfirm && step === 3 && barberId && serviceId && (
            <Step3DateTime
              barberId={barberId}
              serviceId={serviceId}
              onSelect={(d, t) => {
                setDate(d);
                setTime(t);
                setShowConfirm(true);
              }}
            />
          )}

          {showConfirm && customer && serviceId && barberId && date && time && (
            <ConfirmStep
              customer={customer}
              serviceId={serviceId}
              barberId={barberId}
              date={date}
              time={time}
              onConfirm={handleConfirm}
              onClose={handleClose}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
