import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";

export type ServiceListItem = {
  id: string;
  name: string;
  price: number;
  duration_min: number;
};

export function useBarbershopServices() {
  const { barbershop } = useBarbershopStore();
  const [services, setServices] = useState<ServiceListItem[]>([]);

  useEffect(() => {
    if (!barbershop?.id) return;

    supabase
      .from("services")
      .select("id, name, price, duration_min")
      .eq("barbershop_id", barbershop.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setServices(data);
      });
  }, [barbershop?.id]);

  return { services };
}
