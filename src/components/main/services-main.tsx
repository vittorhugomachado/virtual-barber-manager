// import { useState } from "react";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   AlertTriangle,
//   Clock,
//   Lock,
//   Pencil,
//   Plus,
//   Scissors,
// } from "lucide-react";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { useServices } from "@/hooks/use-service";
// import { DASHBOARD_REFRESH_EVENT } from "@/hooks/use-dashboard";
// import { toggleActiveService } from "@/lib/supabase/services/toggle-active-service";
// import { planLabels, planServiceLimits } from "@/constants/plans";
// import { ServicesSkeleton } from "../skeleton/services-skeleton";
// import { PlansModal } from "@/components/modals/plans/plans-modal";
// import type { Service } from "@/types/services";
// import { CreateServiceModal } from "../modals/manage-services/create-service-modal";
// import { UpdateServiceModal } from "../modals/manage-services/update-service-modal";
//
// export function ServicesMain() {
//   const { barbershop } = useBarbershopStore();
//   const { services, setServices, loading } = useServices();
//   const [plansOpen, setPlansOpen] = useState(false);
//   const [createOpen, setCreateOpen] = useState(false);
//   const [editService, setEditService] = useState<Service | null>(null);
//
//   const plan = barbershop?.plan ?? "iniciante";
//   const limit = planServiceLimits[plan];
//   const activeCount = services.filter(s => s.is_active).length;
//   const canAddMore = activeCount < limit;
//
//   function notifyDashboardRefresh() {
//     window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
//   }
//
//   async function toggleActive(id: string) {
//     const target = services.find(s => s.id === id);
//     if (!target) return;
//
//     const newStatus = !target.is_active;
//
//     if (newStatus && activeCount >= limit && limit !== Infinity) {
//       const firstActive = services.find(s => s.is_active);
//       if (firstActive) {
//         const deactivated = await toggleActiveService(firstActive.id, false);
//         if (!deactivated) return;
//         const activated = await toggleActiveService(id, true);
//         if (!activated) return;
//         setServices(prev =>
//           prev.map(s => {
//             if (s.id === id) return { ...s, is_active: true };
//             if (s.id === firstActive.id) return { ...s, is_active: false };
//             return s;
//           }),
//         );
//         notifyDashboardRefresh();
//       }
//       return;
//     }
//
//     const success = await toggleActiveService(id, newStatus);
//     if (success) {
//       setServices(prev =>
//         prev.map(s => (s.id === id ? { ...s, is_active: newStatus } : s)),
//       );
//       notifyDashboardRefresh();
//     }
//   }
//
//   if (loading) return <ServicesSkeleton />;
//
//   return (
//     <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
//       {/* Header */}
//       <div className="flex flex-col md:flex-row items-center justify-center md:justify-between">
//         <div className="flex flex-col items-center md:items-start gap-1">
//           <Button
//             onClick={() => setPlansOpen(true)}
//             variant="secondary"
//             className="w-fit px-4 py-1 text-md rounded-full"
//           >
//             Plano {planLabels[plan]}
//           </Button>
//           <p className="text-sm text-muted-foreground text-center md:text-start ml-2">
//             O seu plano atual permite{" "}
//             {limit === Infinity
//               ? "serviços ilimitados"
//               : `${limit} serviço${limit !== 1 ? "s" : ""}`}{" "}
//             <br />
//             <span className="inline-flex items-center gap-1 mr-3">
//               <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
//               {activeCount} ativo{activeCount !== 1 ? "s" : ""}
//             </span>
//             <span className="inline-flex items-center gap-1">
//               <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
//               {services.length - activeCount} inativo
//               {services.length - activeCount !== 1 ? "s" : ""}
//             </span>
//           </p>
//           {activeCount === 0 && (
//             <div className="mt-2 text-sm w-full flex justify-center items-center gap-2 rounded-full border-yellow-500/60 bg-yellow-500/10 text-yellow-500 px-6 py-2">
//               <AlertTriangle className="h-4 w-4 shrink-0" />
//               <span className="whitespace-normal text-left">
//                 Sem nenhum serviço ativo o agendamento na sua barbearia fica
//                 indisponível
//               </span>
//             </div>
//           )}
//         </div>
//         {!canAddMore && limit !== Infinity && (
//           <Button
//             onClick={() => setPlansOpen(true)}
//             variant="secondary"
//             className="flex items-center rounded-full gap-1 bg-orange-600 hover:bg-orange-500 mt-4 py-2 md:mt-0 text-sm"
//           >
//             <Lock className="h-3 w-3" />
//             Limite atingido — faça upgrade
//           </Button>
//         )}
//       </div>
//
//       {/* Grid */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//         {services.map(service => (
//           <Card
//             key={service.id}
//             className={`${!service.is_active && "bg-zinc-950"} relative pt-0 h-full`}
//           >
//             <CardContent className="flex flex-col gap-3 p-0 pb-4 h-full">
//               {/* Badge status */}
//               <Badge
//                 className={`${service.is_active ? "bg-green-400" : "bg-red-500 text-white"} absolute top-3 right-3 cursor-pointer select-none z-10`}
//                 onClick={() => toggleActive(service.id)}
//               >
//                 {service.is_active ? "Ativo" : "Inativo"}
//               </Badge>
//
//               <div
//                 className={`${!service.is_active && "opacity-30"} flex flex-col gap-3 h-full`}
//               >
//                 {/* Imagem */}
//                 <div className="h-36 w-full rounded-t-lg bg-muted overflow-hidden">
//                   {service.image_url ? (
//                     <img
//                       src={service.image_url}
//                       alt={service.name}
//                       className="h-full w-full object-cover"
//                     />
//                   ) : (
//                     <div className="h-full w-full flex items-center justify-center">
//                       <Scissors className="h-8 w-8 text-muted-foreground/30" />
//                     </div>
//                   )}
//                 </div>
//
//                 {/* Dados */}
//                 <div className="flex flex-col flex-1 justify-between px-4 pb-0">
//                   <div className="flex flex-col gap-1">
//                     <span className="font-semibold truncate">
//                       {service.name}
//                     </span>
//                     {service.description && (
//                       <span className="text-xs text-muted-foreground line-clamp-2">
//                         {service.description}
//                       </span>
//                     )}
//                     <div className="flex items-center gap-3 text-sm text-muted-foreground">
//                       {service.duration_min && (
//                         <span className="flex items-center gap-1">
//                           <Clock className="h-3.5 w-3.5" />
//                           {service.duration_min} min
//                         </span>
//                       )}
//                       {service.price !== null && (
//                         <span className="flex items-center gap-1 font-medium text-foreground">
//                           R${" "}
//                           {Number(service.price).toFixed(2).replace(".", ",")}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//
//                   <Button
//                     size="sm"
//                     variant="outline"
//                     className="w-full cursor-pointer mt-3 rounded-full"
//                     onClick={() => setEditService(service)}
//                   >
//                     <Pencil className="h-3.5 w-3.5 mr-2" />
//                     Editar
//                   </Button>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//
//         {/* Card adicionar */}
//         {canAddMore ? (
//           <Card
//             onClick={() => setCreateOpen(true)}
//             className="border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
//           >
//             <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
//               <Button className="h-12 w-12 rounded-full flex items-center justify-center">
//                 <Plus className="h-5 w-5" />
//               </Button>
//               <span className="text-sm text-muted-foreground font-medium">
//                 Novo serviço
//               </span>
//             </CardContent>
//           </Card>
//         ) : (
//           <Card className="border-dashed bg-transparent">
//             <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
//               <div className="h-12 w-12 opacity-50 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
//                 <Lock className="h-5 w-5 text-muted-foreground" />
//               </div>
//               <span className="text-sm opacity-50 text-muted-foreground font-medium text-center">
//                 Faça upgrade para adicionar mais serviços
//               </span>
//               <Button
//                 onClick={() => setPlansOpen(true)}
//                 className="rounded-full"
//               >
//                 Conhecer planos
//               </Button>
//             </CardContent>
//           </Card>
//         )}
//       </div>
//
//       <PlansModal open={plansOpen} onClose={() => setPlansOpen(false)} />
//       <CreateServiceModal
//         open={createOpen}
//         onClose={() => setCreateOpen(false)}
//         onCreated={service => {
//           setServices(prev => [...prev, service]);
//           notifyDashboardRefresh();
//         }}
//       />
//       <UpdateServiceModal
//         open={!!editService}
//         service={editService}
//         onClose={() => setEditService(null)}
//         onUpdated={updated => {
//           setServices(prev =>
//             prev.map(s => (s.id === updated.id ? updated : s)),
//           );
//           notifyDashboardRefresh();
//         }}
//         onDeleted={id => {
//           setServices(prev => prev.filter(s => s.id !== id));
//           notifyDashboardRefresh();
//         }}
//       />
//     </main>
//   );
// }
