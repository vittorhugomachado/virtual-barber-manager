import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Barber } from "@/types/barber";

export function useBarbers() {
  const { barbershop } = useBarbershopStore();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
console.log("barbershop", barbershop);
  useEffect(() => {
    if (!barbershop?.id) return;
    let mounted = true;

    supabase
      .from("barbers")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .then(({ data }) => {
        if (!mounted) return;
        if (data) setBarbers(data);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [barbershop?.id]);

  return { barbers, setBarbers, loading };
}
