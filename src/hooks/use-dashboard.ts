import { useEffect, useState } from "react";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";
import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";

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

    let cancelled = false;
    const barbershopId = barbershop.id;
    const { dateStr, year, month, monthStr } = getNaiveToday();
    const todayStart = `${dateStr}T00:00:00Z`;
    const todayEnd = `${dateStr}T23:59:59Z`;
    const monthStart = `${year}-${monthStr}-01T00:00:00Z`;
    const nextMonthStart =
      month === 12
        ? `${year + 1}-01-01T00:00:00Z`
        : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;

    async function loadDashboard() {
      const supabase = await getSupabaseClient();
      const [todayRes, monthCompletedRes, totalCustomersRes, newCustomersRes] =
        await Promise.all([
          supabase
            .from("appointments")
            .select(
              `*, customer:customers(id, name, phone), barber:barbers(id, name), service:services(id, name, duration_min, price)`,
            )
            .eq("barbershop_id", barbershopId)
            .gte("starts_at", todayStart)
            .lte("starts_at", todayEnd)
            .order("starts_at"),

          supabase
            .from("appointments")
            .select(
              "starts_at, status, service_id, service:services(id, name, price)",
            )
            .eq("barbershop_id", barbershopId)
            .gte("starts_at", monthStart)
            .lt("starts_at", nextMonthStart),

          supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("barbershop_id", barbershopId),

          supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("barbershop_id", barbershopId)
            .gte("created_at", monthStart)
            .lt("created_at", nextMonthStart),
        ]);

      if (cancelled) return;

      const todayApts = (todayRes.data ?? []) as AppointmentWithRelations[];

      type MonthApt = {
        starts_at: string;
        status: string;
        service_id: string | null;
        service: { id: string; name: string; price: number | null } | null;
      };
      const monthApts = (monthCompletedRes.data ?? []) as unknown as MonthApt[];
      const monthCompleted = monthApts.filter(a => a.status === "completed");

      const revenue = monthCompleted.reduce(
        (sum, apt) => sum + (apt.service?.price ?? 0),
        0,
      );

      const serviceMap = new Map<string, { name: string; count: number }>();
      for (const apt of monthCompleted) {
        if (!apt.service) continue;
        const existing = serviceMap.get(apt.service.id);
        if (existing) existing.count++;
        else
          serviceMap.set(apt.service.id, {
            name: apt.service.name,
            count: 1,
          });
      }
      const top = Array.from(serviceMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTodayAppointments(todayApts);
      setMonthRevenue(revenue);
      setCompletedToday(todayApts.filter(a => a.status === "completed").length);
      setTotalCustomers(totalCustomersRes.count ?? 0);
      setNewCustomersThisMonth(newCustomersRes.count ?? 0);
      setTopServices(top);
      setLoading(false);
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
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
