export type Barbershop = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  template: string;
  is_active: boolean;
  timezone: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string | null;
  owner_name?: string;
};
