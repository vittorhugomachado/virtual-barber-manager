export type Barber = {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export type Service = {
  id: string;
  name: string;
  price: number | null;
  duration_min: number | null;
};