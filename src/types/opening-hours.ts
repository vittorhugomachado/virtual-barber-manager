export type OpeningHours = {
  id: string;
  barbershop_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
};

export const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};
