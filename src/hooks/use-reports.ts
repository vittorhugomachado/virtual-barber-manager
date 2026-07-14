import { useEffect, useReducer } from "react";
import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";
import { useBarbershopStore } from "@/store/barbershop.store";

export interface ReportsKpis {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
  revenue: number;
  avgTicket: number;
  newCustomers: number;
  workedHours: number;
  uniqueCustomers: number;
}

export interface HourlyReportData {
  hour: string;
  concluido: number;
  agendado: number;
  cancelado: number;
}

export interface BarberReportData {
  name: string;
  total: number;
  completed: number;
}

export interface ServiceReportData {
  name: string;
  total: number;
}

export interface WeekdayReportData {
  day: string;
  total: number;
}

export interface ReportsData {
  kpis: ReportsKpis;
  hourlyData: HourlyReportData[];
  barbersData: BarberReportData[];
  servicesData: ServiceReportData[];
  weekdayData: WeekdayReportData[];
  loading: boolean;
}

type ReportsRpcResponse = {
  kpis?: unknown;
  hourly_data?: unknown;
  barbers_data?: unknown;
  services_data?: unknown;
  weekday_data?: unknown;
};

const EMPTY_KPIS: ReportsKpis = {
  total: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  completionRate: 0,
  revenue: 0,
  avgTicket: 0,
  newCustomers: 0,
  workedHours: 0,
  uniqueCustomers: 0,
};

const EMPTY_REPORTS: Omit<ReportsData, "loading"> = {
  kpis: EMPTY_KPIS,
  hourlyData: [],
  barbersData: [],
  servicesData: [],
  weekdayData: [],
};

type ReportsState = Omit<ReportsData, "loading"> & {
  loading: boolean;
};

type ReportsAction =
  | { type: "loading" }
  | { type: "success"; data: Omit<ReportsData, "loading"> }
  | { type: "error" };

const INITIAL_REPORTS_STATE: ReportsState = {
  ...EMPTY_REPORTS,
  loading: false,
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseKpis(value: unknown): ReportsKpis {
  if (!value || typeof value !== "object") return EMPTY_KPIS;

  const kpis = value as Record<string, unknown>;

  return {
    total: toNumber(kpis.total),
    completed: toNumber(kpis.completed),
    cancelled: toNumber(kpis.cancelled),
    noShow: toNumber(kpis.no_show),
    completionRate: toNumber(kpis.completion_rate),
    revenue: toNumber(kpis.revenue),
    avgTicket: toNumber(kpis.avg_ticket),
    newCustomers: toNumber(kpis.new_customers),
    workedHours: toNumber(kpis.worked_minutes),
    uniqueCustomers: toNumber(kpis.unique_customers),
  };
}

function parseHourlyData(value: unknown): HourlyReportData[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;
      if (typeof row.hour !== "string") return null;

      return {
        hour: row.hour,
        concluido: toNumber(row.concluido),
        agendado: toNumber(row.agendado),
        cancelado: toNumber(row.cancelado),
      };
    })
    .filter((item): item is HourlyReportData => item !== null);
}

function parseBarbersData(value: unknown): BarberReportData[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;
      if (typeof row.name !== "string") return null;

      return {
        name: row.name,
        total: toNumber(row.total),
        completed: toNumber(row.completed),
      };
    })
    .filter((item): item is BarberReportData => item !== null);
}

function parseServicesData(value: unknown): ServiceReportData[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;
      if (typeof row.name !== "string") return null;

      return {
        name: row.name,
        total: toNumber(row.total),
      };
    })
    .filter((item): item is ServiceReportData => item !== null);
}

function parseWeekdayData(value: unknown): WeekdayReportData[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;
      if (typeof row.day !== "string") return null;

      return {
        day: row.day,
        total: toNumber(row.total),
      };
    })
    .filter((item): item is WeekdayReportData => item !== null);
}

function parseReportsPayload(data: ReportsRpcResponse | null | undefined) {
  if (!data) return EMPTY_REPORTS;

  return {
    kpis: parseKpis(data.kpis),
    hourlyData: parseHourlyData(data.hourly_data),
    barbersData: parseBarbersData(data.barbers_data),
    servicesData: parseServicesData(data.services_data),
    weekdayData: parseWeekdayData(data.weekday_data),
  };
}

function reportsReducer(
  state: ReportsState,
  action: ReportsAction,
): ReportsState {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true };
    case "success":
      return { ...action.data, loading: false };
    case "error":
      return { ...EMPTY_REPORTS, loading: false };
    default:
      return state;
  }
}

export function useReports(
  from: string,
  to: string,
  barberId?: string | null,
): ReportsData {
  const { barbershop } = useBarbershopStore();
  const barbershopId = barbershop?.id;
  const [state, dispatchReports] = useReducer(
    reportsReducer,
    INITIAL_REPORTS_STATE,
  );

  useEffect(() => {
    if (!barbershopId || !from || !to) return;

    let cancelled = false;

    async function loadReports() {
      const supabase = await getSupabaseClient();
      if (cancelled) return;

      dispatchReports({ type: "loading" });

      const { data, error } = await supabase.rpc("get_reports_summary", {
        p_barbershop_id: barbershopId,
        p_from: from,
        p_to: to,
        p_barber_id: barberId ?? null,
      });

      if (cancelled) return;

      if (error) {
        console.error("[useReports] get_reports_summary error:", error);
        dispatchReports({ type: "error" });
        return;
      }

      dispatchReports({
        type: "success",
        data: parseReportsPayload(data as ReportsRpcResponse | null),
      });
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [barbershopId, from, to, barberId]);

  return barbershopId ? state : { ...EMPTY_REPORTS, loading: false };
}
