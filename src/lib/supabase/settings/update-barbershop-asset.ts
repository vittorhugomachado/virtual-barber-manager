import { supabase } from "@/lib/supabase/supabase";

export type BarbershopAssetType = "logo" | "banner";

type UpdateBarbershopAssetResult =
  | {
      status: "updated";
      asset_type: BarbershopAssetType;
      asset_url: string;
      previous_url: string | null;
      updated_at: string;
    }
  | { status: "invalid"; field: "asset_type" | "asset_url" | "storage_path" };

type UpdateBarbershopAssetParams = {
  barbershopId: string;
  type: BarbershopAssetType;
  url: string;
  storagePath: string;
};

export async function updateBarbershopAsset({
  barbershopId,
  type,
  url,
  storagePath,
}: UpdateBarbershopAssetParams): Promise<UpdateBarbershopAssetResult> {
  const { data, error } = await supabase.rpc("update_barbershop_asset", {
    p_barbershop_id: barbershopId,
    p_asset_type: type,
    p_asset_url: url,
    p_storage_path: storagePath,
  });

  if (error) throw error;
  return data as UpdateBarbershopAssetResult;
}
