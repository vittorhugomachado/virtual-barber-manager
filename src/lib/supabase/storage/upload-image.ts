import { supabase } from "../supabase";
import type { BarbershopAssetType } from "@/lib/supabase/settings/update-barbershop-asset";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type UploadImageParams = {
  file: File;
  bucket: "barbershop-assets";
  ownerId: string;
  barbershopId: string;
  type: BarbershopAssetType;
};

export type UploadedImage = {
  url: string;
  path: string;
};

export function validateImageFile(file: File): string | null {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return "Imagem deve ter no máximo 5MB";
  }
  if (!IMAGE_EXTENSIONS[file.type]) {
    return "Use uma imagem JPG, PNG ou WebP";
  }
  return null;
}

export async function uploadImage({
  file,
  bucket,
  ownerId,
  barbershopId,
  type,
}: UploadImageParams): Promise<UploadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const extension = IMAGE_EXTENSIONS[file.type];
  const uniqueId = crypto.randomUUID();
  const path = `${ownerId}/${type}/${barbershopId}-${uniqueId}.${extension}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return { url: publicUrlData.publicUrl, path: data.path };
}
