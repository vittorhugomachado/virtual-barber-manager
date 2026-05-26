// import { supabase } from "../supabase";
// import { uploadImage } from "./upload-image";
// 
// type HandleUploadLogoParams = {
//   file: File;
//   barbershopId: string;
//   ownerId: string;
// };
// 
// type HandleUploadLogoResult = {
//   publicUrl: string | null;
//   error: Error | null;
// };
// 
// export async function handleUploadLogo({
//   file,
//   barbershopId,
//   ownerId,
// }: HandleUploadLogoParams): Promise<HandleUploadLogoResult> {
//   try {
//     const { url: publicUrl, error: uploadError } = await uploadImage({
//       file,
//       bucket: "barbershop-assets",
//       ownerId,
//       type: "logo",
//     });
// 
//     if (uploadError || !publicUrl) throw uploadError;
// 
//     const { error: updateError } = await supabase
//       .from("barbershops")
//       .update({
//         logo_url: publicUrl,
//         updated_at: new Date().toISOString(),
//       })
//       .eq("id", barbershopId);
// 
//     if (updateError) throw updateError;
// 
//     return { publicUrl, error: null };
//   } catch (error) {
//     console.error("Erro no upload da logo:", error);
//     return { publicUrl: null, error: error as Error };
//   }
// }
