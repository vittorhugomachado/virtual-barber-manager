export type OpeningHours = {
  id: string;
  barbershop_id: string;
  day_of_week: number; // 0=domingo, 1=segunda... 6=sábado
  opens_at: string; // "08:00"
  closes_at: string; // "18:00"
  is_open: boolean;
  period_order: number;
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
