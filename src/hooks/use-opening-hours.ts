// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import type { OpeningHours } from "@/types/opening-hours";
//
// export function useOpeningHours() {
//   const { barbershop } = useBarbershopStore();
//   const [openingHours, setOpeningHours] = useState<OpeningHours[]>([]);
//   const [loading, setLoading] = useState(true);
//
//   useEffect(() => {
//     if (!barbershop?.id) return;
//     let mounted = true;
//
//     supabase
//       .from("opening_hours")
//       .select("*")
//       .eq("barbershop_id", barbershop.id)
//       .order("day_of_week")
//       .then(({ data }) => {
//         if (!mounted) return;
//         if (data) setOpeningHours(data);
//         setLoading(false);
//       });
//
//     return () => {
//       mounted = false;
//     };
//   }, [barbershop?.id]);
//
//   return { openingHours, setOpeningHours, loading };
// }
