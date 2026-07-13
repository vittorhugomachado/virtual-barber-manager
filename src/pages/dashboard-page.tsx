import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase/supabase";
import { useCredential } from "@/store/user-credential.store";
import {
  createMember,
  type CreatedMember,
  type MemberRole,
} from "@/lib/supabase/members/create-member";

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "reader";
  username: string;
};

import { BarbershopDashboardMain } from "@/components/main/dashboard-main";
import { HeaderPage } from "@/components/common/header-page";

export function DashboardPage() {
  return (
    <>
      <HeaderPage page="Visão geral" />
      <BarbershopDashboardMain />
    </>
  );
}

/**
 * Pagina provisoria de diagnostico: exibe apenas a credencial atual do
 * usuário logado para validar o fluxo do store. Substituir pela dashboard
 * real quando as credenciais estiverem resolvendo corretamente.
 */
export function DashboardPageDev() {
  const credential = useCredential();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Teste provisório: criação de membro via Edge Function ---
  const [memberUsername, setMemberUsername] = useState("joao-silva");
  const [memberPassword, setMemberPassword] = useState("senha12345");
  const [memberRole, setMemberRole] = useState<MemberRole>("reader");
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreatedMember | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // --- Lista de membros ---
  const [members, setMembers] = useState<Member[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

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

  async function handleCreateMember() {
    if (isCreating || !credential.barbershopId) return;
    setIsCreating(true);
    setCreateResult(null);
    setCreateError(null);
    try {
      const member = await createMember({
        name: memberUsername,
        password: memberPassword,
        role: memberRole,
        barbershopId: credential.barbershopId,
      });
      setCreateResult(member);

      console.log("Membro criado com sucesso:", member);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro desconhecido");
      console.log("Membro criado com sucesso:", err);
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    if (!credential.barbershopId) return;
    let mounted = true;
    setMembers(null);
    setMembersError(null);

    supabase
      .from("barbershop_members")
      .select("id, user_id, role, username")
      .eq("barbershop_id", credential.barbershopId)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setMembersError(error.message);
          setMembers([]);
        } else {
          setMembers((data as Member[]) ?? []);
        }
      });

    return () => {
      mounted = false;
    };
  }, [credential.barbershopId, createResult]);

  async function handleDeleteMember(member: Member) {
    if (!credential.barbershopId || removingId) return;
    setRemovingId(member.id);
    const { error } = await supabase.rpc("delete_member", {
      p_member_id: member.id,
      p_barbershop_id: credential.barbershopId,
    });
    if (error) {
      alert(`Erro ao deletar: ${error.message}`);
    } else {
      setMembers(prev => (prev ?? []).filter(m => m.id !== member.id));
    }
    setRemovingId(null);
    setConfirmRemove(null);
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

        {/* --- Teste provisório: criar membro --- */}
        <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-semibold mb-3">
            Testar criação de membro (Edge Function)
          </h2>

          {credential.accessLevel !== "owner" ? (
            <p className="text-sm text-zinc-500">
              Só o owner pode criar membros. (accessLevel atual:{" "}
              {credential.accessLevel ?? "null"})
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={memberUsername}
                onChange={e =>
                  setMemberUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""),
                  )
                }
                placeholder="Username (ex: joao-silva)"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              />
              <input
                value={memberPassword}
                onChange={e => setMemberPassword(e.target.value)}
                placeholder="Senha (8-72)"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              />
              <select
                value={memberRole}
                onChange={e => setMemberRole(e.target.value as MemberRole)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="reader">reader</option>
                <option value="admin">admin</option>
              </select>

              <button
                type="button"
                onClick={handleCreateMember}
                disabled={isCreating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {isCreating ? "Criando..." : "Criar membro"}
              </button>

              {createError && (
                <p className="text-sm text-red-500 break-all">
                  ❌ {createError}
                </p>
              )}
              {createResult && (
                <pre className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-xs overflow-auto">
                  ✅ {JSON.stringify(createResult, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* --- Lista de membros + exclusão --- */}
        <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-semibold mb-3">Membros da barbearia</h2>

          {members === null && !membersError && (
            <p className="text-sm text-zinc-500">Carregando...</p>
          )}

          {membersError && (
            <p className="text-sm text-red-500">Erro: {membersError}</p>
          )}

          {members !== null && members.length === 0 && (
            <p className="text-sm text-zinc-500">Nenhum membro ainda.</p>
          )}

          {members !== null && members.length > 0 && (
            <ul className="flex flex-col gap-2">
              {members.map(member => (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-md border border-zinc-100 dark:border-zinc-800 px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      @{member.username}
                    </span>
                    <span className="text-xs text-zinc-500">{member.role}</span>
                  </div>

                  {confirmRemove?.id === member.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Confirmar?</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member)}
                        disabled={removingId === member.id}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {removingId === member.id ? "Removendo..." : "Sim"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(null)}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(member)}
                      disabled={!!removingId}
                      className="rounded-md border border-red-300 dark:border-red-800 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60"
                    >
                      Deletar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

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
