import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";

export function useBarbershopData() {
  const { session, loading: authLoading } = useAuth();
  const { barbershop, setBarbershop } = useBarbershopStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!session?.user.id) {
      setLoading(false);
      return;
    }

    if (barbershop) {
      setLoading(false);
      return;
    }

    supabase
      .from("barbershops")
      .select(
        `
        *,
        profiles (
          name
        )
      `,
      )
      .eq("owner_id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data)
          setBarbershop({
            ...data,
            owner_name: data.profiles?.name ?? "",
          });
        setLoading(false);
      });
  }, [session, authLoading, barbershop, setBarbershop]);

  return { barbershop, loading };
}
