// import { useEffect, useMemo, useState } from "react";
// import {
//   Banknote,
//   CalendarClock,
//   CheckCircle2,
//   CreditCard,
//   Loader2,
//   QrCode,
//   ReceiptText,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { getPlans } from "@/lib/supabase/plans";
// import type { Plan, PlanCycle } from "@/lib/supabase/plans";
// import { supabase } from "@/lib/supabase/supabase";
// import { cn } from "@/lib/utils";
// import { isValidCpfCnpj } from "@/utils/validate-cpf-cnpj";

// type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

// const fallbackPlans: Plan[] = [
//   {
//     id: "a58887c2-a3c5-49f6-8435-1aa3435e6ad8",
//     code: "pro_monthly",
//     name: "Virtual Barber Pro - Mensal",
//     description: "Pagina personalizada, agendamentos e gestao completa.",
//     price_cents: 3990,
//     asaas_cycle: "MONTHLY",
//     sort_order: 1,
//   },
//   {
//     id: "8ba32aca-f61d-4370-9288-b7cbc4b751d3",
//     code: "pro_semiannual",
//     name: "Virtual Barber Pro - Semestral",
//     description: "Tudo do plano, com 6 meses por um valor reduzido.",
//     price_cents: 21000,
//     asaas_cycle: "SEMIANNUALLY",
//     sort_order: 2,
//   },
//   {
//     id: "408eb1d7-66eb-4a2f-ad9b-0ef2b01b883f",
//     code: "pro_yearly",
//     name: "Virtual Barber Pro - Anual",
//     description: "Tudo do plano, com o melhor preco no ciclo anual.",
//     price_cents: 36000,
//     asaas_cycle: "YEARLY",
//     sort_order: 3,
//   },
// ];

// const cycleOptions: Array<{
//   cycle: PlanCycle;
//   label: string;
//   hint: string;
// }> = [
//   { cycle: "MONTHLY", label: "Mensal", hint: "Cobrança todo mes" },
//   {
//     cycle: "SEMIANNUALLY",
//     label: "Semestral",
//     hint: "Cobrança a cada 6 meses",
//   },
//   { cycle: "YEARLY", label: "Anual", hint: "Cobrança a cada 12 meses" },
// ];

// const billingOptions: Array<{
//   type: BillingType;
//   label: string;
//   icon: typeof QrCode;
// }> = [
//   { type: "PIX", label: "Pix", icon: QrCode },
//   { type: "BOLETO", label: "Boleto", icon: ReceiptText },
//   { type: "CREDIT_CARD", label: "cartão", icon: CreditCard },
// ];

// function formatMoney(cents: number) {
//   return new Intl.NumberFormat("pt-BR", {
//     style: "currency",
//     currency: "BRL",
//   }).format(cents / 100);
// }

// function getErrorMessage(error: unknown) {
//   if (error instanceof Error) return error.message;
//   if (typeof error === "string") return error;
//   return "Erro desconhecido";
// }

// type InvokeErrorWithContext = {
//   context?: {
//     json?: () => Promise<unknown>;
//   };
// };

// export function AsaasTestPage() {
//   const [plans, setPlans] = useState<Plan[]>(fallbackPlans);
//   const [selectedCycle, setSelectedCycle] = useState<PlanCycle>("MONTHLY");
//   const [billingType, setBillingType] = useState<BillingType>("PIX");
//   const [loadingPlans, setLoadingPlans] = useState(true);
//   const [plansWarning, setPlansWarning] = useState<string | null>(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [result, setResult] = useState<unknown>(null);
//   const [error, setError] = useState<string | null>(null);

//   const [barbershopId, setBarbershopId] = useState<string>("");
//   const [barbershopName, setBarbershopName] = useState<string | null>(null);
//   const [loadingShop, setLoadingShop] = useState(true);
//   const [cpfCnpj, setCpfCnpj] = useState("");
//   const [mobilePhone, setMobilePhone] = useState("");

//   useEffect(() => {
//     let mounted = true;

//     async function loadData() {
//       const [plansRes, userRes] = await Promise.all([
//         getPlans(),
//         supabase.auth.getUser(),
//       ]);

//       if (!mounted) return;

//       // Planos
//       if (plansRes.error) {
//         setPlans(fallbackPlans);
//         setPlansWarning(
//           `Usando planos fixos porque a consulta falhou: ${plansRes.error.message}`,
//         );
//       } else if (plansRes.data?.length) {
//         setPlans(plansRes.data as Plan[]);
//         setPlansWarning(null);
//       } else {
//         setPlans(fallbackPlans);
//         setPlansWarning(
//           "Usando planos fixos porque nenhum plano ativo foi encontrado.",
//         );
//       }
//       setLoadingPlans(false);

