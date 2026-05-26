// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { useSettingsAlertsStore } from "@/store/settings-alerts.store";
// 
// export function useSettingsAlerts() {
//   const { barbershop } = useBarbershopStore();
//   const { tick, refetch } = useSettingsAlertsStore();
//   const [missingAddress, setMissingAddress] = useState(false);
//   const [missingHours, setMissingHours] = useState(false);
// 
//   useEffect(() => {
//     if (!barbershop?.id) return;
// 
//     Promise.all([
//       supabase
//         .from("addresses")
//         .select("id", { count: "exact", head: true })
//         .eq("barbershop_id", barbershop.id),
//       supabase
//         .from("opening_hours")
//         .select("id", { count: "exact", head: true })
//         .eq("barbershop_id", barbershop.id)
//         .eq("is_open", true),
//     ]).then(([addressRes, hoursRes]) => {
//       setMissingAddress((addressRes.count ?? 0) === 0);
//       setMissingHours((hoursRes.count ?? 0) === 0);
//     });
//   }, [barbershop?.id, tick]);
// 
//   return {
//     missingAddress,
//     missingHours,
//     refetch,
//   };
// }
