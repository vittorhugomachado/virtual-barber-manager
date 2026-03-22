import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";

export function useBarbershopData() {
  const { session, loading: authLoading } = useAuth();
  const { setBarbershopWithRole, clearBarbershop } = useBarbershopStore();
  // undefined = not yet initialized, null = no user, string = loaded for that userId
  const [loadedForId, setLoadedForId] = useState<string | null | undefined>(
    undefined,
  );

  const userId = session?.user.id ?? null;
  const loading = authLoading || (userId !== null && loadedForId !== userId);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      if (loadedForId !== null && loadedForId !== undefined) {
        clearBarbershop();
        setLoadedForId(null);
      }
      return;
    }

    if (loadedForId === userId) return;

    clearBarbershop();

    let cancelled = false;

    async function load() {
      // 1. Tenta carregar como owner
      const { data: ownerData } = await supabase
        .from("barbershops")
        .select("*, profiles(name)")
        .eq("owner_id", userId!)
        .maybeSingle();

      if (cancelled) return;

      if (ownerData) {
        setBarbershopWithRole(
          { ...ownerData, owner_name: ownerData.profiles?.name ?? "" },
          "owner",
        );
        setLoadedForId(userId);
        return;
      }

      // 2. Tenta carregar como membro
      const { data: barbershopId, error: rpcError } = await supabase.rpc(
        "get_my_member_barbershop_id",
      );

      if (cancelled) return;

      if (rpcError || !barbershopId) {
        // Usuário autenticado mas sem vínculo — conta pode ter sido excluída
        await supabase.auth.signOut();
        return;
      }

      const [{ data: shopData }, { data: memberData }] = await Promise.all([
        supabase
          .from("barbershops")
          .select("*, profiles(name)")
          .eq("id", barbershopId)
          .single(),
        supabase
          .from("barbershop_members")
          .select("role, username")
          .eq("user_id", userId!)
          .single(),
      ]);

      if (cancelled) return;

      if (shopData) {
        setBarbershopWithRole(
          { ...shopData, owner_name: shopData.profiles?.name ?? "" },
          memberData?.role ?? "reader",
          memberData?.username ?? undefined,
        );
      }

      setLoadedForId(userId);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    authLoading,
    setBarbershopWithRole,
    clearBarbershop,
    loadedForId,
  ]);

  return { barbershop: useBarbershopStore(s => s.barbershop), loading };
}
