import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";

type FilterField =
  | "service_id"
  | "barber_id"
  | "customer_id"
  | "manual_customer_id";

export function useFutureAppointmentsCount(
  field: FilterField,
  id: string | null,
) {
  const barbershopId = useBarbershopStore(state => state.barbershop?.id);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !barbershopId) {
      setCount(0);
      return;
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(barbershopId)) return;

    async function fetchCount() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("id")
          .eq("barbershop_id", barbershopId)
          .eq(field, id!)
          .gte("starts_at", new Date().toISOString())
          .not(
            "status",
            "in",
            '("cancelled_by_customer","cancelled_by_barbershop","completed")',
          );

        if (error) {
          console.error("useFutureAppointmentsCount error:", error);
          setCount(0);
        } else {
          setCount(data?.length ?? 0);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCount();
  }, [id, field, barbershopId]);

  return { count, loading };
}
