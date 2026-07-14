import { useEffect, useState } from "react";
import { getSettingsAlerts } from "@/lib/supabase/settings/get-settings-alerts";
import { useBarbershopStore } from "@/store/barbershop.store";
import { useSettingsAlertsStore } from "@/store/settings-alerts.store";

export function useSettingsAlerts() {
  const barbershop = useBarbershopStore(state => state.barbershop);
  const setBarbershop = useBarbershopStore(state => state.setBarbershop);
  const { tick, refetch } = useSettingsAlertsStore();
  const [missingAddress, setMissingAddress] = useState(false);
  const [missingHours, setMissingHours] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!barbershop?.id) return;
    let active = true;

    async function loadAlerts() {
      try {
        const result = await getSettingsAlerts(barbershop!.id);
        if (!active) return;
        setMissingAddress(result.missing_address);
        setMissingHours(result.missing_hours);
        setError(null);

        if (barbershop!.owner_name !== result.owner_name) {
          setBarbershop({ ...barbershop!, owner_name: result.owner_name });
        }
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os alertas.",
        );
      }
    }

    void loadAlerts();
    return () => {
      active = false;
    };
  }, [barbershop, setBarbershop, tick]);

  return { missingAddress, missingHours, error, refetch };
}
