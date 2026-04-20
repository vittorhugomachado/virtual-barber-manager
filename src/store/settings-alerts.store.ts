import { create } from "zustand";

type SettingsAlertsStore = {
  tick: number;
  refetch: () => void;
};

export const useSettingsAlertsStore = create<SettingsAlertsStore>(set => ({
  tick: 0,
  refetch: () => set(s => ({ tick: s.tick + 1 })),
}));
