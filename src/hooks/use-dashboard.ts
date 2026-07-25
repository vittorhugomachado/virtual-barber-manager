import { useEffect, useReducer } from "react";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { AppointmentWithRelations } from "@/types/create-appointment";
import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";

export const DASHBOARD_REFRESH_EVENT = "dashboard-refresh";

export interface TopService {
  name: string;
  count: number;
}

export interface DashboardHourlyData {
  hour: string;
  concluido: number;
  agendado: number;
  cancelado: number;
}

export interface DashboardData {
  todayAppointments: AppointmentWithRelations[];
  monthRevenue: number;
  completedToday: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeServices: number;
  activeProfessionals: number;
  hourlyData: DashboardHourlyData[];
  topServices: TopService[];
  loading: boolean;
}

type DashboardRpcResponse = {
  today_appointments?: unknown;
  month_revenue?: unknown;
  completed_today?: unknown;
  total_customers?: unknown;
  new_customers_this_month?: unknown;
  active_services?: unknown;
  active_professionals?: unknown;
  hourly_data?: unknown;
  top_services?: unknown;
};

const EMPTY_DASHBOARD: Omit<DashboardData, "loading"> = {
  todayAppointments: [],
  monthRevenue: 0,
  completedToday: 0,
  totalCustomers: 0,
  newCustomersThisMonth: 0,
  activeServices: 0,
  activeProfessionals: 0,
  hourlyData: [],
  topServices: [],
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTopServices(value: unknown): TopService[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(service => {
      if (!service || typeof service !== "object") return null;

      const item = service as { name?: unknown; count?: unknown };
      if (typeof item.name !== "string") return null;

      return {
        name: item.name,
        count: toNumber(item.count),
      };
    })
    .filter((service): service is TopService => service !== null);
}

function parseHourlyData(value: unknown): DashboardHourlyData[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const row = item as {
        hour?: unknown;
        concluido?: unknown;
        agendado?: unknown;
        cancelado?: unknown;
      };

      if (typeof row.hour !== "string") return null;

      return {
        hour: row.hour,
        concluido: toNumber(row.concluido),
        agendado: toNumber(row.agendado),
        cancelado: toNumber(row.cancelado),
      };
    })
    .filter((item): item is DashboardHourlyData => item !== null);
}

function parseDashboardPayload(data: DashboardRpcResponse | null | undefined) {
  if (!data) return EMPTY_DASHBOARD;

  return {
    todayAppointments: Array.isArray(data.today_appointments)
      ? (data.today_appointments as AppointmentWithRelations[])
      : [],
    monthRevenue: toNumber(data.month_revenue),
    completedToday: toNumber(data.completed_today),
    totalCustomers: toNumber(data.total_customers),
    newCustomersThisMonth: toNumber(data.new_customers_this_month),
    activeServices: toNumber(data.active_services),
    activeProfessionals: toNumber(data.active_professionals),
    hourlyData: parseHourlyData(data.hourly_data),
    topServices: parseTopServices(data.top_services),
  };
}

type DashboardState = {
  data: Omit<DashboardData, "loading">;
  loading: boolean;
};

type DashboardAction =
  | { type: "loading" }
  | { type: "success"; data: Omit<DashboardData, "loading"> }
  | { type: "error" };

const INITIAL_DASHBOARD_STATE: DashboardState = {
  data: EMPTY_DASHBOARD,
  loading: false,
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true };
    case "success":
      return { data: action.data, loading: false };
    case "error":
      return { data: EMPTY_DASHBOARD, loading: false };
    default:
      return state;
  }
}

function refreshReducer(current: number) {
  return current + 1;
}

export function useDashboard(): DashboardData {
  const { barbershop } = useBarbershopStore();
  const barbershopId = barbershop?.id;
  const [state, dispatchDashboard] = useReducer(
    dashboardReducer,
    INITIAL_DASHBOARD_STATE,
  );
  const [refreshKey, refreshDashboard] = useReducer(refreshReducer, 0);

  useEffect(() => {
    if (!barbershopId) return;

    let cancelled = false;

    async function loadDashboard() {
      const supabase = await getSupabaseClient();
      if (cancelled) return;

      dispatchDashboard({ type: "loading" });

      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_barbershop_id: barbershopId,
        p_for_date: null,
      });

      if (cancelled) return;

      if (error) {
        console.error("[useDashboard] get_dashboard_summary error:", error);
        dispatchDashboard({ type: "error" });
        return;
      }

      dispatchDashboard({
        type: "success",
        data: parseDashboardPayload(data as DashboardRpcResponse | null),
      });
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [barbershopId, refreshKey]);

  useEffect(() => {
    if (!barbershopId) return;

    let active = true;
    let currentChannel: { unsubscribe: () => unknown } | null = null;

    async function setupRealtime() {
      const supabase = await getSupabaseClient();
      if (!active) return;

      let channel = supabase.channel(`dashboard:${barbershopId}`);
      for (const table of [
        "appointments",
        "customers",
        "services",
        "barbers",
      ]) {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `barbershop_id=eq.${barbershopId}`,
          },
          () => refreshDashboard(),
        );
      }

      currentChannel = channel.subscribe();
    }

    void setupRealtime();

    return () => {
      active = false;
      if (currentChannel) {
        void currentChannel.unsubscribe();
      }
    };
  }, [barbershopId]);

  useEffect(() => {
    function handleRefresh() {
      refreshDashboard();
    }

    window.addEventListener(DASHBOARD_REFRESH_EVENT, handleRefresh);

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handleRefresh);
    };
  }, []);

  return {
    ...(barbershopId ? state.data : EMPTY_DASHBOARD),
    loading: barbershopId ? state.loading : false,
  };
}
