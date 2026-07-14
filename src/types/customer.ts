export type Customer = {
  id: string;
  barbershop_id?: string | null;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at?: string | null;
  total_appointments?: number;
  last_appointment?: string | null;
  source?: "customers" | "customers_auth";
};