//       // Barbearia do dono logado
//       const userId = userRes.data.user?.id;
//       if (userId) {
//         const { data: shop } = await supabase
//           .from("barbershops")
//           .select("id, name")
//           .eq("owner_id", userId)
//           .maybeSingle();
//         if (!mounted) return;
//         if (shop) {
//           setBarbershopId(shop.id);
//           setBarbershopName(shop.name);
//         }
//       }
//       setLoadingShop(false);
//     }

//     void loadData();

//     return () => {
//       mounted = false;
//     };
//   }, []);

//   const selectedPlan = useMemo(
//     () => plans.find(plan => plan.asaas_cycle === selectedCycle) ?? plans[0],
//     [plans, selectedCycle],
//   );

//   async function handleCreateSubscription() {
//     if (!selectedPlan || submitting) return;

//     if (!barbershopId) {
//       setError("Nenhuma barbearia encontrada para o usuário logado.");
//       return;
//     }
//     if (!cpfCnpj.trim()) {
//       setError("Informe o CPF ou CNPJ.");
//       return;
//     }
//     if (!isValidCpfCnpj(cpfCnpj)) {
//       setError("CPF ou CNPJ inválido.");
//       return;
//     }

//     setSubmitting(true);
//     setResult(null);
//     setError(null);

//     try {
//       const { data, error: invokeError } = await supabase.functions.invoke(
//         "create-subscription",
//         {
//           body: {
//             barbershop_id: barbershopId,
//             plan_id: selectedPlan.id,
//             billing_type: billingType,
//             cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
//             mobile_phone: mobilePhone.replace(/\D/g, "") || undefined,
//           },
//         },
//       );

//       if (invokeError) {
//         // FunctionsHttpError guarda a Response em .context — extrai o body real.
//         const body = await (invokeError as InvokeErrorWithContext).context
//           ?.json?.()
//           .catch(() => null);
//         setError(
//           body ? JSON.stringify(body, null, 2) : getErrorMessage(invokeError),
//         );
//         return;
//       }
//       setResult(data);
//     } catch (err) {
//       setError(getErrorMessage(err));
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
//       <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
//         <header className="flex flex-col gap-2">
//           <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
//             <Banknote className="size-4" />
//             Teste Asaas
//           </div>
//           <h1 className="text-2xl font-semibold tracking-normal">
//             Criar assinatura de teste
//           </h1>
//           <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
//             Escolha o ciclo do plano Pro e o metodo de pagamento para chamar a
//             Edge Function <code>create-subscription</code>.
//           </p>
//         </header>

//         <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
//           <section className="flex flex-col gap-6">
//             <Card className="rounded-lg">
//               <CardHeader>
//                 <CardTitle className="flex items-center gap-2 text-base">
//                   <CalendarClock className="size-4" />
//                   Ciclo do plano
//                 </CardTitle>
//               </CardHeader>
//               <CardContent className="grid gap-3 sm:grid-cols-3">
//                 {cycleOptions.map(option => {
//                   const plan = plans.find(
//                     item => item.asaas_cycle === option.cycle,
//                   );
//                   const active = selectedCycle === option.cycle;

//                   return (
//                     <button
//                       key={option.cycle}
//                       type="button"
//                       onClick={() => setSelectedCycle(option.cycle)}
//                       className={cn(
//                         "flex min-h-36 flex-col justify-between rounded-lg border bg-white p-4 text-left transition dark:bg-zinc-900",
//                         active
//                           ? "border-blue-600 ring-2 ring-blue-600/20"
//                           : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
//                       )}
//                     >
//                       <span className="flex items-start justify-between gap-3">
//                         <span>
//                           <span className="block text-sm font-semibold">
//                             {option.label}
//                           </span>
//                           <span className="mt-1 block text-xs text-zinc-500">
//                             {option.hint}
//                           </span>
//                         </span>
//                         {active && (
//                           <CheckCircle2 className="size-5 shrink-0 text-blue-600" />
//                         )}
//                       </span>

//                       <span className="mt-4">
//                         <span className="block text-lg font-semibold">
//                           {plan ? formatMoney(plan.price_cents) : "-"}
//                         </span>
//                         <span className="mt-1 block text-xs text-zinc-500">
//                           {plan?.code ?? "Plano nao carregado"}
//                         </span>
//                       </span>
//                     </button>
//                   );
//                 })}
//               </CardContent>
//             </Card>

//             <Card className="rounded-lg">
//               <CardHeader>
//                 <CardTitle className="text-base">Metodo de pagamento</CardTitle>
//               </CardHeader>
//               <CardContent className="grid gap-3 sm:grid-cols-3">
//                 {billingOptions.map(option => {
//                   const Icon = option.icon;
//                   const active = billingType === option.type;

