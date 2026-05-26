// import { Card, CardContent } from "@/components/ui/card";
// import { Skeleton } from "@/components/ui/skeleton";
//
// export function ServicesSkeleton() {
//   return (
//     <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
//       <Skeleton className="h-4 w-48" />
//
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//         {Array.from({ length: 3 }).map((_, i) => (
//           <Card key={i} className="pt-0">
//             <CardContent className="flex flex-col gap-3 p-0 pb-4">
//               <Skeleton className="h-36 w-full rounded-t-lg rounded-b-none" />
//               <div className="flex flex-col gap-2 px-4">
//                 <Skeleton className="h-4 w-32" />
//                 <Skeleton className="h-3 w-full" />
//                 <Skeleton className="h-3 w-24" />
//                 <Skeleton className="h-8 w-full mt-1" />
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//       </div>
//     </main>
//   );
// }
