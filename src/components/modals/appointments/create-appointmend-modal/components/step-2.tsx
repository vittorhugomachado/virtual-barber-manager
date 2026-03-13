import { Button } from "@/components/ui/button";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-service";
import { supabase } from "@/lib/supabase/supabase";
import { ChevronLeft, Scissors, Sparkles, User } from "lucide-react";
import { useRef, useState } from "react";

export function Step2ServiceBarber({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (serviceId: string, barberId: string) => void;
}) {
  const { services, loading: loadingServices } = useServices();
  const { barbers, loading: loadingBarbers } = useBarbers();

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [eligibleBarberIds, setEligibleBarberIds] = useState<string[] | null>(
    null,
  );
  const [loadingEligible, setLoadingEligible] = useState(false);

  const barberSectionRef = useRef<HTMLDivElement>(null);

  async function handleSelectService(id: string) {
    setSelectedService(id);
    setSelectedBarber(null);
    setLoadingEligible(true);

    // Fetch barbers that offer this service via barber_services join table
    const { data } = await supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", id);

    setEligibleBarberIds(data ? data.map(r => r.barber_id) : []);
    setLoadingEligible(false);

    setTimeout(() => {
      barberSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  const activeBarbers = barbers.filter(b => b.is_active);
  const visibleBarbers =
    eligibleBarberIds === null
      ? activeBarbers
      : activeBarbers.filter(b => eligibleBarberIds.includes(b.id));

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>
      {/* Services */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-md font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Serviço
        </label>

        {loadingServices ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : services.filter(s => s.is_active).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum serviço disponível.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services
              .filter(s => s.is_active)
              .map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectService(s.id)}
                  className={`w-36 flex flex-col items-start gap-0.5 rounded-xl border-2 text-left transition-all cursor-pointer overflow-hidden ${
                    selectedService === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  {s.image_url !== null ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-20 w-full"
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

      {/* Barbers — appear after service chosen */}
      {selectedService && (
        <div ref={barberSectionRef} className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-md font-medium text-muted-foreground">
            <Scissors className="h-3.5 w-3.5" />
            Profissional
          </label>

          {loadingBarbers || loadingEligible ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : visibleBarbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum barbeiro disponível para este serviço.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleBarbers.length > 1 && (
                <button
                  onClick={() => setSelectedBarber("any")}
                  className={`min-w-46 flex justify-center items-center px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedBarber === "any"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">Sem preferência</span>
                  </div>
                </button>
              )}
              {visibleBarbers.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBarber(b.id)}
                  className={`min-w-46 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedBarber === b.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {b.avatar_url ? (
                      <img
                        src={b.avatar_url}
                        alt={b.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        onClick={() =>
          selectedService &&
          selectedBarber &&
          onSelect(selectedService, selectedBarber)
        }
        disabled={!selectedService || !selectedBarber}
        className="cursor-pointer w-full mt-1"
      >
        Continuar
      </Button>
    </div>
  );
}
