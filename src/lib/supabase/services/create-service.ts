// import { supabase } from "../supabase";
//
// type CreateServiceParams = {
//   barbershopId: string;
//   name: string;
//   description?: string;
//   price?: number;
//   duration_min?: number;
// };
//
// export async function createService({
//   barbershopId,
//   name,
//   description,
//   price,
//   duration_min,
// }: CreateServiceParams): Promise<{ id: string } | null> {
//   const { data, error } = await supabase
//     .from("services")
//     .insert({
//       barbershop_id: barbershopId,
//       name,
//       description: description || null,
//       price: price ?? null,
//       duration_min: duration_min ?? null,
//       is_active: true,
//     })
//     .select("id")
//     .single();
//
//   if (error || !data) return null;
//   return data;
// }
