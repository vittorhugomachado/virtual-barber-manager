import { useEffect, useState } from "react";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";
import type { Customer } from "@/types/customer";

export function useAllCustomers() {
  const { barbershop } = useBarbershopStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barbershop?.id) return;

    async function loadCustomers() {
      setLoading(true);

      const response = await supabase.rpc("vb_console_get_customers", {
        p_barbershop_id: barbershop?.id,
      });

      const data = response.data as Customer[] | null;
      const error = response.error;

      if (error) {
        console.error("Erro ao buscar clientes", error);
        setCustomers([]);
        setLoading(false);
        return;
      }

      setCustomers(data ?? []);
      setLoading(false);
    }

    void loadCustomers();
  }, [barbershop?.id]);

  return { customers, setCustomers, loading };
}
