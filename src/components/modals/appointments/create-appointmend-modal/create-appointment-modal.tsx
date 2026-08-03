import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useBarbershopStore } from "@/store/barbershop.store";
import { useAppointmentBookingContext } from "@/hooks/use-appointment-booking-context";
import { createManagerAppointments } from "@/lib/supabase/appointments/appointments";
import {
  appointmentCacheKey,
  invalidateAppointmentCache,
} from "@/lib/appointments-cache";
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
  const {
    context,
    loading: contextLoading,
    error: contextError,
  } = useAppointmentBookingContext(open);
  const idempotencyKey = useRef(crypto.randomUUID());

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
    idempotencyKey.current = crypto.randomUUID();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (
      !customer ||
      serviceSelections.length === 0 ||
      !date ||
      !barbershop ||
      !context
    )
      return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await createManagerAppointments({
        barbershopId: barbershop.id,
        customer,
        localDate: date,
        selections: serviceSelections,
        idempotencyKey: idempotencyKey.current,
      });

      invalidateAppointmentCache(
        appointmentCacheKey("appointments", barbershop.id),
      );

      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const pgError = err as { code?: string; message?: string };
      console.error("[createAppointment] erro:", {
        code: pgError?.code,
        message: pgError?.message,
        inserts: serviceSelections,
      });
      if (
        pgError?.code === "23P01" ||
        pgError?.message?.includes("slot_unavailable")
      ) {
        setSubmitError(
          "Horário indisponível: o profissional já possui um agendamento neste horário.",
        );
      } else if (pgError?.code === "23503") {
        setSubmitError(
          "Dados inválidos: cliente, profissional ou serviço não encontrado. Recarregue a página e tente novamente.",
        );
      } else if (pgError?.message?.includes("subscription_inactive")) {
        setSubmitError(
          "A assinatura da barbearia está inativa. Regularize o pagamento para criar novos agendamentos.",
        );
      } else if (pgError?.message?.includes("barbershop_inactive")) {
        setSubmitError(
          "A barbearia está desativada. Reative a conta para criar novos agendamentos.",
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
            disabled={submitting}
            className="flex items-center justify-center p-1 rounded-xs bg-[#FB2C36] text-white border-0 opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!showConfirm && <StepIndicator current={step} />}

        <div className="overflow-y-auto">
          {contextLoading && (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados do agendamento...
            </div>
          )}

          {!contextLoading && (contextError || !context) && (
            <p className="m-6 rounded-md bg-destructive/10 px-3 py-3 text-sm text-destructive">
              {contextError ?? "Dados do agendamento indisponíveis."}
            </p>
          )}

          {context && !showConfirm && step === 1 && (
            <Step1Customer
              onSelect={c => {
                setCustomer(c);
                setStep(2);
              }}
            />
          )}

          {context && !showConfirm && step === 2 && (
            <Step2Service
              services={context.services}
              onBack={() => setStep(1)}
              onSelect={ids => {
                setServiceIds(ids);
                setStep(3);
              }}
            />
          )}

          {context && !showConfirm && step === 3 && (
            <Step3Date
              openingHours={context.opening_hours}
              timezone={context.timezone}
              onBack={() => setStep(2)}
              onSelect={(d, dObj) => {
                setDate(d);
                setDateObj(dObj);
                setStep(4);
              }}
            />
          )}

          {context &&
            !showConfirm &&
            step === 4 &&
            serviceIds.length > 0 &&
            date &&
            dateObj && (
              <Step4BarberTime
                context={context}
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

          {context &&
            showConfirm &&
            customer &&
            serviceSelections.length > 0 &&
            date && (
              <ConfirmStep
                services={context.services}
                barbers={context.barbers}
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
