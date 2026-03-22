import type { Barbershop } from "@/types/barbershop";
import { create } from "zustand";

export type MemberRole = "owner" | "admin" | "reader";

type BarbershopStore = {
  barbershop: Barbershop | null;
  memberRole: MemberRole | null;
  memberUsername: string | null;
  setBarbershop: (data: Barbershop) => void;
  setMemberRole: (role: MemberRole) => void;
  setBarbershopWithRole: (
    data: Barbershop,
    role: MemberRole,
    username?: string,
  ) => void;
  clearBarbershop: () => void;
};

export const useBarbershopStore = create<BarbershopStore>(set => ({
  barbershop: null,
  memberRole: null,
  memberUsername: null,
  setBarbershop: data => set({ barbershop: data }),
  setMemberRole: role => set({ memberRole: role }),
  setBarbershopWithRole: (data, role, username) =>
    set({
      barbershop: data,
      memberRole: role,
      memberUsername: username ?? null,
    }),
  clearBarbershop: () =>
    set({ barbershop: null, memberRole: null, memberUsername: null }),
}));
