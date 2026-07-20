import { useEffect, useState } from "react";
import { getSettingsAlerts } from "@/lib/supabase/settings/get-settings-alerts";
import { useBarbershopStore } from "@/store/barbershop.store";
import { useSettingsAlertsStore } from "@/store/settings-alerts.store";
import type { SettingsAlerts } from "@/lib/supabase/settings/get-settings-alerts";
import {
  deleteSettingsCache,
  getSettingsCache,
  loadSettingsCache,
  setSettingsCache,
  settingsCacheKey,
} from "@/lib/settings-cache";

export function useSettingsAlerts(enabled = true) {
  const barbershop = useBarbershopStore(state => state.barbershop);
  const setBarbershop = useBarbershopStore(state => state.setBarbershop);
  const { tick, refetch: triggerRefetch } = useSettingsAlertsStore();
  const initialAlerts = barbershop?.id
    ? getSettingsCache<SettingsAlerts>(
        settingsCacheKey(barbershop.id, "alerts"),
      )
    : undefined;
  const [missingAddress, setMissingAddress] = useState(
    initialAlerts?.missing_address ?? false,
  );
  const [missingHours, setMissingHours] = useState(
    initialAlerts?.missing_hours ?? false,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !barbershop?.id) return;
    let active = true;

    async function loadAlerts() {
      try {
        const cacheKey = settingsCacheKey(barbershop!.id, "alerts");
        const result = await loadSettingsCache(cacheKey, () =>
          getSettingsAlerts(barbershop!.id),
        );
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
  }, [barbershop, enabled, setBarbershop, tick]);

  function updateCachedAlerts(changes: Partial<SettingsAlerts>) {
    if (!barbershop?.id) return;

    const cacheKey = settingsCacheKey(barbershop.id, "alerts");
    const cached = getSettingsCache<SettingsAlerts>(cacheKey);
    setSettingsCache(cacheKey, {
      missing_address: missingAddress,
      missing_hours: missingHours,
      owner_name: barbershop.owner_name ?? "",
      ...cached,
      ...changes,
    });
  }

  function markAddressComplete() {
    setMissingAddress(false);
    updateCachedAlerts({ missing_address: false });
  }

  function markHoursComplete() {
    setMissingHours(false);
    updateCachedAlerts({ missing_hours: false });
  }

  function refetch() {
    if (barbershop?.id) {
      deleteSettingsCache(settingsCacheKey(barbershop.id, "alerts"));
    }
    triggerRefetch();
  }

  return {
    missingAddress,
    missingHours,
    error,
    refetch,
    markAddressComplete,
    markHoursComplete,
  };
}
