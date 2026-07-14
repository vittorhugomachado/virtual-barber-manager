import { updateBarbershopAsset } from "@/lib/supabase/settings/update-barbershop-asset";
import type { BarbershopAssetType } from "@/lib/supabase/settings/update-barbershop-asset";
import { supabase } from "../supabase";
import { uploadImage } from "./upload-image";

const BUCKET = "barbershop-assets" as const;

type HandleUploadAssetParams = {
  file: File;
  barbershopId: string;
  ownerId: string;
  type: BarbershopAssetType;
};

export type HandleUploadAssetResult = {
  publicUrl: string | null;
  error: Error | null;
};

function getBucketPath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const path = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length),
    );
    return path && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}

export async function handleUploadAsset({
  file,
  barbershopId,
  ownerId,
  type,
}: HandleUploadAssetParams): Promise<HandleUploadAssetResult> {
  let newPath: string | null = null;

  try {
    const uploaded = await uploadImage({
      file,
      bucket: BUCKET,
      ownerId,
      barbershopId,
      type,
    });
    newPath = uploaded.path;

    const result = await updateBarbershopAsset({
      barbershopId,
      type,
      url: uploaded.url,
      storagePath: uploaded.path,
    });

    if (result.status !== "updated") {
      throw new Error("O banco recusou o caminho do novo arquivo.");
    }

    const previousPath = getBucketPath(result.previous_url);
    if (previousPath && previousPath !== uploaded.path) {
      // Limpeza posterior: uma falha aqui não invalida o asset já confirmado.
      await supabase.storage.from(BUCKET).remove([previousPath]);
    }

    return { publicUrl: result.asset_url, error: null };
  } catch (cause) {
    if (newPath) {
      // Compensação: não deixa arquivo órfão quando a RPC falha.
      await supabase.storage.from(BUCKET).remove([newPath]);
    }
    return {
      publicUrl: null,
      error: cause instanceof Error ? cause : new Error("Falha no upload."),
    };
  }
}
