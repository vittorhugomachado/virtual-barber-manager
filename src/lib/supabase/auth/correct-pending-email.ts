import { supabase } from "@/lib/supabase/supabase";

export interface CorrectPendingEmailParams {
  userId: string;
  changeToken: string;
  newEmail: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Dados inválidos. Recarregue a página e tente novamente.",
  invalid_token: "Não foi possível validar esta solicitação. Refaça o cadastro.",
  invalid_email: "Email inválido.",
  user_not_found: "Cadastro não encontrado.",
  already_confirmed: "Este email já foi confirmado. Faça login.",
  same_email: "O novo email é igual ao atual.",
  email_already_exists: "Este email já está cadastrado.",
  failed_to_update: "Não foi possível alterar o email. Tente novamente.",
  internal_error: "Erro interno. Tente novamente mais tarde.",
};

/**
 * Corrige o email de um cadastro ainda não confirmado (usuário sem sessão).
 * Autoriza pela posse do signup_change_token gerado no cadastro.
 * Retorna o novo token rotacionado para atualizar o sessionStorage.
 */
export async function correctPendingEmail(
  params: CorrectPendingEmailParams,
): Promise<{ newChangeToken: string }> {
  const { data, error } = await supabase.functions.invoke(
    "correct-pending-email",
    {
      body: {
        userId: params.userId,
        changeToken: params.changeToken,
        newEmail: params.newEmail.trim().toLowerCase(),
      },
    },
  );

  if (error) {
    throw new Error(ERROR_MESSAGES["internal_error"]);
  }

  if (data?.error) {
    throw new Error(
      ERROR_MESSAGES[data.error] ?? ERROR_MESSAGES["internal_error"],
    );
  }

  return { newChangeToken: data.newChangeToken as string };
}
