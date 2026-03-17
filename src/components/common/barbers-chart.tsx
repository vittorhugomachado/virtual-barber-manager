import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Scissors } from "lucide-react";
import type { BarberReportData } from "@/hooks/use-reports";

const chartConfig = {
  total: { label: "Total", color: "#3b82f6" },
  completed: { label: "Concluídos", color: "#22c55e" },
} satisfies ChartConfig;

interface BarbersChartProps {
  data: BarberReportData[];
  title?: string;
}

export function BarbersChart({
  data,
  title = "Atendimentos por barbeiro",
}: BarbersChartProps) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Scissors className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-56 text-sm text-muted-foreground opacity-50">
            Sem dados no período.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={data} barCategoryGap="25%" barGap={4}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={24}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={<ChartTooltipContent />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="total"
                fill={chartConfig.total.color}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="completed"
                fill={chartConfig.completed.color}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
