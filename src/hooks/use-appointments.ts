import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";

export function useAppointments(startDate?: Date, endDate?: Date) {
  const { barbershop } = useBarbershopStore();
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const startIso =
    startDate?.toISOString() ??
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    })();

  const endIso =
    endDate?.toISOString() ??
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 7);
      return d.toISOString();
    })();

  useEffect(() => {
    if (!barbershop?.id) return;

    supabase
      .from("appointments")
      .select(
        `*, customer:customers(id, name, phone), barber:barbers(id, name), service:services(id, name, duration_min, price)`,
      )
      .eq("barbershop_id", barbershop.id)
      .gte("starts_at", startIso)
      .lte("starts_at", endIso)
      .order("starts_at")
      .then(({ data }) => {
        setAppointments(data ? (data as AppointmentWithRelations[]) : []);
        setLoading(false);
      });
  }, [barbershop?.id, startIso, endIso, tick]);

  return {
    appointments,
    setAppointments,
    loading,
    refetch: () => setTick(t => t + 1),
  };
}
