import { useMemo, useState } from "react";
import { useReports } from "@/hooks/use-reports";
import { useAllCustomers } from "@/hooks/use-all-customers";
import { AppointmentsHourChart } from "@/components/common/appointments-hour-chart";
import { BarbersChart } from "@/components/common/barbers-chart";
import { ServicesChart } from "@/components/common/services-chart";
import { WeekdayChart } from "@/components/common/weekday-chart";
import { Cell, Pie, PieChart } from "recharts";
import {
  Ban,
  Hash,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  XCircle,
  Percent,
  Ticket,
} from "lucide-react";
import { ReportsSkeleton } from "../skeleton/reports-skeleton";

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

function formatMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
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
  highlight?: "green" | "red" | "blue" | "orange";
}) {
  const colors = {
    green: "text-green-500",
    red: "text-red-500",
    blue: "text-blue-500",
    orange: "text-orange-500",
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

// ─── StatusOverview (cards + pie chart) ───────────────────────────────────────

const PIE_COLORS = {
  completed: "#22c55e",
  cancelled: "#ef4444",
  noShow: "#f97316",
  scheduled: "#3b82f6",
};

function StatusOverview({
  total,
  completed,
  cancelled,
  noShow,
  completionRate,
}: {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
}) {
  const scheduled = Math.max(0, total - completed - cancelled - noShow);

  const pieData = [
    { name: "Concluídos", value: completed, color: PIE_COLORS.completed },
    { name: "Cancelados", value: cancelled, color: PIE_COLORS.cancelled },
    { name: "Não compareceu", value: noShow, color: PIE_COLORS.noShow },
    { name: "Agendados", value: scheduled, color: PIE_COLORS.scheduled },
  ].filter(d => d.value > 0);

  const isEmpty = total === 0;

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Visão geral dos agendamentos</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {/* KPI cards lado esquerdo */}
        <div className="grid grid-cols-2 gap-px border-r bg-border">
          {[
            {
              label: "Total",
              value: total,
              icon: <Hash className="h-4 w-4" />,
              highlight: undefined,
            },
            {
              label: "Agendados",
              value: scheduled,
              icon: <CalendarDays className="h-4 w-4" />,
              highlight: "blue" as const,
            },
            {
              label: "Concluídos",
              value: completed,
              icon: <CheckCircle2 className="h-4 w-4" />,
              highlight: "green" as const,
            },
            {
              label: "Cancelados",
              value: cancelled,
              icon: <Ban className="h-4 w-4" />,
              highlight: cancelled > 0 ? ("red" as const) : undefined,
            },
            {
              label: "Não compareceu",
              value: noShow,
              icon: <XCircle className="h-4 w-4" />,
              highlight: noShow > 0 ? ("orange" as const) : undefined,
            },
            {
              label: "Taxa de conclusão",
              value: `${completionRate}%`,
              icon: <Percent className="h-4 w-4" />,
              highlight: (completionRate >= 70
                ? "green"
                : completionRate >= 40
                  ? "blue"
                  : total > 0
                    ? "red"
                    : undefined) as "green" | "blue" | "red" | undefined,
            },
          ].map(card => (
            <div key={card.label} className="bg-card p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.label}
                </span>
                <span className="text-muted-foreground">{card.icon}</span>
              </div>
              <p
                className={`text-2xl font-bold ${
                  card.highlight
                    ? {
                        green: "text-green-500",
                        red: "text-red-500",
                        blue: "text-blue-500",
                        orange: "text-orange-500",
                      }[card.highlight]
                    : ""
                }`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Pie chart lado direito */}
        <div className="flex flex-col items-center justify-center p-4 gap-4">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground opacity-50">
              Sem dados no período.
            </p>
          ) : (
            <>
              <PieChart width={160} height={160}>
                <Pie
                  data={pieData}
                  cx={75}
                  cy={75}
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>

              <div className="flex flex-col gap-1.5 w-full max-w-45">
                {pieData.map(entry => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: entry.color }}
                      />
                      <span className="text-muted-foreground">
                        {entry.name}
                      </span>
                    </div>
                    <span className="font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
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

  const { customers: allCustomers } = useAllCustomers();

  const newCustomersInPeriod = useMemo(() => {
    if (!from || !to) return 0;
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59`).getTime();
    return allCustomers.filter(c => {
      if (!c.created_at) return false;
      // ajusta -3h (BRT naive)
      const createdMs = new Date(c.created_at).getTime() - 3 * 60 * 60 * 1000;
      return createdMs >= fromMs && createdMs <= toMs;
    }).length;
  }, [allCustomers, from, to]);

  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      {/* Header + seletor de período */}
      <div className="flex flex-col gap-3">
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
        <ReportsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
              label="Clientes cadastrados"
              value={newCustomersInPeriod}
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              label="Horas trabalhadas"
              value={formatMinutes(kpis.workedHours)}
              icon={<Clock className="h-4 w-4" />}
              sub="Baseado na duração dos serviços"
            />
          </div>
          {/* Visão geral: cards de status + pie chart */}
          <StatusOverview
            total={kpis.total}
            completed={kpis.completed}
            cancelled={kpis.cancelled}
            noShow={kpis.noShow}
            completionRate={kpis.completionRate}
          />

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
