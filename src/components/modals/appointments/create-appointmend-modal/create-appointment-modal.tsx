import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { useServices } from "@/hooks/use-service";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { SelectedCustomer } from "@/types/create-appointment";
import { Step1Customer } from "./components/step-1";
import { Step2Service } from "./components/step-2";
import { Step3Date } from "./components/step-3";
import { Step4BarberTime } from "./components/step-4";
import { ConfirmStep } from "./components/confirm-step";
import { StepIndicator } from "./components/step-indicator";

type Step = 1 | 2 | 3 | 4;

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
  const [date, setDate] = useState<string | null>(null);
  const [dateObj, setDateObj] = useState<Date | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setShowConfirm(false);
    setCustomer(null);
    setServiceId(null);
    setDate(null);
    setDateObj(null);
    setBarberId(null);
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

      const startsAt = new Date(`${date}T${time}:00Z`);
      const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

      // Resolve "any" → pick random available barber
      let resolvedBarberId = barberId;
      if (barberId === "any") {
        const { data: eligible } = await supabase
          .from("barber_services")
          .select("barber_id")
          .eq("service_id", serviceId);

        const eligibleIds = (eligible ?? []).map(e => e.barber_id);

        if (eligibleIds.length === 0) {
          setSubmitError(
            "Nenhum barbeiro disponível neste horário. Tente outro.",
          );
          setSubmitting(false);
          return;
        }

        const { data: conflicts } = await supabase
          .from("appointments")
          .select("barber_id, status")
          .in("barber_id", eligibleIds)
          .lt("starts_at", endsAt.toISOString())
          .gt("ends_at", startsAt.toISOString());

        const busyBarberIds = new Set(
          (conflicts ?? [])
            .filter(
              c =>
                c.status !== "cancelled_by_customer" &&
                c.status !== "cancelled_by_barbershop",
            )
            .map(c => c.barber_id),
        );

        const available = eligibleIds.filter(id => !busyBarberIds.has(id));

        if (available.length === 0) {
          setSubmitError(
            "Nenhum barbeiro disponível neste horário. Tente outro.",
          );
          setSubmitting(false);
          return;
        }

        resolvedBarberId =
          available[Math.floor(Math.random() * available.length)];
      }

      const { error: err } = await supabase.from("appointments").insert({
        barbershop_id: barbershop.id,
        customer_id: customer.id,
        barber_id: resolvedBarberId,
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
          <h2 className="text-lg font-semibold">
            {showConfirm ? "Confirmar agendamento" : "Novo agendamento"}
          </h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!showConfirm && <StepIndicator current={step} />}

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
            <Step2Service
              onBack={() => setStep(1)}
              onSelect={sId => {
                setServiceId(sId);
                setStep(3);
              }}
            />
          )}

          {!showConfirm && step === 3 && (
            <Step3Date
              onBack={() => setStep(2)}
              onSelect={(d, dObj) => {
                setDate(d);
                setDateObj(dObj);
                setStep(4);
              }}
            />
          )}

          {!showConfirm && step === 4 && serviceId && date && dateObj && (
            <Step4BarberTime
              serviceId={serviceId}
              date={date}
              dateObj={dateObj}
              onBack={() => setStep(3)}
              onDateChange={(d, dObj) => {
                setDate(d);
                setDateObj(dObj);
              }}
              onSelect={(bId, t) => {
                setBarberId(bId);
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
