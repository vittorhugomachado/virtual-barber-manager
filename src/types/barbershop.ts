export type Barbershop = {
  id: string;
  owner_id: string;
  owner_name: string | null;
  name: string;
  slug: string;
  email: string;
  phone: string;
  plan: "iniciante" | "profissional" | "master";
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
};
