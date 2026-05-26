// // ─── Appointment ─────────────────────────────────────────────────────────────
// 
// export type AppointmentStatus =
//   | "scheduled"
//   | "confirmed"
//   | "in_progress"
//   | "completed"
//   | "cancelled_by_customer"
//   | "cancelled_by_barbershop"
//   | "no_show";
// 
// export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
//   scheduled: "Agendado",
//   confirmed: "Confirmado",
//   in_progress: "Em atendimento",
//   completed: "Concluído",
//   cancelled_by_customer: "Cancelado pelo cliente",
//   cancelled_by_barbershop: "Cancelado",
//   no_show: "Não compareceu",
// };
// 
// export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
//   scheduled: "bg-blue-700 text-blue-100",
//   confirmed: "bg-emerald-700 text-emerald-100",
//   in_progress: "bg-amber-700 text-amber-100",
//   completed: "bg-green-700 text-green-100",
//   cancelled_by_customer: "bg-red-700 text-red-100",
//   cancelled_by_barbershop: "bg-red-700 text-red-100",
//   no_show: "bg-zinc-800 text-zinc-100",
// };
// 
// export interface AppointmentWithRelations {
//   id: string;
//   service_name: string | null;
//   service_price: number | null;
//   service_duration_min: number | null;
//   barber_name: string | null;
//   customer_name: string | null;
//   barbershop_id: string;
//   customer_id: string | null;
//   barber_id: string | null;
//   service_id: string | null;
//   starts_at: string;
//   ends_at: string;
//   status: AppointmentStatus;
//   notes: string | null;
//   created_at: string;
//   customer: {
//     id: string;
//     name: string;
//     phone: string | null;
//     source?: "customers" | "customers_auth";
//   } | null;
//   barber: {
//     id: string;
//     name: string;
//     avatar_url: string | null;
//   } | null;
//   service: {
//     id: string;
//     name: string;
//     duration_min: number | null;
//     price: number | null;
//   } | null;
// }
// 
// // ─── Modal steps ─────────────────────────────────────────────────────────────
// 
// export type Step = 1 | 2 | 3;
// export type CustomerMode = "existing" | "new" | null;
// 
// export interface ServiceSelection {
//   serviceId: string;
//   barberId: string;
//   time: string;
// }
// 
// export interface SelectedCustomer {
//   id: string;
//   name: string;
//   phone: string;
//   isNew?: boolean;
//   source?: "customers" | "customers_auth";
// }
// 
// export interface TimeSlot {
//   time: string; // "HH:MM"
//   available: boolean;
// }
// 
// export interface OpeningHourRow {
//   day_of_week: number;
//   opens_at: string;
//   closes_at: string;
//   is_open: boolean;
//   period_order: number;
// }
// 
// export interface BarberAvailabilityRow {
//   day_of_week: number;
//   is_day_off: boolean;
//   use_custom_hours: boolean;
//   starts_at: string | null;
//   ends_at: string | null;
//   period_order: number;
// }
