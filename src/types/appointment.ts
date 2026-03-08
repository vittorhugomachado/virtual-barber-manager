export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "cancelled_by_customer"
  | "cancelled_by_barbershop";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Confirmado",
  completed: "Concluído",
  cancelled_by_customer: "Cancelado pelo cliente",
  cancelled_by_barbershop: "Cancelado pela barbearia",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  cancelled_by_customer: "bg-red-500/10 text-red-500",
  cancelled_by_barbershop: "bg-orange-500/10 text-orange-500",
};

export type Appointment = {
  id: string;
  barbershop_id: string;
  customer_id: string;
  barber_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentWithRelations = Appointment & {
  customer: { id: string; name: string; phone: string };
  barber: { id: string; name: string };
  service: { id: string; name: string; duration_min: number; price: number };
};
