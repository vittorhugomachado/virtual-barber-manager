// import type { DayAvailability } from "@/hooks/use-barber-availability";
//
// export const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
//
// export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
//   const h = Math.floor(i / 2)
//     .toString()
//     .padStart(2, "0");
//   const m = i % 2 === 0 ? "00" : "30";
//   return `${h}:${m}`;
// });
//
// export function errorKey(
//   dayIndex: number,
//   periodIdx: number,
//   field: string,
// ): string {
//   return `${dayIndex}-${periodIdx}-${field}`;
// }
//
// export function validateAvailability(
//   availability: DayAvailability[],
// ): Record<string, string> {
//   const newErrors: Record<string, string> = {};
//
//   for (const day of availability) {
//     if (day.is_day_off || !day.use_custom_hours) continue;
//
//     for (let i = 0; i < day.periods.length; i++) {
//       const period = day.periods[i];
//
//       if (period.ends_at <= period.starts_at) {
//         newErrors[errorKey(day.day_of_week, i, "starts_at")] =
//           "Abertura deve ser menor que o fechamento.";
//         newErrors[errorKey(day.day_of_week, i, "ends_at")] =
//           "Fechamento deve ser maior que a abertura.";
//       }
//
//       if (i > 0) {
//         const prev = day.periods[i - 1];
//         if (period.starts_at <= prev.ends_at) {
//           newErrors[errorKey(day.day_of_week, i, "starts_at")] =
//             `Deve ser após o fechamento do período ${i}.`;
//           newErrors[errorKey(day.day_of_week, i, "ends_at")] =
//             `Conflito com o período ${i}.`;
//         }
//       }
//     }
//   }
//
//   return newErrors;
// }
