// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// 
// type Barber = {
//   id: string;
//   barbershop_id: string;
//   name: string;
//   description: string | null;
//   is_active: boolean;
//   avatar_url: string | null;
// };
// 
// export function useBarbers() {
//   const { barbershop } = useBarbershopStore();
//   const [barbers, setBarbers] = useState<Barber[]>([]);
//   const [loading, setLoading] = useState(true);
// 
//   useEffect(() => {
//     if (!barbershop?.id) return;
// 
//     supabase
//       .from("barbers")
//       .select("*")
//       .eq("barbershop_id", barbershop.id)
//       .then(({ data }) => {
//         if (data) setBarbers(data);
//         setLoading(false);
//       });
//   }, [barbershop?.id]);
// 
//   return { barbers, setBarbers, loading };
// }
