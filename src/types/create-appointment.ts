// ─── Appointment ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled_by_customer"
  | "cancelled_by_barbershop"
  | "no_show";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled_by_customer: "Cancelado",
  cancelled_by_barbershop: "Cancelado",
  no_show: "Não compareceu",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled_by_customer: "bg-red-100 text-red-700",
  cancelled_by_barbershop: "bg-red-100 text-red-700",
  no_show: "bg-zinc-100 text-zinc-500",
};

export interface AppointmentWithRelations {
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
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  barber: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  service: {
    id: string;
    name: string;
    duration_min: number | null;
    price: number | null;
  };
}

// ─── Modal steps ─────────────────────────────────────────────────────────────

export type Step = 1 | 2 | 3;
export type CustomerMode = "existing" | "new" | null;

export interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  isNew?: boolean;
}

export interface TimeSlot {
  time: string; // "HH:MM"
  available: boolean;
}

export interface OpeningHourRow {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
  period_order: number;
}

export interface BarberAvailabilityRow {
  day_of_week: number;
  is_day_off: boolean;
  use_custom_hours: boolean;
  starts_at: string | null;
  ends_at: string | null;
  period_order: number;
}
