// import { supabase } from "../supabase";
// import { uploadImage } from "./upload-image";
// 
// type HandleUploadBannerParams = {
//   file: File;
//   barbershopId: string;
//   ownerId: string;
// };
// 
// type HandleUploadBannerResult = {
//   publicUrl: string | null;
//   error: Error | null;
// };
// 
// export async function handleUploadBanner({
//   file,
//   barbershopId,
//   ownerId,
// }: HandleUploadBannerParams): Promise<HandleUploadBannerResult> {
//   try {
//     const { url: publicUrl, error: uploadError } = await uploadImage({
//       file,
//       bucket: "barbershop-assets",
//       ownerId,
//       type: "banner",
//     });
// 
//     if (uploadError || !publicUrl) throw uploadError;
// 
//     const { error: updateError } = await supabase
//       .from("barbershops")
//       .update({
//         banner_url: publicUrl,
//         updated_at: new Date().toISOString(),
//       })
//       .eq("id", barbershopId);
// 
//     if (updateError) throw updateError;
// 
//     return { publicUrl, error: null };
//   } catch (error) {
//     console.error("Erro no upload do banner:", error);
//     return { publicUrl: null, error: error as Error };
//   }
// }
