// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
//
// // ─── Tipos ────────────────────────────────────────────────────────────────────
//
// export type DayPeriod = {
//   starts_at: string; // "HH:MM"
//   ends_at: string; // "HH:MM"
// };
//
// export type DayAvailability = {
//   day_of_week: number; // 0=domingo ... 6=sábado
//   is_day_off: boolean;
//   use_custom_hours: boolean;
//   periods: DayPeriod[];
// };
//
// // ─── Defaults ─────────────────────────────────────────────────────────────────
//
// export function defaultAvailability(): DayAvailability[] {
//   return Array.from({ length: 7 }, (_, i) => ({
//     day_of_week: i,
//     is_day_off: false,
//     use_custom_hours: false,
//     periods: [{ starts_at: "08:00", ends_at: "18:00" }],
//   }));
// }
//
// // ─── Hook ─────────────────────────────────────────────────────────────────────
//
// export function useBarberAvailability(barberId: string | null) {
//   const [availability, setAvailability] =
//     useState<DayAvailability[]>(defaultAvailability);
//   const [loading, setLoading] = useState(false);
//
//   useEffect(() => {
//     if (!barberId) return;
//
//     async function load() {
//       setLoading(true);
//
//       const { data } = await supabase
//         .from("barber_availability")
//         .select(
//           "day_of_week, is_day_off, use_custom_hours, starts_at, ends_at, period_order",
//         )
//         .eq("barber_id", barberId)
//         .order("day_of_week")
//         .order("period_order");
//
//       if (data && data.length > 0) {
//         const byDay = new Map<number, typeof data>();
//         for (const row of data) {
//           if (!byDay.has(row.day_of_week)) byDay.set(row.day_of_week, []);
//           byDay.get(row.day_of_week)!.push(row);
//         }
//
//         setAvailability(
//           defaultAvailability().map(def => {
//             const rows = byDay.get(def.day_of_week);
//             if (!rows) return def;
//             const first = rows[0];
//             return {
//               day_of_week: def.day_of_week,
//               is_day_off: first.is_day_off,
//               use_custom_hours: first.use_custom_hours,
//               periods: first.use_custom_hours
//                 ? rows.map(r => ({
//                     starts_at: (r.starts_at ?? "08:00").slice(0, 5),
//                     ends_at: (r.ends_at ?? "18:00").slice(0, 5),
//                   }))
//                 : [{ starts_at: "08:00", ends_at: "18:00" }],
//             };
//           }),
//         );
//       }
//
//       setLoading(false);
//     }
//
//     void load();
//   }, [barberId]);
//
//   return { availability, setAvailability, loading };
// }
//
// // ─── Salvar ───────────────────────────────────────────────────────────────────
//
// export async function saveBarberAvailability(
//   barberId: string,
//   barbershopId: string,
//   availability: DayAvailability[],
// ): Promise<boolean> {
//   const { error: delError } = await supabase
//     .from("barber_availability")
//     .delete()
//     .eq("barber_id", barberId);
//
//   if (delError) return false;
//
//   type AvailabilityRow = {
//     barber_id: string;
//     barbershop_id: string;
//     day_of_week: number;
//     is_day_off: boolean;
//     use_custom_hours: boolean;
//     starts_at: string | null;
//     ends_at: string | null;
//     period_order: number;
//   };
//
//   const rows = availability.flatMap<AvailabilityRow>(day => {
//     if (!day.use_custom_hours) {
//       return [
//         {
//           barber_id: barberId,
//           barbershop_id: barbershopId,
//           day_of_week: day.day_of_week,
//           is_day_off: day.is_day_off,
//           use_custom_hours: false,
//           starts_at: null,
//           ends_at: null,
//           period_order: 0,
//         },
//       ];
//     }
//     return day.periods.map((p, idx) => ({
//       barber_id: barberId,
//       barbershop_id: barbershopId,
//       day_of_week: day.day_of_week,
//       is_day_off: day.is_day_off,
//       use_custom_hours: true,
//       starts_at: p.starts_at,
//       ends_at: p.ends_at,
//       period_order: idx,
//     }));
//   });
//
//   const { error } = await supabase.from("barber_availability").insert(rows);
//   return !error;
// }
