import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

const chartConfig = {
  concluido: { label: "Concluído", color: "#22c55e" },
  agendado: { label: "Agendado", color: "#3b82f6" },
  cancelado: { label: "Cancelado", color: "#ef4444" },
} satisfies ChartConfig;

interface HourlyData {
  hour: string;
  concluido: number;
  agendado: number;
  cancelado: number;
}

function buildEmpty(): HourlyData[] {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    concluido: 0,
    agendado: 0,
    cancelado: 0,
  }));
}

function toLocalDateStr(date: Date): string {
  return date.toLocaleDateString("en-CA"); 
}

function formatLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Hoje";
  if (date.getTime() === yesterday.getTime()) return "Ontem";
  if (date.getTime() === tomorrow.getTime()) return "Amanhã";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface AppointmentsHourChartProps {
  title?: string;
}

export function AppointmentsHourChart({
  title = "Agendamentos por horário",
}: AppointmentsHourChartProps) {
  const { barbershop } = useBarbershopStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>(buildEmpty());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barbershop?.id) return;

    const dateStr = toLocalDateStr(selectedDate);
    const dayStart = `${dateStr}T00:00:00Z`;
    const dayEnd = `${dateStr}T23:59:59Z`;
    async function fetchData() {
      setLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select("starts_at, status")
        .eq("barbershop_id", barbershop!.id)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd);

      const buckets = Array.from({ length: 24 }, () => ({
        concluido: 0,
        agendado: 0,
        cancelado: 0,
      }));

      for (const apt of data ?? []) {
        const h = new Date(apt.starts_at).getUTCHours();
        if (apt.status === "completed") {
          buckets[h].concluido++;
        } else if (
          apt.status === "cancelled_by_customer" ||
          apt.status === "cancelled_by_barbershop"
        ) {
          buckets[h].cancelado++;
        } else {
          buckets[h].agendado++;
        }
      }

      setHourlyData(
        buckets.map((bucket, h) => ({
          hour: `${String(h).padStart(2, "0")}:00`,
          ...bucket,
        })),
      );
      setLoading(false);
    }

    void fetchData();
  }, [barbershop, selectedDate]);

  function changeDate(delta: number) {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Carregando…
            </span>
          )}
          <button
            onClick={() => changeDate(-1)}
            className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-md font-medium w-14 text-center">
            {formatLabel(selectedDate)}
          </span>
          <button
            onClick={() => changeDate(1)}
            className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <BarChart data={hourlyData} barCategoryGap="30%" barSize={8}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickMargin={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={4}
              allowDecimals={false}
              width={24}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={<ChartTooltipContent />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="concluido"
              stackId="a"
              fill={chartConfig.concluido.color}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="agendado"
              stackId="a"
              fill={chartConfig.agendado.color}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="cancelado"
              stackId="a"
              fill={chartConfig.cancelado.color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
