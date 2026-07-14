import { supabase } from "@/lib/supabase/supabase";
import type { Barbershop } from "@/types/barbershop";

type SettingsField =
  | "name"
  | "phone"
  | "slug"
  | "description"
  | "owner_name"
  | "unknown";

export type UpdateBarbershopSettingsResult =
  | { status: "updated"; barbershop: Barbershop }
  | { status: "invalid" | "conflict" | "not_allowed"; field: SettingsField };

type UpdateBarbershopSettingsParams = {
  barbershopId: string;
  name: string;
  phone: string;
  slug: string;
  description?: string;
  ownerName: string;
};

export async function updateBarbershopSettings({
  barbershopId,
  name,
  phone,
  slug,
  description,
  ownerName,
}: UpdateBarbershopSettingsParams): Promise<UpdateBarbershopSettingsResult> {
  const { data, error } = await supabase.rpc("update_barbershop_settings", {
    p_barbershop_id: barbershopId,
    p_name: name,
    p_phone: phone,
    p_slug: slug,
    p_description: description ?? null,
    p_owner_name: ownerName,
  });

  if (error) throw error;
  return data as UpdateBarbershopSettingsResult;
}
