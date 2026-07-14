import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Customer } from "@/types/customer";

export function useCustomers() {
  const { barbershop } = useBarbershopStore();
  const barbershopId = barbershop?.id;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barbershopId) return;

    let active = true;

    async function loadCustomers() {
      setLoading(true);

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, barbershop_id, name, phone, created_at, updated_at")
        .eq("barbershop_id", barbershopId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (customersError) {
        console.error("[useCustomers] customers error:", customersError);
        setCustomers([]);
        setLoading(false);
        return;
      }

      const customerIds = (customersData ?? []).map(customer => customer.id);
      const statsMap = new Map<string, { total: number; last: string | null }>();

      if (customerIds.length > 0) {
        const { data: appointmentsData, error: appointmentsError } =
          await supabase
            .from("appointments")
            .select("customer_id, starts_at")
            .eq("barbershop_id", barbershopId)
            .in("customer_id", customerIds)
            .not(
              "status",
              "in",
              "(cancelled_by_customer,cancelled_by_barbershop)",
            );

        if (!active) return;

        if (appointmentsError) {
          console.error("[useCustomers] appointments error:", appointmentsError);
        }

        for (const appointment of appointmentsData ?? []) {
          if (!appointment.customer_id) continue;

          const current = statsMap.get(appointment.customer_id);
          if (!current) {
            statsMap.set(appointment.customer_id, {
              total: 1,
              last: appointment.starts_at,
            });
            continue;
          }

          current.total += 1;
          if (appointment.starts_at > (current.last ?? "")) {
            current.last = appointment.starts_at;
          }
        }
      }

      if (!active) return;

      setCustomers(
        (customersData ?? []).map(customer => {
          const stats = statsMap.get(customer.id);

          return {
            ...customer,
            total_appointments: stats?.total ?? 0,
            last_appointment: stats?.last ?? null,
            source: "customers" as const,
          };
        }),
      );
      setLoading(false);
    }

    void loadCustomers();

    return () => {
      active = false;
    };
  }, [barbershopId]);

  return {
    customers: barbershopId ? customers : [],
    setCustomers,
    loading: barbershopId ? loading : false,
  };
}
