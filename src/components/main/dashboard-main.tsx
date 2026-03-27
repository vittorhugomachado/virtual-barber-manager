import { lazy, Suspense, useMemo } from "react";
import { useDashboard } from "@/hooks/use-dashboard";
import { useBarbershopStore } from "@/store/barbershop.store";
import { DashboardSkeleton } from "@/components/skeleton/dashboard-skeleton";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Scissors,
  TrendingUp,
  Users,
  UserPlus,
} from "lucide-react";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
} from "@/types/create-appointment";

const AppointmentsHourChart = lazy(() =>
  import("@/components/common/appointments-hour-chart").then(module => ({
    default: module.AppointmentsHourChart,
  })),
);

function getGreeting() {
  const hour = new Date(
    new Date().getTime() - 3 * 60 * 60 * 1000,
  ).getUTCHours();
  if (hour >= 4 && hour < 13) return "Bom dia";
  if (hour >= 13 && hour < 19) return "Boa tarde";
  return "Boa noite";
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatTodayDate() {
  const naive = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
  return naive.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}

function KpiCard({ label, value, icon, sub }: KpiCardProps) {
  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function BarbershopDashboardMain() {
  const { barbershop } = useBarbershopStore();
  const {
    todayAppointments,
    monthRevenue,
    completedToday,
    totalCustomers,
    newCustomersThisMonth,
    topServices,
    loading,
  } = useDashboard();

  const todayStats = useMemo(() => {
    let agendados = 0,
      concluidos = 0,
      cancelados = 0;
    for (const a of todayAppointments) {
      if (a.status === "completed") concluidos++;
      else if (
        a.status === "cancelled_by_customer" ||
        a.status === "cancelled_by_barbershop"
      )
        cancelados++;
      else agendados++;
    }
    return { agendados, concluidos, cancelados };
  }, [todayAppointments]);

  if (loading) return <DashboardSkeleton />;
  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {barbershop?.owner_name ?? barbershop?.name}!
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {formatTodayDate()}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Agendamentos hoje"
          value={todayAppointments.length}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <KpiCard
          label="Concluídos hoje"
          value={completedToday}
          icon={<CheckCircle2 className="h-4 w-4" />}
          sub={
            todayAppointments.length > 0
              ? `${Math.round((completedToday / todayAppointments.length) * 100)}% dos agendamentos`
              : undefined
          }
        />
        <KpiCard
          label="Faturamento do mês"
          value={formatCurrency(monthRevenue)}
          icon={<TrendingUp className="h-4 w-4" />}
          sub="Serviços concluídos"
        />
        <KpiCard
          label="Total de clientes"
          value={totalCustomers}
          icon={<Users className="h-4 w-4" />}
          sub={
            newCustomersThisMonth > 0
              ? `+${newCustomersThisMonth} este mês`
              : "Nenhum novo este mês"
          }
        />
      </div>

      {/* Main content: Today's schedule + Top services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's schedule */}
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Agenda de hoje</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mr-0.5" />
                {todayStats.agendados}{" "}
                <span className="hidden sm:block ml-0.5">
                  agendado
                  {todayStats.agendados !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0 mr-0.5" />
                {todayStats.concluidos}
                <span className="hidden sm:block ml-0.5">
                  concuído
                  {todayStats.concluidos !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 mr-0.5" />
                {todayStats.cancelados}
                <span className="hidden sm:block ml-0.5">
                  cancelado
                  {todayStats.cancelados !== 1 ? "s" : ""}
                </span>
              </span>
            </div>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <CalendarDays className="h-8 w-8 opacity-20" />
              <span className="text-sm opacity-50">
                Nenhum agendamento para hoje.
              </span>
            </div>
          ) : (
            <div className="divide-y">
              {todayAppointments.map(apt => {
                const cancelled =
                  apt.status === "cancelled_by_customer" ||
                  apt.status === "cancelled_by_barbershop";
                return (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div
                      className={`w-fit flex items-center gap-1 text-xs font-medium shrink-0 ${cancelled ? "opacity-40" : ""}`}
                    >
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      {formatTime(apt.starts_at)}
                    </div>

                    <div
                      className={`flex flex-col min-w-0 flex-1 ${cancelled ? "opacity-40" : ""}`}
                    >
                      <span className="text-sm font-medium truncate">
                        {apt.customer?.name ?? "Cliente removido"}
                      </span>
                      <span className="text-xs text-muted-foreground inline-flex flex-wrap items-center gap-1 truncate">
                        <Scissors className="h-3 w-3 shrink-0" />
                        {apt.barber?.name ?? "Barbeiro removido"}
                        {apt.service && (
                          <>
                            <span>·</span>
                            <span className="truncate">{apt.service.name}</span>
                          </>
                        )}
                      </span>
                    </div>

                    <span
                      className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${APPOINTMENT_STATUS_COLORS[apt.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABELS[apt.status]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Top services */}
          <div className="bg-card border rounded-xl overflow-hidden flex-1">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Top serviços do mês</h2>
            </div>

            {topServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Scissors className="h-6 w-6 opacity-20" />
                <span className="text-xs opacity-50 text-center">
                  Nenhum serviço concluído este mês.
                </span>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                {topServices.map((svc, i) => {
                  const max = topServices[0].count;
                  const pct = Math.round((svc.count / max) * 100);
                  return (
                    <div key={svc.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-muted-foreground font-medium w-4 shrink-0">
                            {i + 1}.
                          </span>
                          <span className="truncate font-medium">
                            {svc.name}
                          </span>
                        </span>
                        <span className="shrink-0 ml-2 text-muted-foreground">
                          {svc.count}×
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* New customers card */}
          <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Novos clientes</p>
              <p className="text-xl font-bold">{newCustomersThisMonth}</p>
              <p className="text-xs text-muted-foreground">este mês</p>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<ChartCardSkeleton />}>
        <AppointmentsHourChart />
      </Suspense>
    </main>
  );
}

function ChartCardSkeleton() {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
      </div>
      <div className="p-4">
        <div className="h-56 w-full rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}
