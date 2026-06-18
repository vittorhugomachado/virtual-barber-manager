import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { useAuth } from "./use-auth";

/**
 * Carrega os dados da barbearia do usuário logado e popula o
 * `useBarbershopStore` (barbearia + papel + username do membro).
 *
 * Resolve dois cenários:
 *  - DONO: barbearia onde `owner_id = userId`.
 *  - MEMBRO: descobre a barbearia via RPC `get_my_member_barbershop_id` e lê
 *    o papel/username em `barbershop_members`.
 *
 * Sem dono nem vínculo de membro, desloga o usuário.
 */
export function useBarbershopData() {
  const { session, loading: authLoading } = useAuth();
  const setBarbershopWithRole = useBarbershopStore(
    s => s.setBarbershopWithRole,
  );
  const clearBarbershop = useBarbershopStore(s => s.clearBarbershop);
  const barbershop = useBarbershopStore(s => s.barbershop);

  // Guarda o último userId já carregado para evitar refazer a busca.
  const loadedForId = useRef<string | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user.id ?? null;
  const loading = authLoading || isLoading;

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function load() {
      // Sem usuário: limpa a barbearia (se havia) e encerra.
      if (!userId) {
        if (loadedForId.current) clearBarbershop();
        loadedForId.current = null;
        setIsLoading(false);
        return;
      }

      // Já carregado para este usuário: nada a fazer.
      if (loadedForId.current === userId) return;

      clearBarbershop();
      setIsLoading(true);

      // 1) Caminho do DONO.
      const { data: ownerShop } = await supabase
        .from("barbershops")
        .select("*, profiles(name)")
        .eq("owner_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (ownerShop) {
        setBarbershopWithRole(
          { ...ownerShop, owner_name: ownerShop.profiles?.name ?? "" },
          "owner",
        );
        loadedForId.current = userId;
        setIsLoading(false);
        return;
      }

      // 2) Caminho do MEMBRO: descobre a barbearia via RPC.
      const { data: memberBarbershopId, error: rpcError } = await supabase.rpc(
        "get_my_member_barbershop_id",
      );

      if (cancelled) return;

      // Sem dono e sem vínculo de membro -> desloga.
      if (rpcError || !memberBarbershopId) {
        await supabase.auth.signOut();
        loadedForId.current = userId;
        setIsLoading(false);
        return;
      }

      const [{ data: shop }, { data: member }] = await Promise.all([
        supabase
          .from("barbershops")
          .select("*, profiles(name)")
          .eq("id", memberBarbershopId)
          .single(),
        supabase
          .from("barbershop_members")
          .select("role, username")
          .eq("user_id", userId)
          .single(),
      ]);

      if (cancelled) return;

      if (shop) {
        setBarbershopWithRole(
          { ...shop, owner_name: shop.profiles?.name ?? "" },
          member?.role ?? "reader",
          member?.username ?? undefined,
        );
      }

      loadedForId.current = userId;
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, setBarbershopWithRole, clearBarbershop]);

  return { barbershop, loading };
}
