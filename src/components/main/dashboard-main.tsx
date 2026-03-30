import { lazy, Suspense, useMemo } from "react";
import { useDashboard } from "@/hooks/use-dashboard";
import { useAllCustomers } from "@/hooks/use-all-customers";
import { useBarbershopStore } from "@/store/barbershop.store";
import { DashboardSkeleton } from "@/components/skeleton/dashboard-skeleton";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Scissors,
  Users,
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
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
  alert?: string;
}

function KpiCard({ label, value, icon, sub, alert }: KpiCardProps) {
  return (
    <div
      className={`bg-card rounded-xl p-4 flex flex-col gap-3 ${
        alert ? "border border-yellow-500/60" : "border"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>

      <p className="text-2xl font-bold">{value}</p>

      {alert ? (
        <div className="flex items-start gap-2 text-xs text-yellow-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{alert}</p>
        </div>
      ) : (
        sub && <p className="text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

export function BarbershopDashboardMain() {
  const { barbershop } = useBarbershopStore();
  const {
    todayAppointments,
    monthRevenue,
    completedToday,
    activeServices,
    activeProfessionals,
    topServices,
    loading,
  } = useDashboard();
  const { customers: allCustomers } = useAllCustomers();

  const newCustomersThisMonth = useMemo(() => {
    const naive = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
    const monthStart = new Date(
      Date.UTC(naive.getUTCFullYear(), naive.getUTCMonth(), 1),
    ).getTime();
    const monthEnd = new Date(
      Date.UTC(naive.getUTCFullYear(), naive.getUTCMonth() + 1, 1),
    ).getTime();

    return allCustomers.filter(customer => {
      if (!customer.created_at) return false;

      const createdAtMs =
        new Date(customer.created_at).getTime() - 3 * 60 * 60 * 1000;

      return createdAtMs >= monthStart && createdAtMs < monthEnd;
    }).length;
  }, [allCustomers]);

  const todayStats = useMemo(() => {
    let agendados = 0;
    let concluidos = 0;
    let cancelados = 0;
    let naoCompareceu = 0;

    for (const appointment of todayAppointments) {
      if (appointment.status === "completed") {
        concluidos++;
        continue;
      }

      if (
        appointment.status === "cancelled_by_customer" ||
        appointment.status === "cancelled_by_barbershop"
      ) {
        cancelados++;
        continue;
      }

      if (appointment.status === "no_show") {
        naoCompareceu++;
        continue;
      }

      agendados++;
    }

    return { agendados, concluidos, cancelados, naoCompareceu };
  }, [todayAppointments]);

  if (loading) return <DashboardSkeleton />;

  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {getGreeting()} {barbershop?.owner_name ?? barbershop?.name}!
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {formatTodayDate()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
        <KpiCard
          label="Agendamentos hoje"
          value={todayAppointments.length}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <KpiCard
          label="Concluidos hoje"
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
          icon={<DollarSign className="h-4 w-4" />}
          sub="Serviços concluídos"
        />
        <KpiCard
          label="Total de clientes"
          value={allCustomers.length}
          icon={<Users className="h-4 w-4" />}
          sub={
            newCustomersThisMonth > 0
              ? `+${newCustomersThisMonth} este mes`
              : "Nenhum novo este mes"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Agenda de hoje</h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mr-0.5" />
                {todayStats.agendados}
                <span className="hidden sm:block ml-0.5">
                  agendado{todayStats.agendados !== 1 ? "s" : ""}
                </span>
              </span>

              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0 mr-0.5" />
                {todayStats.concluidos}
                <span className="hidden sm:block ml-0.5">
                  concluido{todayStats.concluidos !== 1 ? "s" : ""}
                </span>
              </span>

              <span className="inline-flex items-center text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 mr-0.5" />
                {todayStats.cancelados}
                <span className="hidden sm:block ml-0.5">
                  cancelado{todayStats.cancelados !== 1 ? "s" : ""}
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
              {todayAppointments.map(appointment => {
                const cancelled =
                  appointment.status === "cancelled_by_customer" ||
                  appointment.status === "cancelled_by_barbershop";

                return (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div
                      className={`w-fit flex items-center gap-1 text-xs font-medium shrink-0 ${cancelled ? "opacity-40" : ""}`}
                    >
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      {formatTime(appointment.starts_at)}
                    </div>

                    <div
                      className={`flex min-w-0 flex-1 flex-col ${cancelled ? "opacity-40" : ""}`}
                    >
                      <span className="truncate text-sm font-medium">
                        {appointment.customer_name ?? "Cliente removido"}
                      </span>

                      <span className="inline-flex flex-wrap items-center gap-1 truncate text-xs text-muted-foreground">
                        <Scissors className="h-3 w-3 shrink-0" />
                        {appointment.barber_name ?? "Barbeiro removido"}
                        {appointment.service_name && (
                          <>
                            <span>·</span>
                            <span className="truncate">
                              {appointment.service_name}
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${APPOINTMENT_STATUS_COLORS[appointment.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABELS[appointment.status]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <KpiCard
            label="Serviços ativos"
            value={activeServices}
            icon={<Scissors className="h-4 w-4" />}
            alert={
              activeServices === 0
                ? "Voce não possui serviços ativos"
                : undefined
            }
            sub={
              activeServices > 0 ? "Disponiveis para agendamento" : undefined
            }
          />

          <KpiCard
            label="Profissionais ativos"
            value={activeProfessionals}
            icon={<Users className="h-4 w-4" />}
            alert={
              activeProfessionals === 0
                ? "Voce não possui profissionais ativos"
                : undefined
            }
            sub={
              activeProfessionals > 0
                ? "Disponiveis para atendimento"
                : undefined
            }
          />

          <div className="bg-card border rounded-xl overflow-hidden flex-1">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Top servicos do mes</h2>
            </div>

            {topServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Scissors className="h-6 w-6 opacity-20" />
                <span className="text-center text-xs opacity-50">
                  Nenhum servico concluido este mes.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-4">
                {topServices.map((service, index) => {
                  const maxCount = topServices[0].count;
                  const percentage = Math.round(
                    (service.count / maxCount) * 100,
                  );

                  return (
                    <div key={service.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="w-4 shrink-0 font-medium text-muted-foreground">
                            {index + 1}.
                          </span>
                          <span className="truncate font-medium">
                            {service.name}
                          </span>
                        </span>

                        <span className="ml-2 shrink-0 text-muted-foreground">
                          {service.count}x
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
