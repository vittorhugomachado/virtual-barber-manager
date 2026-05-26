// import { Check } from "lucide-react";
//
// export function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
//   const steps = [
//     { n: 1, label: "Cliente" },
//     { n: 2, label: "Serviço" },
//     { n: 3, label: "Data" },
//     { n: 4, label: "Profissional" },
//   ] as const;
//
//   return (
//     <div className="flex items-center justify-center px-4 py-4 gap-8 md:gap-12 bg-muted/20 shrink-0">
//       {steps.map(s => (
//         <div key={s.n} className="flex items-center gap-3">
//           <div className="flex w-8 flex-col items-center gap-1">
//             <div
//               className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
//                 current > s.n
//                   ? "bg-primary text-primary-foreground"
//                   : current === s.n
//                     ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
//                     : "bg-muted text-muted-foreground"
//               }`}
//             >
//               {current > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
//             </div>
//             <span
//               className={`text-[13px] font-medium whitespace-nowrap ${
//                 current === s.n ? "text-primary" : "text-muted-foreground"
//               }`}
//             >
//               {s.label}
//             </span>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }
