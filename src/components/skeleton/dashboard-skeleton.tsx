// import { Skeleton } from "@/components/ui/skeleton";
//
// export function DashboardSkeleton() {
//   return (
//     <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
//       {/* Header */}
//       <div className="flex flex-col gap-2">
//         <Skeleton className="h-8 w-56" />
//         <Skeleton className="h-4 w-40" />
//       </div>
//
//       {/* KPI Cards */}
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
//         {Array.from({ length: 4 }).map((_, i) => (
//           <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
//             <div className="flex items-center justify-between">
//               <Skeleton className="h-3 w-24" />
//             </div>
//             <Skeleton className="h-8 w-20" />
//             <Skeleton className="h-3 w-25" />
//           </div>
//         ))}
//       </div>
//
//       {/* Main content */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
//         {/* Today's schedule */}
//         <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
//           <div className="flex items-center gap-2 px-4 py-3 border-b">
//             <Skeleton className="h-4 w-4 rounded" />
//             <Skeleton className="h-4 w-28" />
//           </div>
//           <div className="divide-y">
//             {Array.from({ length: 5 }).map((_, i) => (
//               <div key={i} className="flex items-center gap-3 px-4 py-3">
//                 <Skeleton className="h-4 w-12 shrink-0" />
//                 <div className="flex flex-col gap-1.5 flex-1 min-w-0">
//                   <Skeleton className="h-4 w-21" />
//                   <Skeleton className="h-3 w-38" />
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//
//         {/* Right column */}
//         <div className="flex flex-col gap-4">
//           {/* Top services */}
//           <div className="bg-card border rounded-xl overflow-hidden flex-1">
//             <div className="flex items-center gap-2 px-4 py-3 border-b">
//               <Skeleton className="h-4 w-4 rounded" />
//               <Skeleton className="h-4 w-36" />
//             </div>
//             <div className="p-4 flex flex-col gap-4">
//               {Array.from({ length: 4 }).map((_, i) => (
//                 <div key={i} className="flex flex-col gap-1.5">
//                   <div className="flex items-center justify-between">
//                     <Skeleton className="h-3 w-32" />
//                     <Skeleton className="h-3 w-6" />
//                   </div>
//                   <Skeleton className="h-1.5 w-full rounded-full" />
//                 </div>
//               ))}
//             </div>
//           </div>
//
//           {/* New customers card */}
//           <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
//             <Skeleton className="h-10 w-10 rounded-full shrink-0" />
//             <div className="flex flex-col gap-1.5">
//               <Skeleton className="h-3 w-24" />
//               <Skeleton className="h-6 w-10" />
//               <Skeleton className="h-3 w-16" />
//             </div>
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// }
