import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Customer } from "@/types/customer";

export function useCustomers() {
  const { barbershop } = useBarbershopStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop?.id) return;

    Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("customer_id, starts_at")
        .eq("barbershop_id", barbershop.id)
        .not("status", "in", "(cancelled_by_customer,cancelled_by_barbershop)"),
    ]).then(([{ data: customersData }, { data: aptsData }]) => {
      if (customersData) {
        const statsMap = new Map<
          string,
          { total: number; last: string | null }
        >();

        for (const apt of aptsData ?? []) {
          const s = statsMap.get(apt.customer_id);
          if (!s) {
            statsMap.set(apt.customer_id, { total: 1, last: apt.starts_at });
          } else {
            s.total++;
            if (apt.starts_at > (s.last ?? "")) s.last = apt.starts_at;
          }
        }

        setCustomers(
          customersData.map(c => ({
            ...c,
            total_appointments: statsMap.get(c.id)?.total ?? 0,
            last_appointment: statsMap.get(c.id)?.last ?? null,
          })),
        );
      }
      setLoading(false);
    });
  }, [barbershop?.id]);

  return { customers, setCustomers, loading };
}
