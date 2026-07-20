import { supabase } from "@/lib/supabase/supabase";
import type {
  AppointmentBookingContext,
  AppointmentStatus,
  AppointmentWithRelations,
  SelectedCustomer,
  ServiceSelection,
  TimeSlot,
} from "@/types/create-appointment";

type AppointmentsResult = {
  items: AppointmentWithRelations[];
  timezone: string;
};

function throwRpcError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const cause = new Error(error.message) as Error & { code?: string };
  cause.code = error.code;
  throw cause;
}

export async function getManagerAppointments(params: {
  barbershopId: string;
  fromDate: string;
  toDateExclusive: string;
}): Promise<AppointmentsResult> {
  const { data, error } = await supabase.rpc("get_manager_appointments", {
    p_barbershop_id: params.barbershopId,
    p_from_date: params.fromDate,
    p_to_date_exclusive: params.toDateExclusive,
    p_limit: 5000,
  });
  throwRpcError(error);
  return data as AppointmentsResult;
}

export async function getAppointmentBookingContext(
  barbershopId: string,
): Promise<AppointmentBookingContext> {
  const { data, error } = await supabase.rpc(
    "get_appointment_booking_context",
    { p_barbershop_id: barbershopId },
  );
  throwRpcError(error);
  return data as AppointmentBookingContext;
}

export async function getAvailableAppointmentSlots(params: {
  barbershopId: string;
  serviceId: string;
  barberId: string;
  localDate: string;
}): Promise<TimeSlot[]> {
  const { data, error } = await supabase.rpc(
    "get_available_appointment_slots",
    {
      p_barbershop_id: params.barbershopId,
      p_service_id: params.serviceId,
      p_barber_id: params.barberId,
      p_local_date: params.localDate,
    },
  );
  throwRpcError(error);
  return ((data as { slots?: TimeSlot[] } | null)?.slots ?? []) as TimeSlot[];
}

export async function createManagerAppointments(params: {
  barbershopId: string;
  customer: SelectedCustomer;
  localDate: string;
  selections: ServiceSelection[];
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("create_manager_appointments", {
    p_barbershop_id: params.barbershopId,
    p_customer_id: params.customer.id,
    p_customer_source: params.customer.source ?? "customers",
    p_local_date: params.localDate,
    p_items: params.selections.map(item => ({
      service_id: item.serviceId,
      barber_id: item.barberId,
      time: item.time,
    })),
    p_idempotency_key: params.idempotencyKey,
  });
  throwRpcError(error);
  return data as { appointments: AppointmentWithRelations[] };
}

export async function changeManagerAppointmentStatus(params: {
  appointmentId: string;
  expectedStatus: AppointmentStatus;
  newStatus: AppointmentStatus;
}): Promise<AppointmentWithRelations> {
  const { data, error } = await supabase.rpc(
    "change_manager_appointment_status",
    {
      p_appointment_id: params.appointmentId,
      p_expected_status: params.expectedStatus,
      p_new_status: params.newStatus,
    },
  );
  throwRpcError(error);
  return (data as { appointment: AppointmentWithRelations }).appointment;
}
