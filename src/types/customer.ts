export type CustomerRow = {
  id: string;
  barbershop_id: string | null;
  created_at: string;
  name: string;
  phone: string | null;
  updated_at: string | null;
  auth: boolean;
  auth_user_id: string | null;
};

export type Customer = CustomerRow & {
  total_appointments?: number;
  last_appointment?: string | null;
  source?: "customers" | "customers_auth";
};
