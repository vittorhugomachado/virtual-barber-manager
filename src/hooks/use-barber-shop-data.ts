import { useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";

export function useBarbershopData() {
  const { session, loading: authLoading } = useAuth();
  const { setBarbershopWithRole, clearBarbershop } = useBarbershopStore();
  const [loading, setLoading] = useState(true);
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const userId = session?.user.id ?? null;

    // Usuário deslogou
    if (!userId) {
      if (loadedForRef.current !== null) {
        clearBarbershop();
        loadedForRef.current = null;
      }
      setLoading(false);
      return;
    }

    // Já carregou para este usuário
    if (loadedForRef.current === userId) {
      setLoading(false);
      return;
    }

    // Usuário trocou — limpa estado anterior antes de carregar
    clearBarbershop();
    loadedForRef.current = userId;
    setLoading(true);

    async function load() {
      // 1. Tenta carregar como owner
      const { data: ownerData } = await supabase
        .from("barbershops")
        .select("*, profiles(name)")
        .eq("owner_id", userId!)
        .maybeSingle();

      if (ownerData) {
        setBarbershopWithRole(
          { ...ownerData, owner_name: ownerData.profiles?.name ?? "" },
          "owner",
        );
        setLoading(false);
        return;
      }

      // 2. Tenta carregar como membro
      const { data: barbershopId } = await supabase.rpc(
        "get_my_member_barbershop_id",
      );

      if (barbershopId) {
        const [{ data: shopData }, { data: memberData }] = await Promise.all([
          supabase
            .from("barbershops")
            .select("*, profiles(name)")
            .eq("id", barbershopId)
            .single(),
          supabase
            .from("barbershop_members")
            .select("role")
            .eq("user_id", userId!)
            .single(),
        ]);

        if (shopData) {
          setBarbershopWithRole(
            { ...shopData, owner_name: shopData.profiles?.name ?? "" },
            memberData?.role ?? "reader",
          );
        }
      }

      setLoading(false);
    }

    load();
  }, [session?.user.id, authLoading, setBarbershopWithRole, clearBarbershop]);

  return { barbershop: useBarbershopStore(s => s.barbershop), loading };
}
