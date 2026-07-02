import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Service } from "@/types/services";

export function useServices() {
  const { barbershop } = useBarbershopStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop?.id) return;

    supabase
      .from("services")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .then(({ data }) => {
        if (data) setServices(data);
        setLoading(false);
      });
  }, [barbershop?.id]);

  return { services, setServices, loading };
}
