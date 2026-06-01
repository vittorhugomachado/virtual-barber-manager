import { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase/supabase";
import { useCredential } from "@/store/user-credential.store";

// import { BarbershopDashboardMain } from "@/components/main/dashboard-main";
// import { HeaderPage } from "@/components/common/header-page";
//
// export function DashboardPage() {
//   return (
//     <>
//       <HeaderPage page="Visão geral" />
//       <BarbershopDashboardMain />
//     </>
//   );
// }

/**
 * Pagina provisoria de diagnostico: exibe apenas a credencial atual do
 * usuario logado para validar o fluxo do store. Substituir pela dashboard
 * real quando as credenciais estiverem resolvendo corretamente.
 */
export function DashboardPage() {
  const credential = useCredential();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // onAuthStateChange no store reseta a credencial para "unauthenticated".
      await supabase.auth.signOut();
      navigate("/entrar");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const rows: { label: string; value: string | null }[] = [
    { label: "status", value: credential.status },
    { label: "userId", value: credential.userId },
    { label: "email", value: credential.email },
    { label: "role", value: credential.role },
    { label: "accessLevel", value: credential.accessLevel },
    { label: "barbershopId", value: credential.barbershopId },
    { label: "barbershopName", value: credential.barbershopName },
    { label: "barbershopSlug", value: credential.barbershopSlug },
    { label: "memberUsername", value: credential.memberUsername },
  ];

  return (
    <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Credencial do usuário</h1>
        <p className="text-sm text-zinc-500 mb-4">
          Painel de diagnóstico do <code>user-credential.store</code>.
        </p>

        <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map(row => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-2"
            >
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {row.label}
              </dt>
              <dd className="text-sm font-mono text-right break-all">
                {row.value ?? (
                  <span className="text-zinc-400 italic">null</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-zinc-500">
            barbershop (objeto completo em memória)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-50 dark:bg-zinc-950 p-3 text-xs">
            {JSON.stringify(credential.barbershop, null, 2)}
          </pre>
        </details>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-6 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Saindo..." : "Sair (logout)"}
        </button>
      </div>
    </main>
  );
}
