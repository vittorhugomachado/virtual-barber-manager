import { supabase } from "@/lib/supabase/supabase";

export type SettingsAlerts = {
  missing_address: boolean;
  missing_hours: boolean;
  owner_name: string;
};

export async function getSettingsAlerts(
  barbershopId: string,
): Promise<SettingsAlerts> {
  const { data, error } = await supabase.rpc("get_settings_alerts", {
    p_barbershop_id: barbershopId,
  });

  if (error) throw error;
  return data as SettingsAlerts;
}
