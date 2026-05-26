// import { supabase } from "../supabase";
//
// type CreateBarberParams = {
//   barbershopId: string;
//   name: string;
//   serviceIds: string[];
// };
//
// export async function createBarber({
//   barbershopId,
//   name,
//   serviceIds,
// }: CreateBarberParams): Promise<{ id: string } | null> {
//   const { data, error } = await supabase
//     .from("barbers")
//     .insert({ barbershop_id: barbershopId, name, is_active: false })
//     .select("id")
//     .single();
//
//   if (error || !data) return null;
//
//   if (serviceIds.length > 0) {
//     await supabase
//       .from("barber_services")
//       .insert(
//         serviceIds.map(service_id => ({ barber_id: data.id, service_id })),
//       );
//   }
//
//   return data;
// }
