// import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { useAppointments } from "@/hooks/use-appointments";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   BadgeCheck,
//   CalendarDays,
//   ChevronDown,
//   ChevronRight,
//   Clock,
//   Plus,
//   Scissors,
//   User,
// } from "lucide-react";
// import {
//   APPOINTMENT_STATUS_COLORS,
//   APPOINTMENT_STATUS_LABELS,
// } from "@/types/create-appointment";
// import type { AppointmentWithRelations } from "@/types/create-appointment";
// import { Skeleton } from "@/components/ui/skeleton";
// import { supabase } from "@/lib/supabase/supabase";
// import { CreateAppointmentModal } from "../modals/appointments/create-appointmend-modal/create-appointment-modal";
// import { DeleteAppointmentModal } from "../modals/appointments/delete-appointment-appointment";
// 
// type FilterType = "today" | "week" | "month" | "year" | "custom";
// 
// // ─── StatusPicker ─────────────────────────────────────────────────────────────
// type AppointmentStatus = AppointmentWithRelations["status"];
// 
// const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
//   { value: "scheduled", label: "Agendado" },
//   { value: "completed", label: "Concluído" },
//   { value: "no_show", label: "Não compareceu" },
//   { value: "cancelled_by_barbershop", label: "Cancelado" },
// ];
// 
// function StatusPicker({
//   apt,
//   onStatusChange,
// }: {
//   apt: AppointmentWithRelations;
//   onStatusChange: (id: string, status: AppointmentStatus) => void;
// }) {
//   const [open, setOpen] = useState(false);
//   const [updating, setUpdating] = useState(false);
//   const ref = useRef<HTMLDivElement>(null);
// 
//   useEffect(() => {
//     if (!open) return;
//     function handleClick(e: MouseEvent) {
//       if (ref.current && !ref.current.contains(e.target as Node)) {
//         setOpen(false);
//       }
//     }
//     document.addEventListener("mousedown", handleClick);
//     return () => document.removeEventListener("mousedown", handleClick);
//   }, [open]);
// 
//   const nowBRT = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
//   const startsAt = new Date(apt.starts_at);
//   const isPast = nowBRT.getTime() - startsAt.getTime() > 40 * 60 * 1000;
//   const options =
//     apt.status === "cancelled_by_customer"
//       ? []
//       : STATUS_OPTIONS.filter(o => {
//           if (o.value === apt.status) return false;
//           if (isPast && o.value === "scheduled") return false;
//           return true;
//         });
// 
//   async function changeStatus(newStatus: AppointmentStatus) {
//     setUpdating(true);
//     setOpen(false);
//     const { error } = await supabase
//       .from("appointments")
//       .update({ status: newStatus })
//       .eq("id", apt.id);
//     if (!error) onStatusChange(apt.id, newStatus);
//     setUpdating(false);
//   }
// 
//   return (
//     <div ref={ref} className="relative">
//       <button
//         onClick={() => options.length > 0 && setOpen(o => !o)}
//         disabled={updating}
//         className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-opacity ${APPOINTMENT_STATUS_COLORS[apt.status]} ${
//           options.length > 0
//             ? "cursor-pointer hover:opacity-80"
//             : "cursor-default"
//         }`}
//       >
//         {updating ? "..." : APPOINTMENT_STATUS_LABELS[apt.status]}
//         {options.length > 0 && <ChevronDown className="h-3 w-3 shrink-0" />}
//       </button>
// 
//       {open && (
//         <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg py-1 min-w-36 overflow-hidden">
//           {options.map(opt => (
//             <button
//               key={opt.value}
//               onClick={() => changeStatus(opt.value)}
//               className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
//             >
//               {opt.label}
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }
// 
// function getDaysForFilter(
//   filter: FilterType,
//   customRange?: { from?: Date; to?: Date },
// ): Date[] {
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
// 
//   if (filter === "today") {
//     return [new Date(today)];
//   }
// 
//   if (filter === "week") {
//     return Array.from({ length: 7 }, (_, i) => {
//       const d = new Date(today);
//       d.setDate(d.getDate() + i);
//       return d;
//     });
//   }
// 
//   if (filter === "month") {
//     const year = today.getFullYear();
//     const month = today.getMonth();
//     const daysInMonth = new Date(year, month + 1, 0).getDate();
//     return Array.from({ length: daysInMonth }, (_, i) => {
//       const d = new Date(year, month, i + 1);
//       return d;
//     });
//   }
// 
//   if (filter === "year") {
//     const year = today.getFullYear();
//     const days: Date[] = [];
//     for (let m = 0; m < 12; m++) {
//       const daysInMonth = new Date(year, m + 1, 0).getDate();
//       for (let d = 1; d <= daysInMonth; d++) {
//         days.push(new Date(year, m, d));
//       }
//     }
//     return days;
//   }
// 
//   if (filter === "custom" && customRange?.from) {
//     const days: Date[] = [];
//     const start = new Date(customRange.from);
//     start.setHours(0, 0, 0, 0);
//     const end = customRange.to ? new Date(customRange.to) : new Date(start);
//     end.setHours(0, 0, 0, 0);
//     const current = new Date(start);
//     while (current <= end) {
//       days.push(new Date(current));
//       current.setDate(current.getDate() + 1);
//     }
//     return days;
//   }
// 
//   return [];
// }
// 
// const FILTER_LABELS: Record<FilterType, string> = {
//   today: "Hoje",
//   week: "Esta semana",
//   month: "Este mês",
//   year: "Este ano",
//   custom: "Data específica",
// };
// 
// function getRangeForFilter(
//   filter: FilterType,
//   customRange?: { from?: Date; to?: Date },
// ): { start: Date; end: Date } {
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
// 
//   if (filter === "today") {
//     const end = new Date(today);
//     end.setHours(23, 59, 59);
//     return { start: today, end };
//   }
// 
//   if (filter === "week") {
//     const end = new Date(today);
//     end.setDate(end.getDate() + 7);
//     end.setHours(23, 59, 59);
//     return { start: today, end };
//   }
// 
//   if (filter === "month") {
//     const start = new Date(today.getFullYear(), today.getMonth(), 1);
//     const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
//     end.setHours(23, 59, 59);
//     return { start, end };
//   }
// 
//   if (filter === "year") {
//     const start = new Date(today.getFullYear(), 0, 1);
//     const end = new Date(today.getFullYear(), 11, 31);
//     end.setHours(23, 59, 59);
//     return { start, end };
//   }
// 
//   if (filter === "custom" && customRange?.from) {
//     const start = new Date(customRange.from);
//     start.setHours(0, 0, 0, 0);
//     const end = customRange.to ? new Date(customRange.to) : new Date(start);
//     end.setHours(23, 59, 59);
//     return { start, end };
//   }
// 
//   const end = new Date(today);
//   end.setDate(end.getDate() + 7);
//   return { start: today, end };
// }
// 
// function formatDayLabel(date: Date): string {
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
//   const tomorrow = new Date(today);
//   tomorrow.setDate(tomorrow.getDate() + 1);
// 
//   if (date.getTime() === today.getTime()) return "Hoje";
//   if (date.getTime() === tomorrow.getTime()) return "Amanhã";
// 
//   return date.toLocaleDateString("pt-BR", {
//     weekday: "long",
//     day: "2-digit",
//     month: "2-digit",
//     year: "numeric",
//   });
// }
// 
// function formatTime(isoString: string): string {
//   return new Date(isoString).toLocaleTimeString("pt-BR", {
//     hour: "2-digit",
//     minute: "2-digit",
//     timeZone: "UTC",
//   });
// }
// 
// function getPhoneDigits(phone?: string | null) {
//   return (phone ?? "").replace(/\D/g, "").slice(0, 11);
// }
// 
// function WhatsappIcon(props: React.SVGProps<SVGSVGElement>) {
//   return (
//     <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
//       <path d="M19.05 4.94A9.77 9.77 0 0 0 12.09 2C6.68 2 2.27 6.4 2.27 11.82c0 1.73.45 3.41 1.3 4.9L2 22l5.42-1.5a9.8 9.8 0 0 0 4.67 1.19h.01c5.41 0 9.82-4.4 9.82-9.82a9.75 9.75 0 0 0-2.87-6.93m-6.96 15.09h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.22.89.86-3.14-.2-.32a8.13 8.13 0 0 1-1.25-4.32c0-4.48 3.65-8.13 8.14-8.13a8.1 8.1 0 0 1 5.78 2.39 8.08 8.08 0 0 1 2.37 5.75c0 4.49-3.65 8.14-8.14 8.14m4.46-6.09c-.24-.12-1.4-.69-1.62-.77s-.37-.12-.53.12-.61.77-.74.93-.27.18-.5.06a6.63 6.63 0 0 1-1.95-1.2 7.22 7.22 0 0 1-1.34-1.67c-.14-.24-.02-.36.1-.48.1-.1.24-.27.35-.4.12-.14.16-.24.24-.4s.04-.3-.02-.42-.53-1.28-.72-1.75c-.19-.46-.39-.4-.53-.41h-.45c-.16 0-.42.06-.64.3s-.83.8-.83 1.94.85 2.24.97 2.39c.12.16 1.67 2.56 4.05 3.59.57.24 1.01.39 1.36.49.57.18 1.08.15 1.49.09.45-.07 1.4-.57 1.6-1.12.2-.55.2-1.03.14-1.12-.06-.1-.22-.16-.45-.28" />
//     </svg>
//   );
// }
// 
// function isSameDay(date: Date, isoString: string): boolean {
//   const d = new Date(isoString);
//   return (
//     d.getUTCFullYear() === date.getFullYear() &&
//     d.getUTCMonth() === date.getMonth() &&
//     d.getUTCDate() === date.getDate()
//   );
// }
// 
// // ─── DaySection ───────────────────────────────────────────────────────────────
// const DaySection = memo(function DaySection({
//   date,
//   appointments,
//   onStatusChange,
// }: {
//   date: Date;
//   appointments: AppointmentWithRelations[];
//   onCancel: (apt: AppointmentWithRelations) => void;
//   onStatusChange: (id: string, status: AppointmentStatus) => void;
// }) {
//   const [open, setOpen] = useState(false);
//   const label = formatDayLabel(date);
//   const isToday = label === "Hoje";
// 
//   return (
//     <div className="rounded-lg border">
//       <button
//         onClick={() => setOpen(o => !o)}
//         className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
//       >
//         <div className="flex items-center gap-3">
//           {open ? (
//             <ChevronDown className="h-4 w-4 text-muted-foreground" />
//           ) : (
//             <ChevronRight className="h-4 w-4 text-muted-foreground" />
//           )}
//           <span
//             className={`text-sm font-semibold text-start capitalize ${isToday ? "text-primary" : ""}`}
//           >
//             {label}
//           </span>
//         </div>
// 
//         <div className="flex items-center gap-2">
//           {appointments.length > 0 && (
//             <Badge variant="secondary" className="text-xs">
//               {appointments.length}{" "}
//               <span className="hidden">
//                 agendamento
//                 {appointments.length !== 1 ? "s" : ""}
//               </span>
//             </Badge>
//           )}
//         </div>
//       </button>
// 
//       {open && (
//         <div className="border-t">
//           {appointments.length === 0 ? (
//             <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
//               <CalendarDays className="h-4 w-4 opacity-40" />
//               <span className="text-sm opacity-50">
//                 Nenhum agendamento para este dia.
//               </span>
//             </div>
//           ) : (
//             <div className="divide-y">
//               {appointments.map(apt => {
//                 const cancelled =
//                   apt.status === "cancelled_by_customer" ||
//                   apt.status === "cancelled_by_barbershop";
//                 const dim = cancelled ? "opacity-30" : "";
//                 const customerPhone = getPhoneDigits(apt.customer?.phone);
//                 const hasWhatsapp = customerPhone.length >= 10;
//                 return (
//                   <div
//                     key={apt.id}
//                     className="flex flex-col lg:flex-row items-center gap-2 xl:gap-4 px-4 py-2.5"
//                   >
//                     {/* Informações */}
//                     <div
//                       className={`flex-1 w-full min-w-0 flex flex-col lg:flex-row gap-1 xl:gap-18 ${dim}`}
//                     >
//                       {/* linha 1: horário + cliente */}
//                       <div className="flex flex-wrap items-center justify-center gap-3 min-w-0">
//                         <div className="flex items-center gap-1 text-sm shrink-0">
//                           <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
//                           <span className="font-medium">
//                             {formatTime(apt.starts_at)}
//                           </span>
//                           <span className="text-muted-foreground">–</span>
//                           <span className="text-muted-foreground">
//                             {formatTime(apt.ends_at)}
//                           </span>
//                         </div>
//                         <div className="lg:w-40 lg:ml-3 flex items-center gap-1.5 text-sm min-w-0 overflow-hidden">
//                           <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
//                           <span className="truncate font-medium">
//                             {apt.customer_name}
//                           </span>
//                           {apt.customer?.source === "customers_auth" && (
//                             <span title="Cliente com celular verificado">
//                               <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
//                             </span>
//                           )}
//                           {hasWhatsapp && (
//                             <a
//                               href={`https://wa.me/55${customerPhone}`}
//                               target="_blank"
//                               rel="noopener noreferrer"
//                               title="Abrir conversa no WhatsApp"
//                               className="inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-emerald-600 transition-colors hover:bg-emerald-500/20"
//                             >
//                               <WhatsappIcon className="h-7 w-7" />
//                             </a>
//                           )}
//                         </div>
//                       </div>
//                       {/* linha 2: barbeiro · serviço · preço */}
//                       <div className="flex justify-center xl:justify-start items-center gap-1.5 text-sm min-w-0 overflow-hidden pl-0.5">
//                         <Scissors className="h-3.5 w-3.5 hidden md:block text-muted-foreground shrink-0" />
//                         <span className="flex flex-wrap justify-center items-center gap-1 text-muted-foreground min-w-0 overflow-hidden">
//                           <span className="truncate">{apt.barber_name}</span>
//                           <span className="shrink-0">·</span>
//                           <span className="truncate">{apt.service_name}</span>
//                           {apt.service_price != null && (
//                             <>
//                               <span className="shrink-0">·</span>
//                               <span className="shrink-0 font-medium text-foreground">
//                                 {apt.service_price.toLocaleString("pt-BR", {
//                                   style: "currency",
//                                   currency: "BRL",
//                                 })}
//                               </span>
//                             </>
//                           )}
//                         </span>
//                       </div>
//                     </div>
//                     <div className="xl:mr-4">
//                       <StatusPicker apt={apt} onStatusChange={onStatusChange} />
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// });
// 
// // ─── AppointmentsMain ─────────────────────────────────────────────────────────
// export function AppointmentsMain() {
//   const [filter, setFilter] = useState<FilterType>("month");
//   const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(
//     {},
//   );
// 
//   const { start, end } = useMemo(
//     () => getRangeForFilter(filter, customRange),
//     [filter, customRange],
//   );
//   const { appointments, setAppointments, loading, refetch } = useAppointments(
//     start,
//     end,
//   );
// 
//   const handleStatusChange = useCallback(
//     (id: string, status: AppointmentStatus) => {
//       setAppointments(prev =>
//         prev.map(apt => (apt.id === id ? { ...apt, status } : apt)),
//       );
//     },
//     [setAppointments],
//   );
// 
//   const days = useMemo(
//     () =>
//       getDaysForFilter(filter, customRange).filter(day =>
//         appointments.some(apt => isSameDay(day, apt.starts_at)),
//       ),
//     [filter, customRange, appointments],
//   );
// 
//   const appointmentsByDay = useMemo(() => {
//     const map = new Map<string, AppointmentWithRelations[]>();
//     for (const day of days) {
//       map.set(
//         day.toISOString(),
//         appointments.filter(apt => isSameDay(day, apt.starts_at)),
//       );
//     }
//     return map;
//   }, [days, appointments]);
// 
//   const [newModalOpen, setNewModalOpen] = useState(false);
//   const [cancelAppointment, setCancelAppointment] =
//     useState<AppointmentWithRelations | null>(null);
// 
//   const handleCancel = useCallback((apt: AppointmentWithRelations) => {
//     setCancelAppointment(apt);
//   }, []);
// 
//   return (
//     <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
//       <div className="lg:flex lg:flex-row-reverse">
//         {/* Header */}
//         <div className="w-fit flex flex-col sm:flex-row gap-4 items-center justify-between mx-auto lg:mr-0 mb-6">
//           <Button
//             className="cursor-pointer rounded-full"
//             onClick={() => setNewModalOpen(true)}
//           >
//             <Plus className="h-4 w-4" />
//             <span>Novo agendamento</span>
//           </Button>
//         </div>
// 
//         {/* Filtros */}
//         <div>
//           <div className="w-fit mx-auto lg:ml-0 flex flex-col items-center lg:items-start gap-3">
//             <div className="flex flex-wrap items-center justify-center gap-2">
//               {(["today", "week", "month", "year"] as FilterType[]).map(f => (
//                 <button
//                   key={f}
//                   onClick={() => setFilter(f)}
//                   className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
//                     filter === f
//                       ? "bg-primary text-primary-foreground border-primary"
//                       : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
//                   }`}
//                 >
//                   {FILTER_LABELS[f]}
//                 </button>
//               ))}
// 
//               <button
//                 onClick={() => setFilter("custom")}
//                 className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
//                   filter === "custom"
//                     ? "bg-primary text-primary-foreground border-primary"
//                     : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
//                 }`}
//               >
//                 <CalendarDays className="h-3.5 w-3.5" />
//                 Data específica
//               </button>
//             </div>
//           </div>
//           {filter === "custom" && (
//             <div className="flex flex-wrap items-center lg:justify-start justify-center gap-3 px-1 mt-3">
//               <div className="flex items-center gap-2">
//                 <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
//                   De
//                 </label>
//                 <div className="relative flex items-center">
//                   <input
//                     type="date"
//                     value={
//                       customRange.from
//                         ? customRange.from.toISOString().split("T")[0]
//                         : ""
//                     }
//                     onChange={e => {
//                       const d = e.target.value
//                         ? new Date(e.target.value + "T00:00:00")
//                         : undefined;
//                       setCustomRange(r => ({ ...r, from: d }));
//                     }}
//                     style={{ colorScheme: "light" }}
//                     className="h-8 rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
//                   />
//                   <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
//                 </div>
//               </div>
// 
//               <div className="flex items-center gap-2">
//                 <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
//                   Até
//                 </label>
//                 <div className="relative flex items-center">
//                   <input
//                     type="date"
//                     value={
//                       customRange.to
//                         ? customRange.to.toISOString().split("T")[0]
//                         : ""
//                     }
//                     min={
//                       customRange.from
//                         ? customRange.from.toISOString().split("T")[0]
//                         : undefined
//                     }
//                     onChange={e => {
//                       const d = e.target.value
//                         ? new Date(e.target.value + "T00:00:00")
//                         : undefined;
//                       setCustomRange(r => ({ ...r, to: d }));
//                     }}
//                     style={{ colorScheme: "light" }}
//                     className="h-8 rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
//                   />
//                   <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
// 
//       {/* Dias */}
//       {loading ? (
//         <div className="flex flex-col gap-3">
//           {Array.from({ length: 7 }).map((_, i) => (
//             <Skeleton key={i} className="h-12 w-full rounded-lg" />
//           ))}
//         </div>
//       ) : days.length === 0 ? (
//         <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
//           <CalendarDays className="h-10 w-10 opacity-20" />
//           <span className="text-sm opacity-50">
//             Nenhum agendamento encontrado neste período.
//           </span>
//         </div>
//       ) : (
//         <div className="flex flex-col gap-3">
//           {days.map(day => (
//             <DaySection
//               key={day.toISOString()}
//               date={day}
//               appointments={appointmentsByDay.get(day.toISOString()) ?? []}
//               onCancel={handleCancel}
//               onStatusChange={handleStatusChange}
//             />
//           ))}
//         </div>
//       )}
// 
//       <CreateAppointmentModal
//         open={newModalOpen}
//         onClose={() => setNewModalOpen(false)}
//         onSuccess={refetch}
//       />
// 
//       <DeleteAppointmentModal
//         open={!!cancelAppointment}
//         appointment={cancelAppointment}
//         onClose={() => setCancelAppointment(null)}
//         onSuccess={refetch}
//       />
//     </main>
//   );
// }
