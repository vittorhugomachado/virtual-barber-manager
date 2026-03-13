import type { Step } from "@/types/create-appointment";
import { Check } from "lucide-react";

export function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Serviço" },
    { n: 3, label: "Horário" },
  ] as const;

  return (
    <div className="flex items-center justify-center px-6 py-4 bg-muted/20 shrink-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                current > s.n
                  ? "bg-primary text-primary-foreground"
                  : current === s.n
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {current > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span
              className={`text-[13px] font-medium whitespace-nowrap minx-w-36 ${
                current === s.n ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px min-w-12 mx-2 mb-4 transition-all duration-300 ${
                current > s.n ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
