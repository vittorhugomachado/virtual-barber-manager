import { supabase } from "@/lib/supabase/supabase";

export type MemberRole = "admin" | "reader";

export interface CreateMemberParams {
  name: string;
  password: string;
  role: MemberRole;
  barbershopId: string;
}

export interface CreatedMember {
  id: string;
  username: string;
  role: MemberRole;
  created_at: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_authorization: "Sessão inválida. Faça login novamente.",
  invalid_token: "Sessão expirada. Faça login novamente.",
  invalid_name: "Nome inválido. Use entre 2 e 50 caracteres.",
  invalid_role: "Função inválida.",
  invalid_password: "A senha deve ter entre 8 e 72 caracteres.",
  invalid_barbershop_id: "Barbearia não encontrada.",
  not_barbershop_owner: "Apenas o proprietário pode adicionar membros.",
  name_already_exists:
    "Já existe um membro com este nome nesta barbearia.",
  member_limit_reached: "Limite de membros do plano atingido.",
  failed_to_create_auth_user: "Erro ao criar usuário. Tente novamente.",
  failed_to_create_member: "Erro ao criar membro. Tente novamente.",
  internal_error: "Erro interno. Tente novamente mais tarde.",
};

export async function createMember(
  params: CreateMemberParams,
): Promise<CreatedMember> {
  const { data, error } = await supabase.functions.invoke("create-member", {
    body: {
      name: params.name.trim(),
      password: params.password,
      role: params.role,
      barbershop_id: params.barbershopId,
    },
  });

  if (error) {
    throw new Error(ERROR_MESSAGES["internal_error"]);
  }

  if (data?.error) {
    const message =
      ERROR_MESSAGES[data.error] ?? ERROR_MESSAGES["internal_error"];
    throw new Error(message);
  }

  return data.member as CreatedMember;
}
