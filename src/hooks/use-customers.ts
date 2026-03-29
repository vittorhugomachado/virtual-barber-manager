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

    supabase
      .from("customers")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("created_at", { ascending: false })
      .then(async ({ data: customersData }) => {
        if (!customersData) {
          setLoading(false);
          return;
        }

        // Collect phones to look up matching customers_auth entries
        const phones = customersData
          .map(c => c.phone?.replace(/\D/g, ""))
          .filter(Boolean) as string[];

        // phone → customers_auth.id
        const phoneToAuthId = new Map<string, string>();
        if (phones.length > 0) {
          const { data: authRows } = await supabase
            .from("customers_auth")
            .select("id, phone")
            .in("phone", phones);

          for (const row of authRows ?? []) {
            if (row.phone) phoneToAuthId.set(row.phone, row.id);
          }
        }

        const authIds = [...phoneToAuthId.values()];

        // Fetch appointments by customers_auth ids
        const statsMap = new Map<string, { total: number; last: string | null }>();
        if (authIds.length > 0) {
          const { data: aptsData } = await supabase
            .from("appointments")
            .select("customer_id, starts_at")
            .eq("barbershop_id", barbershop.id)
            .in("customer_id", authIds)
            .not("status", "in", "(cancelled_by_customer,cancelled_by_barbershop)");

          // authId → stats
          const authStatsMap = new Map<string, { total: number; last: string | null }>();
          for (const apt of aptsData ?? []) {
            const s = authStatsMap.get(apt.customer_id);
            if (!s) {
              authStatsMap.set(apt.customer_id, { total: 1, last: apt.starts_at });
            } else {
              s.total++;
              if (apt.starts_at > (s.last ?? "")) s.last = apt.starts_at;
            }
          }

          // Map back: phone → stats (via authId)
          for (const [phone, authId] of phoneToAuthId) {
            const stats = authStatsMap.get(authId);
            if (stats) statsMap.set(phone, stats);
          }
        }

        setCustomers(
          customersData.map(c => {
            const phone = c.phone?.replace(/\D/g, "") ?? "";
            const stats = statsMap.get(phone);
            return {
              ...c,
              total_appointments: stats?.total ?? 0,
              last_appointment: stats?.last ?? null,
            };
          }),
        );
        setLoading(false);
      });
  }, [barbershop?.id]);

  return { customers, setCustomers, loading };
}
