// import { useEffect, useMemo, useState } from "react";
// import { Button } from "@/components/ui/button";
// import { useCustomers } from "@/hooks/use-customers";
// import { createCustomer } from "@/lib/supabase/customers/create-customer";
// import { supabase } from "@/lib/supabase/supabase";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { maskPhone } from "@/utils/masked-input-phone";
// import {
//   BadgeCheck,
//   ChevronLeft,
//   Phone,
//   Search,
//   User,
//   UserPlus,
//   Users,
// } from "lucide-react";
// import { Field, INPUT_CLS } from "./field";
//
// type CustomerMode = "existing" | "new" | null;
//
// interface SelectedCustomer {
//   id: string;
//   name: string;
//   phone: string;
//   isNew?: boolean;
//   source?: "customers" | "customers_auth";
// }
//
// type ExistingCustomerOption = {
//   id: string;
//   name: string;
//   phone: string;
//   source: "customers" | "customers_auth";
// };
//
// export function Step1Customer({
//   onSelect,
// }: {
//   onSelect: (customer: SelectedCustomer) => void;
// }) {
//   const { customers, loading } = useCustomers();
//   const { barbershop } = useBarbershopStore();
//   const barbershopId = barbershop?.id;
//   const [mode, setMode] = useState<CustomerMode>(null);
//   const [search, setSearch] = useState("");
//   const [newName, setNewName] = useState("");
//   const [newPhone, setNewPhone] = useState("");
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [phoneError, setPhoneError] = useState<string | null>(null);
//   const [authCustomers, setAuthCustomers] = useState<ExistingCustomerOption[]>(
//     [],
//   );
//   const [authCustomersLoading, setAuthCustomersLoading] = useState(false);
//
//   useEffect(() => {
//     if (!barbershopId) return;
//
//     let active = true;
//
//     async function loadCustomersAuthWithAppointments() {
//       setAuthCustomersLoading(true);
//
//       const { data: appointmentRows } = await supabase
//         .from("appointments")
//         .select("customer_id")
//         .eq("barbershop_id", barbershopId)
//         .not("customer_id", "is", null);
//
//       const authIds = Array.from(
//         new Set(
//           (appointmentRows ?? []).map(row => row.customer_id).filter(Boolean),
//         ),
//       );
//
//       if (authIds.length === 0) {
//         if (!active) return;
//         setAuthCustomers([]);
//         setAuthCustomersLoading(false);
//         return;
//       }
//
//       const { data: authRows } = await supabase
//         .from("customers")
//         .select("id, name, phone")
//         .in("id", authIds)
//         .eq("auth", true);
//
//       if (!active) return;
//
//       setAuthCustomers(
//         (authRows ?? []).map(row => ({
//           id: row.id,
//           name: row.name?.trim() || "Cliente sem nome",
//           phone: row.phone ?? "",
//           source: "customers_auth" as const,
//         })),
//       );
//       setAuthCustomersLoading(false);
//     }
//
//     void loadCustomersAuthWithAppointments();
//
//     return () => {
//       active = false;
//     };
//   }, [barbershopId]);
//
//   const normalizeStr = (value: string) =>
//     value
//       .normalize("NFD")
//       .replace(/[\u0300-\u036f]/g, "")
//       .toLowerCase();
//
//   const existingCustomers = useMemo<ExistingCustomerOption[]>(() => {
//     const localCustomers = customers.map(customer => ({
//       id: customer.id,
//       name: customer.name,
//       phone: customer.phone ?? "",
//       source: "customers" as const,
//     }));
//
//     const merged = new Map<string, ExistingCustomerOption>();
//
//     for (const customer of [...localCustomers, ...authCustomers]) {
//       const key = `${customer.source}:${customer.id}`;
//       merged.set(key, customer);
//     }
//
//     return Array.from(merged.values());
//   }, [customers, authCustomers]);
//
//   const searchDigits = search.replace(/\D/g, "");
//
//   const filtered = existingCustomers.filter(customer => {
//     if (!search.trim()) return true;
//
//     const nameMatch = normalizeStr(customer.name).includes(
//       normalizeStr(search),
//     );
//     const phoneMatch =
//       searchDigits.length > 0 &&
//       customer.phone.replace(/\D/g, "").includes(searchDigits);
//
//     return nameMatch || phoneMatch;
//   });
//
//   async function handleCreateCustomer(event: React.FormEvent) {
//     event.preventDefault();
//     if (!newName.trim() || !newPhone.trim() || !barbershop?.id) return;
//
//     setSubmitting(true);
//     setError(null);
//     setPhoneError(null);
//
//     const digits = newPhone.replace(/\D/g, "");
//     if (digits.length < 10) {
//       setPhoneError("Telefone inválido. Digite DDD + numero.");
//       setSubmitting(false);
//       return;
//     }
//
//     const result = await createCustomer({
//       barbershopId: barbershop.id,
//       name: newName.trim(),
//       phone: digits,
//     });
//
//     if (result.status === "conflict") {
//       setPhoneError(
//         `Telefone já cadastrado para "${result.existing.name}". Busque pelo cliente existente.`,
//       );
//       setSubmitting(false);
//       return;
//     }
//
//     if (result.status === "error") {
//       setError("Erro ao criar cliente. Tente novamente.");
//       setSubmitting(false);
//       return;
//     }
//
//     onSelect({
//       id: result.customer.id,
//       name: result.customer.name,
//       phone: result.customer.phone ?? "",
//       isNew: true,
//       source: "customers",
//     });
//     setSubmitting(false);
//   }
//
//   //CONSOLE PARA DEBUG
//   // console.log("compoenente step 1 ", {
//   //   customers,
//   //   loading,
//   //   authCustomers,
//   //   authCustomersLoading,
//   //   submitting,
//   // });
//
//   if (mode === null) {
//     return (
//       <div className="flex flex-col gap-4 px-4 py-6">
//         <p className="text-sm text-muted-foreground text-center">
//           O cliente ja possui cadastro?
//         </p>
//         <div className="grid grid-cols-2 gap-3">
//           {[
//             {
//               key: "existing" as const,
//               icon: <Users className="h-6 w-6" />,
//               title: "Cliente existente",
//               sub: "Buscar na lista",
//             },
//             {
//               key: "new" as const,
//               icon: <UserPlus className="h-6 w-6" />,
//               title: "Novo cliente",
//               sub: "Cadastrar agora",
//             },
//           ].map(option => (
//             <button
//               key={option.key}
//               onClick={() => setMode(option.key)}
//               className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-5 transition-all group hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
//             >
//               <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
//                 {option.icon}
//               </div>
//               <div className="text-center">
//                 <p className="text-sm font-semibold">{option.title}</p>
//                 <p className="mt-0.5 text-xs text-muted-foreground">
//                   {option.sub}
//                 </p>
//               </div>
//             </button>
//           ))}
//         </div>
//       </div>
//     );
//   }
//
//   if (mode === "existing") {
//     return (
//       <div className="flex flex-col gap-4 px-4 py-5">
//         <button
//           onClick={() => setMode(null)}
//           className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer w-fit"
//         >
//           <ChevronLeft className="h-3.5 w-3.5" />
//           Voltar
//         </button>
//
//         <div className="relative">
//           <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
//           <input
//             type="text"
//             placeholder="Buscar por nome ou telefone..."
//             value={search}
//             onChange={event => setSearch(event.target.value)}
//             className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
//             autoFocus
//           />
//         </div>
//
//         <div className="flex flex-col overflow-y-auto rounded-md border border-border divide-y divide-border">
//           {loading || authCustomersLoading ? (
//             <p className="py-8 text-center text-sm text-muted-foreground">
//               Carregando...
//             </p>
//           ) : filtered.length === 0 ? (
//             <p className="py-8 text-center text-sm text-muted-foreground">
//               Nenhum cliente encontrado.
//             </p>
//           ) : (
//             filtered.map(customer => (
//               <button
//                 key={`${customer.source}:${customer.id}`}
//                 onClick={() =>
//                   onSelect({
//                     id: customer.id,
//                     name: customer.name,
//                     phone: customer.phone,
//                     source: customer.source,
//                   })
//                 }
//                 className="flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
//               >
//                 <div className="flex w-full items-center gap-2.5">
//                   <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
//                     <User className="h-3.5 w-3.5 text-primary" />
//                   </div>
//                   <div className="flex flex-1 items-center justify-between min-w-0">
//                     <div className="flex items-center gap-1 min-w-0">
//                       <span className="truncate text-sm font-medium">
//                         {customer.name}
//                       </span>
//                       {customer.source === "customers_auth" && (
//                         <span title="Cliente criado com verificação de celular">
//                           <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
//                         </span>
//                       )}
//                     </div>
//                     {customer.phone && (
//                       <span className="ml-3 shrink-0 text-xs text-muted-foreground">
//                         {maskPhone(customer.phone)}
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               </button>
//             ))
//           )}
//         </div>
//       </div>
//     );
//   }
//
//   return (
//     <div className="flex flex-col gap-4 px-6 py-5">
//       <button
//         onClick={() => setMode(null)}
//         className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer w-fit"
//       >
//         <ChevronLeft className="h-3.5 w-3.5" />
//         Voltar
//       </button>
//       <form onSubmit={handleCreateCustomer} className="flex flex-col gap-4">
//         <Field label="Nome completo" icon={<User className="h-3.5 w-3.5" />}>
//           <input
//             type="text"
//             placeholder="Ex: Joao Silva"
//             value={newName}
//             onChange={event => setNewName(event.target.value)}
//             className={INPUT_CLS}
//             autoFocus
//           />
//         </Field>
//
//         <Field
//           label="Telefone / WhatsApp"
//           icon={<Phone className="h-3.5 w-3.5" />}
//           error={phoneError}
//         >
//           <input
//             type="text"
//             placeholder="(11) 99999-9999"
//             value={newPhone}
//             onChange={event => {
//               setNewPhone(maskPhone(event.target.value));
//               setPhoneError(null);
//             }}
//             className={INPUT_CLS}
//             maxLength={15}
//           />
//         </Field>
//
//         {error && (
//           <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
//             {error}
//           </p>
//         )}
//
//         <Button
//           disabled={!newName.trim() || !newPhone.trim() || submitting}
//           className="w-full cursor-pointer"
//         >
//           {submitting ? "Cadastrando..." : "Cadastrar e continuar"}
//         </Button>
//       </form>
//     </div>
//   );
// }
