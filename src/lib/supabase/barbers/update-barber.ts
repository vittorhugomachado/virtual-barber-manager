// import { supabase } from "../supabase";
//
// type UpdateBarberParams = {
//   id: string;
//   name: string;
//   serviceIds: string[];
// };
//
// export async function updateBarber({
//   id,
//   name,
//   serviceIds,
// }: UpdateBarberParams): Promise<boolean> {
//   const { error } = await supabase
//     .from("barbers")
//     .update({ name, updated_at: new Date().toISOString() })
//     .eq("id", id);
//
//   if (error) return false;
//
//   await supabase.from("barber_services").delete().eq("barber_id", id);
//
//   if (serviceIds.length > 0) {
//     await supabase
//       .from("barber_services")
//       .insert(serviceIds.map(service_id => ({ barber_id: id, service_id })));
//   }
//
//   return true;
// }
