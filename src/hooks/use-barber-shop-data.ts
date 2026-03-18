import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";

export function useBarbershopData() {
  const { session, loading: authLoading } = useAuth();
  const { barbershop, setBarbershop, setMemberRole } = useBarbershopStore();
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

    async function load() {
      // 1. Tenta carregar como owner
      const { data: ownerData } = await supabase
        .from("barbershops")
        .select("*, profiles(name)")
        .eq("owner_id", session!.user.id)
        .single();

      if (ownerData) {
        setBarbershop({
          ...ownerData,
          owner_name: ownerData.profiles?.name ?? "",
        });
        setMemberRole("owner");
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
            .eq("user_id", session!.user.id)
            .single(),
        ]);

        if (shopData) {
          setBarbershop({
            ...shopData,
            owner_name: shopData.profiles?.name ?? "",
          });
          setMemberRole(memberData?.role ?? "reader");
        }
      }

      setLoading(false);
    }

    load();
  }, [session, authLoading, barbershop, setBarbershop, setMemberRole]);

  return { barbershop, loading };
}
