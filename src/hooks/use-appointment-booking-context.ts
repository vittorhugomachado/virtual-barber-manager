import { useEffect, useState } from "react";
import { getAppointmentBookingContext } from "@/lib/supabase/appointments/appointments";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentBookingContext } from "@/types/create-appointment";

export function useAppointmentBookingContext(enabled: boolean) {
  const barbershopId = useBarbershopStore(state => state.barbershop?.id);
  const [context, setContext] = useState<AppointmentBookingContext | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setContext(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!barbershopId) {
      setContext(null);
      setLoading(false);
      setError("Barbearia não encontrada.");
      return;
    }

    let active = true;

    async function load() {
      setContext(null);
      setLoading(true);
      setError(null);
      try {
        const result = await getAppointmentBookingContext(barbershopId!);
        if (active) setContext(result);
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os dados do agendamento.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [barbershopId, enabled]);

  return { context, loading, error };
}
