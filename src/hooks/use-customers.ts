// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import type { Customer } from "@/types/customer";
// 
// export function useCustomers() {
//   const { barbershop } = useBarbershopStore();
//   const [customers, setCustomers] = useState<Customer[]>([]);
//   const [loading, setLoading] = useState(true);
// 
//   useEffect(() => {
//     if (!barbershop?.id) return;
// 
//     supabase
//       .from("customers")
//       .select("*")
//       .eq("barbershop_id", barbershop.id)
//       .order("created_at", { ascending: false })
//       .then(async ({ data: customersData }) => {
//         if (!customersData) {
//           setLoading(false);
//           return;
//         }
// 
//         const customerIds = customersData.map(customer => customer.id);
//         const statsMap = new Map<
//           string,
//           { total: number; last: string | null }
//         >();
// 
//         if (customerIds.length > 0) {
//           const { data: appointmentsData } = await supabase
//             .from("appointments")
//             .select("customer_id, starts_at")
//             .eq("barbershop_id", barbershop.id)
//             .in("customer_id", customerIds)
//             .not(
//               "status",
//               "in",
//               "(cancelled_by_customer,cancelled_by_barbershop)",
//             );
// 
//           for (const appointment of appointmentsData ?? []) {
//             const current = statsMap.get(appointment.customer_id);
// 
//             if (!current) {
//               statsMap.set(appointment.customer_id, {
//                 total: 1,
//                 last: appointment.starts_at,
//               });
//               continue;
//             }
// 
//             current.total += 1;
//             if (appointment.starts_at > (current.last ?? "")) {
//               current.last = appointment.starts_at;
//             }
//           }
//         }
// 
//         setCustomers(
//           customersData.map(customer => {
//             const stats = statsMap.get(customer.id);
// 
//             return {
//               ...customer,
//               total_appointments: stats?.total ?? 0,
//               last_appointment: stats?.last ?? null,
//               source: "customers" as const,
//             };
//           }),
//         );
//         setLoading(false);
//       });
//   }, [barbershop?.id]);
// 
//   return { customers, setCustomers, loading };
// }
