// import { useServices } from "@/hooks/use-service";
// import { Check, ChevronLeft, Clock, Scissors } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { useState } from "react";
//
// export function Step2Service({
//   onBack,
//   onSelect,
// }: {
//   onBack: () => void;
//   onSelect: (serviceIds: string[]) => void;
// }) {
//   const { services, loading } = useServices();
//   const [selected, setSelected] = useState<string[]>([]);
//
//   const activeServices = services.filter(s => s.is_active);
//
//   function toggle(id: string) {
//     setSelected(prev =>
//       prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
//     );
//   }
//
//   const totalDuration = selected.reduce((acc, id) => {
//     const s = services.find(sv => sv.id === id);
//     return acc + (s?.duration_min ?? 0);
//   }, 0);
//
//   const totalPrice = selected.reduce((acc, id) => {
//     const s = services.find(sv => sv.id === id);
//     return acc + Number(s?.price ?? 0);
//   }, 0);
//
//   //CONSOLE PARA DEBUG
//   // console.log("compoenente step 2 ", {
//   //   selected,
//   //   activeServices,
//   // });
//
//   return (
//     <div className="flex flex-col gap-5 px-4 py-5">
//       <button
//         onClick={onBack}
//         className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
//       >
//         <ChevronLeft className="h-3.5 w-3.5" />
//         Voltar
//       </button>
//
//       <div className="flex flex-col gap-2">
//         <div className="flex items-center justify-between ml-2">
//           <label className="text-md font-medium text-muted-foreground">
//             Serviços
//           </label>
//           {selected.length > 0 && (
//             <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
//               <Clock className="h-3 w-3" />
//               {totalDuration} min
//               {totalPrice > 0 &&
//                 ` · R$ ${totalPrice.toFixed(2).replace(".", ",")}`}
//             </span>
//           )}
//         </div>
//
//         {loading ? (
//           <p className="text-sm text-muted-foreground">Carregando…</p>
//         ) : activeServices.length === 0 ? (
//           <p className="text-sm text-muted-foreground">
//             Nenhum serviço disponível.
//           </p>
//         ) : (
//           <div
//             className="grid grid-cols-1 justify-center
//             min-[385px]:grid-cols-2
//             min-[545px]:grid-cols-3
//             min-[545px]:max-w-3xl
//             mx-auto gap-2"
//           >
//             {activeServices.map(s => {
//               const isSelected = selected.includes(s.id);
//               return (
//                 <button
//                   key={s.id}
//                   onClick={() => toggle(s.id)}
//                   className={`w-full flex flex-col items-start gap-0.5 rounded-xl border-2 text-left transition-all cursor-pointer overflow-hidden ${
//                     isSelected
//                       ? "border-primary bg-primary/5"
//                       : "border-border hover:border-primary/40 hover:bg-muted/40"
//                   }`}
//                 >
//                   {s.image_url ? (
//                     <div className="relative h-20 w-full">
//                       <img
//                         src={s.image_url}
//                         alt={s.name}
//                         className="h-20 w-full object-cover"
//                       />
//                       {isSelected && (
//                         <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
//                           <Check className="h-3 w-3 text-primary-foreground" />
//                         </div>
//                       )}
//                     </div>
//                   ) : (
//                     <div className="h-20 w-full flex items-center justify-center bg-muted relative">
//                       <Scissors className="h-8 w-8 text-muted-foreground/30" />
//                       {isSelected && (
//                         <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
//                           <Check className="h-3 w-3 text-primary-foreground" />
//                         </div>
//                       )}
//                     </div>
//                   )}
//                   <div className="flex flex-col px-3 py-2">
//                     <span className="text-sm font-semibold">{s.name}</span>
//                     <span className="text-xs text-muted-foreground">
//                       {s.duration_min ? `${s.duration_min} min` : ""}
//                       {s.duration_min && s.price ? " · " : ""}
//                       {s.price
//                         ? `R$ ${Number(s.price).toFixed(2).replace(".", ",")}`
//                         : ""}
//                     </span>
//                   </div>
//                 </button>
//               );
//             })}
//           </div>
//         )}
//       </div>
//
//       <Button
//         onClick={() => selected.length > 0 && onSelect(selected)}
//         disabled={selected.length === 0}
//         className="cursor-pointer w-full mt-1 rounded-full"
//       >
//         Continuar
//         {selected.length > 1 ? ` (${selected.length} serviços)` : ""}
//       </Button>
//     </div>
//   );
// }
