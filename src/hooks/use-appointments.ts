import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appointmentCacheKey,
  deleteAppointmentCache,
  getAppointmentCache,
  loadAppointmentCache,
  setAppointmentCache,
} from "@/lib/appointments-cache";
import { getManagerAppointments } from "@/lib/supabase/appointments/appointments";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";

type CachedAppointments = {
  items: AppointmentWithRelations[];
  timezone: string;
};

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function useAppointments(startDate?: Date, endDateExclusive?: Date) {
  const barbershop = useBarbershopStore(state => state.barbershop);
  const barbershopId = barbershop?.id;
  const fallbackRange = useMemo(defaultRange, []);
  const fromDate = toLocalDateKey(startDate ?? fallbackRange.start);
  const toDateExclusive = toLocalDateKey(endDateExclusive ?? fallbackRange.end);
  const cacheKey = barbershopId
    ? appointmentCacheKey(
        "appointments",
        barbershopId,
        fromDate,
        toDateExclusive,
      )
    : null;
  const cached = cacheKey
    ? getAppointmentCache<CachedAppointments>(cacheKey)
    : undefined;

  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(
    () => cached?.items ?? [],
  );
  const [timezone, setTimezone] = useState(
    () => cached?.timezone ?? barbershop?.timezone ?? "America/Sao_Paulo",
  );
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!barbershopId || !cacheKey) return;
    let active = true;

    async function load() {
      setLoading(getAppointmentCache(cacheKey!) === undefined);
      setError(null);
      try {
        const result = await loadAppointmentCache<CachedAppointments>(
          cacheKey!,
          () =>
            getManagerAppointments({
              barbershopId: barbershopId!,
              fromDate,
              toDateExclusive,
            }),
          60_000,
        );
        if (!active) return;
        setAppointments(result.items);
        setTimezone(result.timezone);
      } catch (cause) {
        if (!active) return;
        setAppointments([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os agendamentos.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [barbershopId, cacheKey, fromDate, reloadToken, toDateExclusive]);

  useEffect(() => {
    function refreshExpiredCache() {
      if (cacheKey && getAppointmentCache(cacheKey) === undefined) {
        setReloadToken(current => current + 1);
      }
    }

    window.addEventListener("focus", refreshExpiredCache);
    return () => window.removeEventListener("focus", refreshExpiredCache);
  }, [cacheKey]);

  const updateAppointments = useCallback(
    (
      updater: (
        current: AppointmentWithRelations[],
      ) => AppointmentWithRelations[],
    ) => {
      setAppointments(current => {
        const next = updater(current);
        if (cacheKey) {
          setAppointmentCache<CachedAppointments>(
            cacheKey,
            {
              items: next,
              timezone,
            },
            60_000,
          );
        }
        return next;
      });
    },
    [cacheKey, timezone],
  );

  const refetch = useCallback(() => {
    if (cacheKey) deleteAppointmentCache(cacheKey);
    setReloadToken(current => current + 1);
  }, [cacheKey]);

  return {
    appointments,
    setAppointments: updateAppointments,
    timezone,
    loading,
    error,
    refetch,
  };
}
