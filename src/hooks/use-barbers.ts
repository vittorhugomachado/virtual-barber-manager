import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Barber } from "@/types/barber";

export function useBarbers({ enabled = true }: { enabled?: boolean } = {}) {
  const { barbershop } = useBarbershopStore();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!barbershop?.id) return;
    let mounted = true;

    supabase
      .from("barbers")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          // Ordenar pegando a data mais recente entre updated_at e created_at
          const sortedData = [...data].sort((a, b) => {
            const dateA = a.updated_at
              ? new Date(a.updated_at)
              : new Date(a.created_at);
            const dateB = b.updated_at
              ? new Date(b.updated_at)
              : new Date(b.created_at);
            return dateB.getTime() - dateA.getTime();
          });
          setBarbers(sortedData);
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [barbershop?.id, enabled]);

  return { barbers, setBarbers, loading };
}
