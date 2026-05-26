// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import type { Service } from "@/types/services";
//
// export type ServiceListItem = Pick<
//   Service,
//   "id" | "name" | "price" | "duration_min"
// >;
//
// export function useBarbershopServices() {
//   const { barbershop } = useBarbershopStore();
//   const [services, setServices] = useState<ServiceListItem[]>([]);
//
//   useEffect(() => {
//     if (!barbershop?.id) return;
//
//     supabase
//       .from("services")
//       .select("id, name, price, duration_min")
//       .eq("barbershop_id", barbershop.id)
//       .eq("is_active", true)
//       .then(({ data }) => {
//         if (data) setServices(data);
//       });
//   }, [barbershop?.id]);
//
//   return { services };
// }
