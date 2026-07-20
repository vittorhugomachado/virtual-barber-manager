import { useEffect, useState } from "react";
import {
  appointmentCacheKey,
  getAppointmentCache,
  loadAppointmentCache,
} from "@/lib/appointments-cache";
import { getAppointmentBookingContext } from "@/lib/supabase/appointments/appointments";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentBookingContext } from "@/types/create-appointment";

export function useAppointmentBookingContext(enabled: boolean) {
  const barbershopId = useBarbershopStore(state => state.barbershop?.id);
  const cacheKey = barbershopId
    ? appointmentCacheKey("booking-context", barbershopId)
    : null;
  const cached = cacheKey
    ? getAppointmentCache<AppointmentBookingContext>(cacheKey)
    : undefined;
  const [context, setContext] = useState<AppointmentBookingContext | null>(
    () => cached ?? null,
  );
  const [loading, setLoading] = useState(enabled && cached === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !barbershopId || !cacheKey) return;
    let active = true;

    async function load() {
      setLoading(getAppointmentCache(cacheKey!) === undefined);
      setError(null);
      try {
        const result = await loadAppointmentCache(cacheKey!, () =>
          getAppointmentBookingContext(barbershopId!),
        );
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
  }, [barbershopId, cacheKey, enabled]);

  return { context, loading, error };
}
