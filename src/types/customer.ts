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

export type CustomerSource = "customers" | "customers_auth";

export type Customer = CustomerRow & {
  total_appointments: number;
  last_appointment: string | null;
  source: CustomerSource;
};

export type CustomersPage = {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type CustomerHistoryItem = {
  id: string;
  starts_at: string;
  status:
    | "scheduled"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled_by_customer"
    | "cancelled_by_barbershop"
    | "no_show";
  service_name: string;
  barber_name: string | null;
};

export type CustomerHistoryPage = {
  status: "ok";
  items: CustomerHistoryItem[];
  total: number;
  last_appointment: string | null;
  page: number;
  page_size: number;
  total_pages: number;
};
