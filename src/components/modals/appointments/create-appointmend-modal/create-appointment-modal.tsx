import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { useServices } from "@/hooks/use-service";
import { useBarbershopStore } from "@/store/barbershop.store";
import type {
  SelectedCustomer,
  ServiceSelection,
} from "@/types/create-appointment";
import { Step1Customer } from "./components/step-1";
import { Step2Service } from "./components/step-2";
import { Step3Date } from "./components/step-3";
import { Step4BarberTime } from "./components/step-4";
import { ConfirmStep } from "./components/confirm-step";
import { StepIndicator } from "./components/step-indicator";
import { localDateTimeToIso } from "@/utils/date-time";
import { useAllCustomers } from "@/hooks/use-all-customers";

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
  const { customers, setCustomers, loading } = useAllCustomers();
  const [step, setStep] = useState<Step>(1);
  const [showConfirm, setShowConfirm] = useState(false);

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [dateObj, setDateObj] = useState<Date | null>(null);
  const [serviceSelections, setServiceSelections] = useState<
    ServiceSelection[]
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setShowConfirm(false);
    setCustomer(null);
    setServiceIds([]);
    setDate(null);
    setDateObj(null);
    setServiceSelections([]);
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
    if (!customer || serviceSelections.length === 0 || !date || !barbershop)
      return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const isManualCustomer = customer.source === "customers";
      const inserts = serviceSelections.map(sel => {
        const service = services.find(s => s.id === sel.serviceId);
        const durationMin = service?.duration_min ?? 30;
        const startsAt = new Date(localDateTimeToIso(date, sel.time));
        const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);
        console.log(date, sel.time);
        console.log(startsAt.toISOString());
        return {
          barbershop_id: barbershop.id,
          customer_id: isManualCustomer ? null : customer.id,
          manual_customer_id: isManualCustomer ? customer.id : null,
          barber_id: sel.barberId,
          service_id: sel.serviceId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "scheduled",
        };
      });
      console.log(inserts);
      const { error: err } = await supabase
        .from("appointments")
        .insert(inserts);
      if (err) throw err;

      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const pgError = err as { code?: string; message?: string };
      console.error("[createAppointment] erro:", {
        code: pgError?.code,
        message: pgError?.message,
        inserts: serviceSelections,
      });
      if (pgError?.code === "23P01") {
        setSubmitError(
          "Horário indisponível: o profissional já possui um agendamento neste horário.",
        );
      } else if (pgError?.code === "23503") {
        setSubmitError(
          "Dados inválidos: cliente, profissional ou serviço não encontrado. Recarregue a página e tente novamente.",
        );
      } else if (pgError?.code === "P0001") {
        setSubmitError(
          "Horário fora do funcionamento da barbearia. Escolha um horário dentro do expediente.",
        );
      } else {
        setSubmitError("Erro ao criar agendamento. Tente novamente.");
      }
      setSubmitting(false);
    }
  }

  if (!open) return null;

  //CONSOLE PARA DEBUG
  // console.log("componente pai:", {
  //   step,
  //   customer,
  //   date,
  //   dateObj,
  //   services,
  //   serviceIds,
  //   serviceSelections,
  //   submitting,
  //   submitError,
  // });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-xl mx-4 rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold">
            {showConfirm ? "Confirmar agendamento" : "Novo agendamento"}
          </h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center p-1 rounded-xs bg-[#FB2C36] text-white border-0 opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
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
              onSelect={ids => {
                setServiceIds(ids);
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

          {!showConfirm &&
            step === 4 &&
            serviceIds.length > 0 &&
            date &&
            dateObj && (
              <Step4BarberTime
                serviceIds={serviceIds}
                date={date}
                dateObj={dateObj}
                onBack={() => setStep(3)}
                onDateChange={(d, dObj) => {
                  setDate(d);
                  setDateObj(dObj);
                }}
                onSelect={selections => {
                  setServiceSelections(selections);
                  setShowConfirm(true);
                }}
              />
            )}

          {showConfirm && customer && serviceSelections.length > 0 && date && (
            <ConfirmStep
              customer={customer}
              serviceSelections={serviceSelections}
              date={date}
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
