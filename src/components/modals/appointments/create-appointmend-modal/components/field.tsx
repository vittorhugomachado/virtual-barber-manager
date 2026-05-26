// import { AlertCircle } from "lucide-react";
//
// export function Field({
//   label,
//   icon,
//   children,
//   error,
// }: {
//   label: string;
//   icon: React.ReactNode;
//   children: React.ReactNode;
//   error?: string | null;
// }) {
//   return (
//     <div className="flex flex-col gap-1.5">
//       <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
//         {icon}
//         {label}
//       </label>
//       {children}
//       {error && (
//         <span className="flex items-center gap-1 text-xs text-destructive">
//           <AlertCircle className="h-3 w-3 shrink-0" />
//           {error}
//         </span>
//       )}
//     </div>
//   );
// }
//
// export const INPUT_CLS =
//   "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60";
