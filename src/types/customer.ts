export type Customer = {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  total_appointments?: number;
  last_appointment?: string | null;
};
