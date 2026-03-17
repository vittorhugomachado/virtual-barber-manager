import { useMemo, useState } from "react";
import { useReports } from "@/hooks/use-reports";
import { AppointmentsHourChart } from "@/components/common/appointments-hour-chart";
import { BarbersChart } from "@/components/common/barbers-chart";
import { ServicesChart } from "@/components/common/services-chart";
import { WeekdayChart } from "@/components/common/weekday-chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  UserCheck,
  Users,
  XCircle,
  Percent,
  Ticket,
} from "lucide-react";

// ─── Tipos de período ─────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "year" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  year: "Este ano",
  custom: "Personalizado",
};

function getRange(
  period: Period,
  custom: { from: string; to: string },
): { from: string; to: string; label: string } {
  const today = new Date();

  if (period === "today") {
    const from = today.toLocaleDateString("en-CA");
    return { from, to: from, label: fmtBR(from) };
  }

  if (period === "week") {
    const dow = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const from = mon.toLocaleDateString("en-CA");
    const to = sun.toLocaleDateString("en-CA");
    return { from, to, label: `${fmtBR(from)} – ${fmtBR(to)}` };
  }

  if (period === "month") {
    const from = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    ).toLocaleDateString("en-CA");
    const to = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).toLocaleDateString("en-CA");
    return { from, to, label: `${fmtBR(from)} – ${fmtBR(to)}` };
  }

  if (period === "year") {
    const from = `${today.getFullYear()}-01-01`;
    const to = `${today.getFullYear()}-12-31`;
    return { from, to, label: String(today.getFullYear()) };
  }

  // custom
  if (custom.from && custom.to) {
    return {
      from: custom.from,
      to: custom.to,
      label: `${fmtBR(custom.from)} – ${fmtBR(custom.to)}`,
    };
  }
  return { from: "", to: "", label: "—" };
}

function fmtBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
  highlight?: "green" | "red" | "blue";
}) {
  const colors = {
    green: "text-green-500",
    red: "text-red-500",
    blue: "text-blue-500",
  };

  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? colors[highlight] : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── ReportsMain ──────────────────────────────────────────────────────────────

export function ReportsMain() {
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const { from, to, label } = useMemo(
    () => getRange(period, custom),
    [period, custom],
  );

  const { kpis, hourlyData, barbersData, servicesData, weekdayData, loading } =
    useReports(from, to);
  const canFetch = !!from && !!to;

  console.log(kpis.uniqueCustomers);
  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      {/* Header + seletor de período */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Relatórios</h1>

        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "month", "year", "custom"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                De
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={custom.from}
                  onChange={e =>
                    setCustom(r => ({ ...r, from: e.target.value }))
                  }
                  style={{ colorScheme: "light" }}
                  className="h-8 rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Até
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={e => setCustom(r => ({ ...r, to: e.target.value }))}
                  style={{ colorScheme: "light" }}
                  className="h-8 rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {label && label !== "—" && (
          <p className="text-sm text-muted-foreground">{label}</p>
        )}
      </div>

      {/* Bloco principal */}
      {!canFetch ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Selecione um intervalo de datas para ver os relatórios.
        </p>
      ) : loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* KPI Cards — 2 colunas mobile, 4 desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <KpiCard
              label="Total de agendamentos"
              value={kpis.total}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <KpiCard
              label="Concluídos"
              value={kpis.completed}
              icon={<CheckCircle2 className="h-4 w-4" />}
              highlight="green"
              sub={
                kpis.total > 0 ? `${kpis.completionRate}% do total` : undefined
              }
            />
            <KpiCard
              label="Cancelados"
              value={kpis.cancelled}
              icon={<Ban className="h-4 w-4" />}
              highlight={kpis.cancelled > 0 ? "red" : undefined}
            />
            <KpiCard
              label="Não compareceu"
              value={kpis.noShow}
              icon={<XCircle className="h-4 w-4" />}
            />
            <KpiCard
              label="Faturamento"
              value={formatCurrency(kpis.revenue)}
              icon={<DollarSign className="h-4 w-4" />}
              sub="Serviços concluídos"
            />
            <KpiCard
              label="Ticket médio"
              value={formatCurrency(kpis.avgTicket)}
              icon={<Ticket className="h-4 w-4" />}
            />
            <KpiCard
              label="Taxa de conclusão"
              value={`${kpis.completionRate}%`}
              icon={<Percent className="h-4 w-4" />}
              highlight={
                kpis.completionRate >= 70
                  ? "green"
                  : kpis.completionRate >= 40
                    ? "blue"
                    : "red"
              }
            />
            <KpiCard
              label="Clientes atendidos"
              value={kpis.uniqueCustomers}
              icon={<Users className="h-4 w-4" />}
              sub={
                kpis.newCustomers > 0
                  ? `${kpis.newCustomers} novos no período`
                  : undefined
              }
            />
            <KpiCard
              label="Horas trabalhadas"
              value={`${kpis.workedHours}h`}
              icon={<Clock className="h-4 w-4" />}
              sub="Baseado na duração dos serviços"
            />
            <KpiCard
              label="Novos clientes"
              value={kpis.newCustomers}
              icon={<UserCheck className="h-4 w-4" />}
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AppointmentsHourChart
              title="Agendamentos por horário"
              externalData={hourlyData}
              dateLabel={label}
            />
            <WeekdayChart data={weekdayData} />
            <BarbersChart data={barbersData} />
            <ServicesChart data={servicesData} />
          </div>
        </>
      )}
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="p-4">
              <Skeleton className="h-56 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
