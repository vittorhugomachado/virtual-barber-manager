import { useEffect } from "react";
import { useAuth } from "./use-auth";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";

export function useBarbershopData() {
  const { session } = useAuth();
  const { barbershop, setBarbershop } = useBarbershopStore();

  useEffect(() => {
    if (!session?.user.id || barbershop) return;

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
      });
  }, [session, barbershop, setBarbershop]);

  return { barbershop };
}
