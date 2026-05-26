// import { useEffect, useState } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { CalendarDays, Clock, Phone, Scissors } from "lucide-react";
// import { supabase } from "@/lib/supabase/supabase";
// import type { Customer } from "@/types/customer";
// import type { AppointmentWithRelations } from "@/types/create-appointment";
//
// interface CustomerHistoryModalProps {
//   open: boolean;
//   customer: Customer | null;
//   onClose: () => void;
// }
//
// function formatDateTime(isoString: string): string {
//   const date = new Date(isoString);
//
//   return (
//     date.toLocaleDateString("pt-BR", {
//       day: "2-digit",
//       month: "2-digit",
//       year: "numeric",
//     }) +
//     " as " +
//     date.toLocaleTimeString("pt-BR", {
//       hour: "2-digit",
//       minute: "2-digit",
//     })
//   );
// }
//
// function getStatusBadge(status: AppointmentWithRelations["status"]) {
//   switch (status) {
//     case "scheduled":
//       return {
//         label: "Agendado",
//         className: "border border-blue-500/20 bg-blue-500/10 text-blue-600",
//       };
//     case "completed":
//       return {
//         label: "Concluido",
//         className:
//           "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
//       };
//     case "cancelled_by_customer":
//     case "cancelled_by_barbershop":
//       return {
//         label: "Cancelado",
//         className: "border border-rose-500/20 bg-rose-500/10 text-rose-600",
//       };
//     default:
//       return {
//         label: status,
//         className: "border border-border bg-muted text-muted-foreground",
//       };
//   }
// }
//
// export function CustomerHistoryModal({
//   open,
//   customer,
//   onClose,
// }: CustomerHistoryModalProps) {
//   const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(
//     [],
//   );
//   const [loading, setLoading] = useState(false);
//
//   useEffect(() => {
//     if (!open || !customer) return;
//
//     const currentCustomer = customer;
//     let active = true;
//
//     async function fetchHistory() {
//       setLoading(true);
//
//       const customerColumn =
//         currentCustomer.source === "customers_auth"
//           ? "customer_id"
//           : "manual_customer_id";
//
//       const { data } = await supabase
//         .from("appointments")
//         .select(
//           "*, barber:barbers(id, name), service:services(id, name, duration_min, price)",
//         )
//         .eq(customerColumn, currentCustomer.id)
//         .order("starts_at", { ascending: false });
//
//       if (!active) return;
//
//       setAppointments((data as AppointmentWithRelations[]) ?? []);
//       setLoading(false);
//     }
//
//     void fetchHistory();
//
//     return () => {
//       active = false;
//     };
//   }, [open, customer]);
//
//   if (!customer) return null;
//
//   const lastAppointment = appointments[0];
//
//   return (
//     <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
//       <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Histórico de {customer.name}</DialogTitle>
//         </DialogHeader>
//         <DialogDescription className="sr-only">
//           Histórico do usuário
//         </DialogDescription>
//         <div className="flex flex-col gap-4">
//           <div className="flex items-center gap-2 text-sm text-muted-foreground">
//             <Phone className="h-4 w-4" />
//             {customer.phone || "Sem telefone"}
//           </div>
//
//           <div className="flex items-center justify-center gap-6 rounded-lg border py-4">
//             <div className="flex flex-col items-center gap-1">
//               <span className="text-2xl font-bold">{appointments.length}</span>
//               <span className="text-xs text-muted-foreground">
//                 agendamentos
//               </span>
//             </div>
//             <div className="h-10 w-px bg-border" />
//             <div className="flex flex-col items-center gap-1">
//               <span className="text-sm font-medium">
//                 {lastAppointment
//                   ? new Date(lastAppointment.starts_at).toLocaleDateString(
//                       "pt-BR",
//                     )
//                   : "-"}
//               </span>
//               <span className="text-xs text-muted-foreground">
//                 ultimo agendamento
//               </span>
//             </div>
//           </div>
//
//           {loading ? (
//             <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
//               Carregando...
//             </div>
//           ) : appointments.length === 0 ? (
//             <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
//               <CalendarDays className="h-8 w-8 opacity-30" />
//               <span className="text-center text-sm opacity-50">
//                 Nenhum agendamento encontrado.
//               </span>
//             </div>
//           ) : (
//             <div className="flex flex-col gap-2">
//               {appointments.map(appointment => {
//                 const statusBadge = getStatusBadge(appointment.status);
//
//                 return (
//                   <div
//                     key={appointment.id}
//                     className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3 text-sm"
//                   >
//                     <div className="flex items-center justify-between gap-3">
//                       <div className="flex items-center gap-1.5 text-muted-foreground">
//                         <Clock className="h-3.5 w-3.5 shrink-0" />
//                         <span>{formatDateTime(appointment.starts_at)}</span>
//                       </div>
//                       <span
//                         className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}
//                       >
//                         {statusBadge.label}
//                       </span>
//                     </div>
//
//                     <div className="flex items-center gap-1.5 text-muted-foreground">
//                       <Scissors className="h-3.5 w-3.5 shrink-0" />
//                       <span>
//                         {appointment.service?.name ?? "Servico removido"}
//                       </span>
//                       {appointment.barber?.name && (
//                         <span className="text-muted-foreground/60">
//                           - {appointment.barber.name}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }
