// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
//
// export interface ReportsKpis {
//   total: number;
//   completed: number;
//   cancelled: number;
//   noShow: number;
//   completionRate: number;
//   revenue: number;
//   avgTicket: number;
//   newCustomers: number;
//   workedHours: number;
//   uniqueCustomers: number;
// }
//
// export interface HourlyReportData {
//   hour: string;
//   concluido: number;
//   agendado: number;
//   cancelado: number;
// }
//
// export interface BarberReportData {
//   name: string;
//   total: number;
//   completed: number;
// }
//
// export interface ServiceReportData {
//   name: string;
//   total: number;
// }
//
// export interface WeekdayReportData {
//   day: string;
//   total: number;
// }
//
// export interface ReportsData {
//   kpis: ReportsKpis;
//   hourlyData: HourlyReportData[];
//   barbersData: BarberReportData[];
//   servicesData: ServiceReportData[];
//   weekdayData: WeekdayReportData[];
//   loading: boolean;
// }
//
// const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
//
// const EMPTY_KPIS: ReportsKpis = {
//   total: 0,
//   completed: 0,
//   cancelled: 0,
//   noShow: 0,
//   completionRate: 0,
//   revenue: 0,
//   avgTicket: 0,
//   newCustomers: 0,
//   workedHours: 0,
//   uniqueCustomers: 0,
// };
//
// export function useReports(
//   from: string,
//   to: string,
//   barberId?: string | null,
// ): ReportsData {
//   const { barbershop } = useBarbershopStore();
//   const [loading, setLoading] = useState(true);
//   const [kpis, setKpis] = useState<ReportsKpis>(EMPTY_KPIS);
//   const [hourlyData, setHourlyData] = useState<HourlyReportData[]>([]);
//   const [barbersData, setBarbersData] = useState<BarberReportData[]>([]);
//   const [servicesData, setServicesData] = useState<ServiceReportData[]>([]);
//   const [weekdayData, setWeekdayData] = useState<WeekdayReportData[]>([]);
//
//   useEffect(() => {
//     if (!barbershop?.id || !from || !to) return;
//
//     const barbershopId = barbershop.id;
//     let cancelled = false;
//
//     const rangeStart = `${from}T00:00:00Z`;
//     const rangeEnd = `${to}T23:59:59Z`;
//
//     async function loadReports() {
//       await Promise.resolve();
//
//       if (cancelled) return;
//       setLoading(true);
//
//       let aptsQuery = supabase
//         .from("appointments")
//         .select(
//           `starts_at, status, customer_id, barber_name, service_name, service_price, service_duration`,
//         )
//         .eq("barbershop_id", barbershopId)
//         .gte("starts_at", rangeStart)
//         .lte("starts_at", rangeEnd);
//
//       if (barberId) {
//         aptsQuery = aptsQuery.eq("barber_id", barberId);
//       }
//
//       const [aptsRes, customersRes] = await Promise.all([
//         aptsQuery,
//
//         supabase
//           .from("customers")
//           .select("id", { count: "exact", head: true })
//           .eq("barbershop_id", barbershopId)
//           .gte("created_at", rangeStart)
//           .lte("created_at", rangeEnd),
//       ]);
//
//       if (cancelled) return;
//
//       if (aptsRes.error || customersRes.error) {
//         console.error("useReports error:", aptsRes.error ?? customersRes.error);
//         setKpis(EMPTY_KPIS);
//         setHourlyData([]);
//         setBarbersData([]);
//         setServicesData([]);
//         setWeekdayData([]);
//         setLoading(false);
//         return;
//       }
//
//       type Apt = {
//         starts_at: string;
//         status: string;
//         customer_id: string;
//         barber_name: string | null;
//         service_name: string | null;
//         service_price: number | string | null;
//         service_duration: number | string | null;
//       };
//
//       const apts = (aptsRes.data ?? []) as unknown as Apt[];
//       const completedApts = apts.filter(a => a.status === "completed");
//
//       const total = apts.length;
//       const completed = completedApts.length;
//       const cancelledCount = apts.filter(
//         a =>
//           a.status === "cancelled_by_customer" ||
//           a.status === "cancelled_by_barbershop",
//       ).length;
//       const noShow = apts.filter(a => a.status === "no_show").length;
//       const completionRate =
//         total > 0 ? Math.round((completed / total) * 100) : 0;
//       const revenue = completedApts.reduce(
//         (sum, a) => sum + Number(a.service_price ?? 0),
//         0,
//       );
//       const avgTicket = completed > 0 ? revenue / completed : 0;
//       const workedHours = completedApts.reduce(
//         (sum, a) => sum + Number(a.service_duration ?? 0),
//         0,
//       );
//       const uniqueCustomers = new Set(apts.map(a => a.customer_id)).size;
//
//       // Hourly aggregate (hour of day across the period)
//       const hourBuckets = Array.from({ length: 24 }, () => ({
//         concluido: 0,
//         agendado: 0,
//         cancelado: 0,
//       }));
//       for (const apt of apts) {
//         const h = new Date(apt.starts_at).getUTCHours();
//         if (apt.status === "completed") hourBuckets[h].concluido++;
//         else if (
//           apt.status === "cancelled_by_customer" ||
//           apt.status === "cancelled_by_barbershop"
//         )
//           hourBuckets[h].cancelado++;
//         else hourBuckets[h].agendado++;
//       }
//       const hourly: HourlyReportData[] = hourBuckets.map((b, h) => ({
//         hour: `${String(h).padStart(2, "0")}:00`,
//         ...b,
//       }));
//
//       // Barbers (all appointments)
//       const barberMap = new Map<
//         string,
//         { name: string; total: number; completed: number }
//       >();
//       for (const apt of apts) {
//         if (!apt.barber_name) continue;
//         const e = barberMap.get(apt.barber_name);
//         if (e) {
//           e.total++;
//           if (apt.status === "completed") e.completed++;
//         } else {
//           barberMap.set(apt.barber_name, {
//             name: apt.barber_name,
//             total: 1,
//             completed: apt.status === "completed" ? 1 : 0,
//           });
//         }
//       }
//       const barbers = Array.from(barberMap.values()).sort(
//         (a, b) => b.total - a.total,
//       );
//
//       // Services (completed only)
//       const serviceMap = new Map<string, { name: string; total: number }>();
//       for (const apt of completedApts) {
//         if (!apt.service_name) continue;
//         const e = serviceMap.get(apt.service_name);
//         if (e) e.total++;
//         else
//           serviceMap.set(apt.service_name, {
//             name: apt.service_name,
//             total: 1,
//           });
//       }
//       const services = Array.from(serviceMap.values())
//         .sort((a, b) => b.total - a.total)
//         .slice(0, 8);
//
//       // Weekday (non-cancelled)
//       const weekCounts = new Array(7).fill(0);
//       for (const apt of apts) {
//         if (
//           apt.status === "cancelled_by_customer" ||
//           apt.status === "cancelled_by_barbershop"
//         )
//           continue;
//         weekCounts[new Date(apt.starts_at).getUTCDay()]++;
//       }
//       const weekday: WeekdayReportData[] = weekCounts.map((total, i) => ({
//         day: WEEKDAYS[i],
//         total,
//       }));
//
//       setKpis({
//         total,
//         completed,
//         cancelled: cancelledCount,
//         noShow,
//         completionRate,
//         revenue,
//         avgTicket,
//         newCustomers: customersRes.count ?? 0,
//         workedHours,
//         uniqueCustomers,
//       });
//       setHourlyData(hourly);
//       setBarbersData(barbers);
//       setServicesData(services);
//       setWeekdayData(weekday);
//       setLoading(false);
//     }
//
//     void loadReports();
//
//     return () => {
//       cancelled = true;
//     };
//   }, [barbershop?.id, from, to, barberId]);
//
//   return {
//     kpis,
//     hourlyData,
//     barbersData,
//     servicesData,
//     weekdayData,
//     loading,
//   };
// }
