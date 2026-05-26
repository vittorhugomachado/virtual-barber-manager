// import { supabase } from "../supabase";
// 
// type UpdateServiceParams = {
//   id: string;
//   name: string;
//   description?: string;
//   price?: number;
//   duration_min?: number;
// };
// 
// export async function updateService({
//   id,
//   name,
//   description,
//   price,
//   duration_min,
// }: UpdateServiceParams): Promise<boolean> {
//   const { error } = await supabase
//     .from("services")
//     .update({
//       name,
//       description: description || null,
//       price: price ?? null,
//       duration_min: duration_min ?? null,
//       updated_at: new Date().toISOString(),
//     })
//     .eq("id", id);
// 
//   return !error;
// }
