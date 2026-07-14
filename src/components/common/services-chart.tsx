import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Scissors } from "lucide-react";
import type { ServiceReportData } from "@/hooks/use-reports";

const chartConfig = {
  total: { label: "Realizados", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

interface ServicesChartProps {
  data: ServiceReportData[];
  title?: string;
}

export function ServicesChart({
  data,
  title = "Serviços mais realizados",
}: ServicesChartProps) {
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
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
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
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="total" fill="#0458EE" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
