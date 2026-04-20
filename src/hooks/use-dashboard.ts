import { useEffect, useState } from "react";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";
import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";

export const DASHBOARD_REFRESH_EVENT = "dashboard-refresh";

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
  activeServices: number;
  activeProfessionals: number;
  topServices: TopService[];
  loading: boolean;
}

export function useDashboard(): DashboardData {
  const { barbershop } = useBarbershopStore();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<
    AppointmentWithRelations[]
  >([]);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
  const [activeServices, setActiveServices] = useState(0);
  const [activeProfessionals, setActiveProfessionals] = useState(0);
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
      const [
        todayRes,
        monthCompletedRes,
        totalCustomersRes,
        newCustomersRes,
        activeServicesRes,
        activeProfessionalsRes,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("*")
          .eq("barbershop_id", barbershopId)
          .gte("starts_at", todayStart)
          .lte("starts_at", todayEnd)
          .order("starts_at"),

        supabase
          .from("appointments")
          .select("starts_at, status, service_name, service_price")
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

        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true),

        supabase
          .from("barbers")
          .select("id", { count: "exact", head: true })
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true),
      ]);

      if (cancelled) return;

      const todayApts = (todayRes.data ?? []) as AppointmentWithRelations[];

      type MonthApt = {
        starts_at: string;
        status: string;
        service_name: string | null;
        service_price: string | number | null;
      };
      const monthApts = (monthCompletedRes.data ?? []) as unknown as MonthApt[];
      const monthCompleted = monthApts.filter(a => a.status === "completed");

      const revenue = monthCompleted.reduce(
        (sum, apt) => sum + Number(apt.service_price ?? 0),
        0,
      );

      const serviceMap = new Map<string, { name: string; count: number }>();
      for (const apt of monthCompleted) {
        if (!apt.service_name) continue;
        const existing = serviceMap.get(apt.service_name);
        if (existing) existing.count++;
        else
          serviceMap.set(apt.service_name, {
            name: apt.service_name,
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
      setActiveServices(activeServicesRes.count ?? 0);
      setActiveProfessionals(activeProfessionalsRes.count ?? 0);
      setTopServices(top);
      setLoading(false);
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [barbershop?.id, refreshKey]);

  useEffect(() => {
    if (!barbershop?.id) return;

    let active = true;
    const barbershopId = barbershop.id;
    let currentChannel: { unsubscribe: () => unknown } | null = null;

    async function setupRealtime() {
      const supabase = await getSupabaseClient();
      if (!active) return;

      currentChannel = supabase
        .channel(`dashboard:${barbershopId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "services",
            filter: `barbershop_id=eq.${barbershopId}`,
          },
          () => setRefreshKey(current => current + 1),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "barbers",
            filter: `barbershop_id=eq.${barbershopId}`,
          },
          () => setRefreshKey(current => current + 1),
        )
        .subscribe();
    }
    void setupRealtime();

    return () => {
      active = false;
      if (currentChannel) {
        void currentChannel.unsubscribe();
      }
    };
  }, [barbershop?.id]);

  useEffect(() => {
    function handleRefresh() {
      setRefreshKey(current => current + 1);
    }

    window.addEventListener(DASHBOARD_REFRESH_EVENT, handleRefresh);

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handleRefresh);
    };
  }, []);

  return {
    todayAppointments,
    monthRevenue,
    completedToday,
    totalCustomers,
    newCustomersThisMonth,
    activeServices,
    activeProfessionals,
    topServices,
    loading,
  };
}
