import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";

export type MemberRole = "admin" | "reader";

export type Member = {
  id: string;
  user_id: string;
  role: MemberRole;
  username: string;
};

export type CreateMemberInput = {
  barbershopId: string;
  username: string;
  password: string;
  role: MemberRole;
};

export type UpdateMemberInput = {
  memberId: string;
  username?: string;
  password?: string;
  role?: MemberRole;
};

const MEMBER_ERROR_MESSAGES: Record<string, string> = {
  missing_authorization: "Sessão inválida. Entre novamente.",
  invalid_token: "Sessão expirada. Entre novamente.",
  invalid_name: "Nome de usuário inválido.",
  invalid_username: "Nome de usuário inválido.",
  invalid_role: "Perfil de acesso inválido.",
  invalid_password: "A senha deve ter entre 8 e 72 caracteres.",
  invalid_barbershop_id: "Barbearia não encontrada.",
  not_barbershop_owner: "Apenas o proprietário pode gerenciar usuários.",
  name_already_exists: "Já existe um usuário com esse nome nesta barbearia.",
  username_already_exists:
    "Já existe um usuário com esse nome nesta barbearia.",
  member_limit_reached: "O limite de usuários do plano foi atingido.",
  subscription_inactive:
    "A assinatura está inativa. Regularize o pagamento para adicionar usuários.",
  failed_to_create_auth_user: "Não foi possível criar o usuário.",
  failed_to_create_member: "Não foi possível criar o usuário.",
  invalid_member_id: "Usuário inválido.",
  member_not_found: "Usuário não encontrado.",
  no_changes: "Nenhuma alteração foi enviada.",
  failed_to_update_auth_user: "Não foi possível atualizar o usuário.",
  failed_to_delete_member: "Não foi possível remover o usuário.",
  update_inconsistent:
    "A atualização não foi concluída. Contate o suporte antes de tentar novamente.",
  server_misconfigured: "Serviço temporariamente indisponível.",
  internal_error: "Erro interno. Tente novamente mais tarde.",
};

function getMemberErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "string") return fallback;
  return MEMBER_ERROR_MESSAGES[error] ?? error;
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (session?.access_token) return session.access_token;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !data.session?.access_token) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  return data.session.access_token;
}

async function invokeMemberFunction(
  functionName: "create-member" | "update-member" | "delete-member",
  body: Record<string, unknown>,
) {
  const accessToken = await getAccessToken();
  const response = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.error) {
    let message = response.error.message;
    try {
      const errorBody = await response.error.context.json();
      message = getMemberErrorMessage(errorBody?.error, message);
    } catch {
      // A resposta pode não conter JSON.
    }
    throw new Error(message || "Não foi possível concluir a operação.");
  }

  if (response.data?.error) {
    throw new Error(
      getMemberErrorMessage(
        response.data.error,
        "Não foi possível concluir a operação.",
      ),
    );
  }
  return response.data;
}

export function useMembers(barbershopId: string | undefined) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken(value => value + 1), []);
  const removeLocal = useCallback((memberId: string) => {
    setMembers(current =>
      current ? current.filter(member => member.id !== memberId) : current,
    );
  }, []);

  useEffect(() => {
    if (!barbershopId) return;
    let active = true;

    async function loadMembers() {
      setError(null);
      const { data, error: queryError } = await supabase.rpc(
        "get_barbershop_members",
        {
          p_barbershop_id: barbershopId,
        },
      );
      if (!active) return;

      if (queryError) {
        setMembers([]);
        setError("Não foi possível carregar os usuários.");
        return;
      }

      setMembers(data ? (data as Member[]) : []);
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [barbershopId, reloadToken]);

  return { members: barbershopId ? members : [], error, reload, removeLocal };
}

export function useCreateMember() {
  const createMember = useCallback((input: CreateMemberInput) => {
    return invokeMemberFunction("create-member", {
      username: input.username.trim(),
      // Compatibilidade temporária com a versão antiga já implantada.
      name: input.username.trim(),
      password: input.password,
      role: input.role,
      barbershop_id: input.barbershopId,
    });
  }, []);

  return { createMember };
}

export function useUpdateMember() {
  const updateMember = useCallback((input: UpdateMemberInput) => {
    return invokeMemberFunction("update-member", {
      member_id: input.memberId,
      ...(input.username ? { username: input.username } : {}),
      ...(input.password ? { password: input.password } : {}),
      ...(input.role ? { role: input.role } : {}),
    });
  }, []);

  return { updateMember };
}

export function useDeleteMember() {
  const deleteMember = useCallback((memberId: string) => {
    return invokeMemberFunction("delete-member", { member_id: memberId });
  }, []);

  return { deleteMember };
}
