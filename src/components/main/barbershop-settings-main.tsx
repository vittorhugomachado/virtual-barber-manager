import { useBarbershopStore } from "@/store/barbershop.store";
import { BarbershopSettingsForm } from "../forms/barbershop-settings-form";

export function BarbershopSettingsMain() {
  const { barbershop } = useBarbershopStore();

  return (
    <>
      <h3>{barbershop?.name}</h3>
      <BarbershopSettingsForm barbershop={barbershop} />
    </>
  );
}