//                   return (
//                     <button
//                       key={option.type}
//                       type="button"
//                       onClick={() => setBillingType(option.type)}
//                       className={cn(
//                         "flex h-24 flex-col items-center justify-center gap-2 rounded-lg border bg-white text-sm font-medium transition dark:bg-zinc-900",
//                         active
//                           ? "border-blue-600 text-blue-600 ring-2 ring-blue-600/20"
//                           : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
//                       )}
//                     >
//                       <Icon className="size-5" />
//                       {option.label}
//                     </button>
//                   );
//                 })}
//               </CardContent>
//             </Card>
//           </section>

//           <aside className="flex flex-col gap-4">
//             <Card className="rounded-lg">
//               <CardHeader>
//                 <CardTitle className="text-base">Dados do assinante</CardTitle>
//               </CardHeader>
//               <CardContent className="flex flex-col gap-4">
//                 <div className="flex flex-col gap-1">
//                   <Label className="text-xs text-zinc-500">Barbearia</Label>
//                   {loadingShop ? (
//                     <p className="text-xs text-zinc-400">Carregando...</p>
//                   ) : barbershopName ? (
//                     <p className="truncate text-sm font-medium">
//                       {barbershopName}
//                     </p>
//                   ) : (
//                     <p className="text-xs text-red-500">
//                       Nenhuma barbearia encontrada
//                     </p>
//                   )}
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <Label htmlFor="cpf-cnpj" className="text-xs">
//                     CPF / CNPJ <span className="text-red-500">*</span>
//                   </Label>
//                   <Input
//                     id="cpf-cnpj"
//                     placeholder="000.000.000-00"
//                     value={cpfCnpj}
//                     onChange={e =>
//                       setCpfCnpj(e.target.value.replace(/\D/g, "").slice(0, 14))
//                     }
//                   />
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <Label htmlFor="mobile-phone" className="text-xs">
//                     Celular (opcional)
//                   </Label>
//                   <Input
//                     id="mobile-phone"
//                     placeholder="(11) 99999-9999"
//                     value={mobilePhone}
//                     onChange={e => setMobilePhone(e.target.value)}
//                   />
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="rounded-lg">
//               <CardHeader>
//                 <CardTitle className="text-base">Resumo</CardTitle>
//               </CardHeader>
//               <CardContent className="flex flex-col gap-4">
//                 <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
//                   <p className="text-sm font-medium">{selectedPlan?.name}</p>
//                   <p className="mt-1 text-xs text-zinc-500">
//                     {selectedPlan?.description}
//                   </p>
//                   <p className="mt-4 text-2xl font-semibold">
//                     {selectedPlan ? formatMoney(selectedPlan.price_cents) : "-"}
//                   </p>
//                 </div>

//                 <dl className="grid gap-2 text-sm">
//                   <div className="flex items-center justify-between gap-4">
//                     <dt className="text-zinc-500">Ciclo</dt>
//                     <dd className="font-medium">{selectedCycle}</dd>
//                   </div>
//                   <div className="flex items-center justify-between gap-4">
//                     <dt className="text-zinc-500">Pagamento</dt>
//                     <dd className="font-medium">{billingType}</dd>
//                   </div>
//                   <div className="flex items-center justify-between gap-4">
//                     <dt className="text-zinc-500">Barbershop ID</dt>
//                     <dd className="max-w-44 truncate font-mono text-xs">
//                       {barbershopId || "-"}
//                     </dd>
//                   </div>
//                   <div className="flex items-center justify-between gap-4">
//                     <dt className="text-zinc-500">Plan ID</dt>
//                     <dd className="max-w-44 truncate font-mono text-xs">
//                       {selectedPlan?.id}
//                     </dd>
//                   </div>
//                 </dl>

//                 <Button
//                   type="button"
//                   size="lg"
//                   onClick={handleCreateSubscription}
//                   disabled={
//                     submitting ||
//                     !selectedPlan ||
//                     !barbershopId ||
//                     !cpfCnpj.trim()
//                   }
//                   className="max-w-none"
//                 >
//                   {submitting && <Loader2 className="size-4 animate-spin" />}
//                   {submitting ? "Criando assinatura..." : "Testar assinatura"}
//                 </Button>

//                 {(loadingPlans || loadingShop) && (
//                   <p className="text-xs text-zinc-500">Carregando...</p>
//                 )}
//                 {plansWarning && (
//                   <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
//                     {plansWarning}
//                   </p>
//                 )}
//               </CardContent>
//             </Card>

//             {(error || result !== null) && (
//               <Card className="rounded-lg">
//                 <CardHeader>
//                   <CardTitle className="text-base">
//                     Resposta da function
//                   </CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   {error ? (
//                     <pre className="max-h-80 overflow-auto rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
//                       {error}
//                     </pre>
//                   ) : (
//                     <pre className="max-h-80 overflow-auto rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
//                       {JSON.stringify(result, null, 2)}
//                     </pre>
//                   )}
//                 </CardContent>
//               </Card>
//             )}
//           </aside>
//         </div>
//       </div>
//     </main>
//   );
// }
