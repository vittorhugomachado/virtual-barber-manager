export type Barber = {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};
