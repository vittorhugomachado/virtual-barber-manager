import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Customer } from "@/types/customer";

export function useCustomers() {
  const { barbershop } = useBarbershopStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop?.id) return;

    supabase
      .from("customers")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCustomers(data);
        setLoading(false);
      });
  }, [barbershop?.id]);

  return { customers, setCustomers, loading };
}
