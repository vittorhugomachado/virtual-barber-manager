// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import type { Customer } from "@/types/customer";
//
// export function useCustomersAuthWithAppointments() {
//   const { barbershop } = useBarbershopStore();
//   const barbershopId = barbershop?.id;
//   const [customersAuth, setCustomersAuth] = useState<Customer[]>([]);
//   const [loading, setLoading] = useState(true);
//
//   useEffect(() => {
//     if (!barbershopId) return;
//
//     let active = true;
//
//     async function loadCustomersAuthWithAppointments() {
//       setLoading(true);
//
//       const { data: appointmentRows } = await supabase
//         .from("appointments")
//         .select("customer_id, starts_at, created_at")
//         .eq("barbershop_id", barbershopId)
//         .not("customer_id", "is", null);
//
//       const statsMap = new Map<
//         string,
//         { total: number; last: string | null; first_seen_at: string }
//       >();
//
//       for (const appointment of appointmentRows ?? []) {
//         const current = statsMap.get(appointment.customer_id);
//
//         if (!current) {
//           statsMap.set(appointment.customer_id, {
//             total: 1,
//             last: appointment.starts_at,
//             first_seen_at: appointment.created_at,
//           });
//           continue;
//         }
//
//         current.total += 1;
//         if (appointment.starts_at > (current.last ?? "")) {
//           current.last = appointment.starts_at;
//         }
//         if (appointment.created_at < current.first_seen_at) {
//           current.first_seen_at = appointment.created_at;
//         }
//       }
//
//       const authIds = Array.from(statsMap.keys());
//
//       if (authIds.length === 0) {
//         if (!active) return;
//         setCustomersAuth([]);
//         setLoading(false);
//         return;
//       }
//
//       const { data: authRows } = await supabase
//         .from("customers")
//         .select("id, name, phone, created_at, updated_at")
//         .eq("auth", true)
//         .in("id", authIds);
//
//       if (!active) return;
//
//       setCustomersAuth(
//         (authRows ?? []).map(row => ({
//           id: row.id,
//           barbershop_id: barbershopId,
//           name: row.name?.trim() || "Cliente sem nome",
//           phone: row.phone ?? null,
//           created_at: statsMap.get(row.id)?.first_seen_at ?? row.created_at,
//           updated_at: row.updated_at ?? null,
//           total_appointments: statsMap.get(row.id)?.total ?? 0,
//           last_appointment: statsMap.get(row.id)?.last ?? null,
//           source: "customers_auth" as const,
//         })),
//       );
//       setLoading(false);
//     }
//
//     void loadCustomersAuthWithAppointments();
//
//     return () => {
//       active = false;
//     };
//   }, [barbershopId]);
//
//   return { customersAuth, setCustomersAuth, loading };
// }
