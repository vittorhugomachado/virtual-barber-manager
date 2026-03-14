import { useServices } from "@/hooks/use-service";
import { ChevronLeft, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Step2Service({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (serviceId: string) => void;
}) {
  const { services, loading } = useServices();
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const activeServices = services.filter(s => s.is_active);

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="flex flex-col gap-2">
        <label className="text-md font-medium text-muted-foreground ml-2">
          Serviço
        </label>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : activeServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum serviço disponível.
          </p>
        ) : (
          <div
            className="grid grid-cols-1 justify-center
  min-[385px]:grid-cols-2
  min-[545px]:grid-cols-3
  min-[545px]:max-w-3xl
  mx-auto gap-2"
          >
            {activeServices.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedService(s.id)}
                className={`w-full flex flex-col items-start gap-0.5 rounded-xl border-2 text-left transition-all cursor-pointer overflow-hidden ${
                  selectedService === s.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.name}
                    className="h-20 w-full object-cover"
                  />
                ) : (
                  <div className="h-20 w-full flex items-center justify-center bg-muted">
                    <Scissors className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="flex flex-col px-3 py-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.duration_min ? `${s.duration_min} min` : ""}
                    {s.duration_min && s.price ? " · " : ""}
                    {s.price
                      ? `R$ ${Number(s.price).toFixed(2).replace(".", ",")}`
                      : ""}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={() => selectedService && onSelect(selectedService)}
        disabled={!selectedService}
        className="cursor-pointer w-full mt-1"
      >
        Continuar
      </Button>
    </div>
  );
}
