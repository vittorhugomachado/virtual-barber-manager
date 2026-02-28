import type { Barbershop } from "@/types/barbershop";
import { create } from "zustand";

type BarbershopStore = {
  barbershop: Barbershop | null;
  setBarbershop: (data: Barbershop) => void;
  clearBarbershop: () => void;
};

export const useBarbershopStore = create<BarbershopStore>(set => ({
  barbershop: null,
  setBarbershop: data => set({ barbershop: data }),
  clearBarbershop: () => set({ barbershop: null }),
}));
