// import { useEffect, useRef, useState } from "react";
// import { useAuth } from "./use-auth";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";
//
// export function useBarbershopData() {
//   const { session, loading: authLoading } = useAuth();
//   const { setBarbershopWithRole, clearBarbershop } = useBarbershopStore();
//   const loadedForId = useRef<string | null | undefined>(undefined);
//   const [isLoading, setIsLoading] = useState(true);
//
//   const userId = session?.user.id ?? null;
//   const loading = authLoading || isLoading;
//
//   useEffect(() => {
//     if (authLoading) return;
//
//     let cancelled = false;
//
//     async function load() {
//       const supabase = await getSupabaseClient();
//
//       if (cancelled) return;
//
//       if (!userId) {
//         if (loadedForId.current !== null && loadedForId.current !== undefined) {
//           clearBarbershop();
//           loadedForId.current = null;
//         }
//         setIsLoading(false);
//         return;
//       }
//
//       if (loadedForId.current === userId) return;
//
//       clearBarbershop();
//       setIsLoading(true);
//
//       const { data: ownerData } = await supabase
//         .from("barbershops")
//         .select("*, profiles(name)")
//         .eq("owner_id", userId)
//         .maybeSingle();
//
//       if (cancelled) return;
//
//       if (ownerData) {
//         setBarbershopWithRole(
//           { ...ownerData, owner_name: ownerData.profiles?.name ?? "" },
//           "owner",
//         );
//         loadedForId.current = userId;
//         setIsLoading(false);
//         return;
//       }
//
//       const { data: barbershopId, error: rpcError } = await supabase.rpc(
//         "get_my_member_barbershop_id",
//       );
//
//       if (cancelled) return;
//
//       if (rpcError || !barbershopId) {
//         await supabase.auth.signOut();
//         setIsLoading(false);
//         return;
//       }
//
//       const [{ data: shopData }, { data: memberData }] = await Promise.all([
//         supabase
//           .from("barbershops")
//           .select("*, profiles(name)")
//           .eq("id", barbershopId)
//           .single(),
//         supabase
//           .from("barbershop_members")
//           .select("role, username")
//           .eq("user_id", userId)
//           .single(),
//       ]);
//
//       if (cancelled) return;
//
//       if (shopData) {
//         setBarbershopWithRole(
//           { ...shopData, owner_name: shopData.profiles?.name ?? "" },
//           memberData?.role ?? "reader",
//           memberData?.username ?? undefined,
//         );
//       }
//
//       loadedForId.current = userId;
//       setIsLoading(false);
//     }
//
//     void load();
//
//     return () => {
//       cancelled = true;
//     };
//   }, [userId, authLoading, setBarbershopWithRole, clearBarbershop]);
//
//   return { barbershop: useBarbershopStore(s => s.barbershop), loading };
// }
