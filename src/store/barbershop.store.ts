import type { Barbershop } from "@/types/barbershop";
import { create } from "zustand";

export type MemberRole = "owner" | "admin" | "reader";

type BarbershopStore = {
  barbershop: Barbershop | null;
  memberRole: MemberRole | null;
  setBarbershop: (data: Barbershop) => void;
  setMemberRole: (role: MemberRole) => void;
  clearBarbershop: () => void;
};

export const useBarbershopStore = create<BarbershopStore>(set => ({
  barbershop: null,
  memberRole: null,
  setBarbershop: data => set({ barbershop: data }),
  setMemberRole: role => set({ memberRole: role }),
  clearBarbershop: () => set({ barbershop: null, memberRole: null }),
}));
