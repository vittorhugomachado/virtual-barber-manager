// lib/supabase/storage/upload-image.ts
import { supabase } from "../supabase";

type UploadImageParams = {
  file: File;
  bucket: string;
  ownerId: string;
  type: "banner" | "logo";
};

export async function uploadImage({
  file,
  bucket,
  ownerId,
  type,
}: UploadImageParams): Promise<{ url: string | null; error: Error | null }> {
  try {
    const fileExt = file.name.split(".").pop();
    const newFileName = `${ownerId}/${type}.${fileExt}`;

    // PASSO 1: LISTAR OS ARQUIVOS DO BUCKET QUE TEM "logo" OU "banner"
    const { data: existingFiles, error: listError } = await supabase.storage
      .from(bucket)
      .list(ownerId, {
        search: `${type}.`,
      });

    if (listError) {
      console.warn("Erro ao listar arquivos existentes:", listError);
    }

    // PASSO 2: SE OS ARQUIVO BUSCADOS ANTES EXISTIREM EXECUTA O MÉTODO PARA EXCLUIR
    if (existingFiles && existingFiles.length > 0) {
      const filesToRemove = existingFiles.map(
        file => `${ownerId}/${file.name}`,
      );

      if (filesToRemove.length > 0) {
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove(filesToRemove);

        if (removeError) {
          console.warn("Erro ao remover arquivos antigos:", removeError);
        }
      }
    }

    // PASSO 3: FAZ O UPLOAD NA BUCKET DO SUPSBASE
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(newFileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // PASSO 4: PEGAR A URL DA IMAGEM
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path);

    // ATRIBUIR A URL A UMA VARIAVEL COM A DATA ATUAL, FORCANDO O CACHE A LIMPAR
    const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

    return { url: urlWithCacheBuster, error: null };
  } catch (error) {
    console.error("Erro no upload:", error);
    return { url: null, error: error as Error };
  }
}
