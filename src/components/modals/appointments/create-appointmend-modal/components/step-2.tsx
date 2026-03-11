import { Button } from "@/components/ui/button";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-service";
import { supabase } from "@/lib/supabase/supabase";
import { Scissors, Sparkles, User } from "lucide-react";
import { useState } from "react";

export function Step2ServiceBarber({
  onSelect,
}: {
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
  }

  const activeBarbers = barbers.filter(b => b.is_active);
  const visibleBarbers =
    eligibleBarberIds === null
      ? activeBarbers
      : activeBarbers.filter(b => eligibleBarberIds.includes(b.id));

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* Services */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Serviço
        </label>

        {loadingServices ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services
              .filter(s => s.is_active)
              .map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectService(s.id)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedService === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.duration_min ? `${s.duration_min} min` : ""}
                    {s.duration_min && s.price ? " · " : ""}
                    {s.price
                      ? `R$ ${Number(s.price).toFixed(2).replace(".", ",")}`
                      : ""}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Barbers — appear after service chosen */}
      {selectedService && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Scissors className="h-3.5 w-3.5" />
            Barbeiro
          </label>

          {loadingBarbers || loadingEligible ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : visibleBarbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum barbeiro disponível para este serviço.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleBarbers.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBarber(b.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedBarber === b.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
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
