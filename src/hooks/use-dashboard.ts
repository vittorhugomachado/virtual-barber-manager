import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";

function getNaiveToday() {
  const naive = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
  const y = naive.getUTCFullYear();
  const m = String(naive.getUTCMonth() + 1).padStart(2, "0");
  const d = String(naive.getUTCDate()).padStart(2, "0");
  const month = naive.getUTCMonth() + 1;
  return {
    dateStr: `${y}-${m}-${d}`,
    year: y,
    month,
    monthStr: m,
  };
}

export interface TopService {
  name: string;
  count: number;
}

export interface DashboardData {
  todayAppointments: AppointmentWithRelations[];
  monthRevenue: number;
  completedToday: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  topServices: TopService[];
  loading: boolean;
}

export function useDashboard(): DashboardData {
  const { barbershop } = useBarbershopStore();
  const [loading, setLoading] = useState(true);
  const [todayAppointments, setTodayAppointments] = useState<
    AppointmentWithRelations[]
  >([]);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
  const [topServices, setTopServices] = useState<TopService[]>([]);

  useEffect(() => {
    if (!barbershop?.id) return;

    const { dateStr, year, month, monthStr } = getNaiveToday();
    const todayStart = `${dateStr}T00:00:00Z`;
    const todayEnd = `${dateStr}T23:59:59Z`;
    const monthStart = `${year}-${monthStr}-01T00:00:00Z`;
    const nextMonthStart =
      month === 12
        ? `${year + 1}-01-01T00:00:00Z`
        : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;

    Promise.all([
      supabase
        .from("appointments")
        .select(
          `*, customer:customers(id, name, phone), barber:barbers(id, name), service:services(id, name, duration_min, price)`,
        )
        .eq("barbershop_id", barbershop.id)
        .gte("starts_at", todayStart)
        .lte("starts_at", todayEnd)
        .order("starts_at"),

      supabase
        .from("appointments")
        .select("service_id, service:services(id, name, price)")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "completed")
        .gte("starts_at", monthStart)
        .lt("starts_at", nextMonthStart),

      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", barbershop.id),

      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", barbershop.id)
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart),
    ]).then(
      ([todayRes, monthCompletedRes, totalCustomersRes, newCustomersRes]) => {
        const todayApts = (todayRes.data ?? []) as AppointmentWithRelations[];
        const monthCompleted = monthCompletedRes.data ?? [];

        const revenue = monthCompleted.reduce((sum, apt) => {
          const price = (apt.service as { price: number | null } | null)?.price;
          return sum + (price ?? 0);
        }, 0);

        const serviceMap = new Map<string, { name: string; count: number }>();
        for (const apt of monthCompleted) {
          const svc = apt.service as { id: string; name: string } | null;
          if (!svc) continue;
          const existing = serviceMap.get(svc.id);
          if (existing) existing.count++;
          else serviceMap.set(svc.id, { name: svc.name, count: 1 });
        }
        const top = Array.from(serviceMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTodayAppointments(todayApts);
        setMonthRevenue(revenue);
        setCompletedToday(
          todayApts.filter(a => a.status === "completed").length,
        );
        setTotalCustomers(totalCustomersRes.count ?? 0);
        setNewCustomersThisMonth(newCustomersRes.count ?? 0);
        setTopServices(top);
        setLoading(false);
      },
    );
  }, [barbershop?.id]);

  return {
    todayAppointments,
    monthRevenue,
    completedToday,
    totalCustomers,
    newCustomersThisMonth,
    topServices,
    loading,
  };
}
