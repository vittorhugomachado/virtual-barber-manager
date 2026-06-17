export type PlanCycle = "MONTHLY" | "SEMIANNUALLY" | "YEARLY";

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  asaas_cycle: PlanCycle;
  sort_order: number;
};
