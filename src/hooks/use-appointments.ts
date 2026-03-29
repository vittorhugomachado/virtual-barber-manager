import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";

type AppointmentRow = Omit<AppointmentWithRelations, "customer"> & {
  customer: null;
};

export function useAppointments(startDate?: Date, endDate?: Date) {
  const { barbershop } = useBarbershopStore();
  const barbershopId = barbershop?.id;
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const startIso =
    startDate?.toISOString() ??
    (() => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return date.toISOString();
    })();

  const endIso =
    endDate?.toISOString() ??
    (() => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 7);
      return date.toISOString();
    })();

  useEffect(() => {
    if (!barbershopId) return;

    let active = true;

    async function loadAppointments() {
      setLoading(true);

      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
            *,
            barber:barbers!appointments_barber_id_fkey(id, name, avatar_url),
            service:services!appointments_service_id_fkey(id, name, duration_min, price)
          `,
        )
        .eq("barbershop_id", barbershopId)
        .gte("starts_at", startIso)
        .lte("starts_at", endIso)
        .order("starts_at");

      if (error) {
        console.error("[useAppointments] error:", error);
        if (!active) return;
        setAppointments([]);
        setLoading(false);
        return;
      }

      type AppointmentRowExtended = AppointmentRow & {
        manual_customer_id: string | null;
      };
      const rows = (data as AppointmentRowExtended[] | null) ?? [];

      const authIds = Array.from(
        new Set(rows.map(row => row.customer_id).filter(Boolean)),
      );
      const manualIds = Array.from(
        new Set(rows.map(row => row.manual_customer_id).filter(Boolean)),
      );

      const customerMap = new Map<
        string,
        {
          id: string;
          name: string;
          phone: string | null;
          source: "customers" | "customers_auth";
        }
      >();

      await Promise.all([
        authIds.length > 0
          ? supabase
              .from("customers_auth")
              .select("id, name, phone")
              .in("id", authIds)
              .then(({ data: authCustomers }) => {
                for (const customer of authCustomers ?? []) {
                  customerMap.set(customer.id, {
                    id: customer.id,
                    name: customer.name?.trim() || "Cliente sem nome",
                    phone: customer.phone,
                    source: "customers_auth",
                  });
                }
              })
          : Promise.resolve(),
        manualIds.length > 0
          ? supabase
              .from("customers")
              .select("id, name, phone")
              .in("id", manualIds)
              .then(({ data: manualCustomers }) => {
                for (const customer of manualCustomers ?? []) {
                  customerMap.set(customer.id, {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    source: "customers",
                  });
                }
              })
          : Promise.resolve(),
      ]);

      if (!active) return;

      setAppointments(
        rows.map(row => {
          const resolvedId = row.customer_id ?? row.manual_customer_id;
          return {
            ...row,
            customer: resolvedId ? (customerMap.get(resolvedId) ?? null) : null,
          };
        }),
      );
      setLoading(false);
    }

    void loadAppointments();

    return () => {
      active = false;
    };
  }, [barbershopId, startIso, endIso, tick]);

  return {
    appointments,
    setAppointments,
    loading,
    refetch: () => setTick(current => current + 1),
  };
}
