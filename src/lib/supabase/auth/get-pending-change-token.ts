import { supabase } from "@/lib/supabase/supabase";

export interface GetPendingChangeTokenParams {
  email: string;
  password: string;
  captchaToken?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Dados inválidos. Recarregue a página e tente novamente.",
  already_confirmed: "Este email já foi confirmado. Faça login.",
  invalid_credentials: "Senha incorreta.",
  user_not_found: "Usuário não encontrado.",
  no_token_available:
    "Não é possível corrigir o email para esta conta. Refaça o cadastro.",
  internal_error: "Erro interno. Tente novamente mais tarde.",
};

export class AlreadyConfirmedError extends Error {
  constructor() {
    super(ERROR_MESSAGES["already_confirmed"]);
    this.name = "AlreadyConfirmedError";
  }
}

/**
 * Obtém o userId e changeToken de uma conta pendente (não confirmada),
 * verificando a identidade do usuário via senha + captcha.
 * Permite que o fluxo de login acesse a correção de email,
 * sem comprometer o rate limit ou o captcha do GoTrue.
 */
export async function getPendingChangeToken(
  params: GetPendingChangeTokenParams,
): Promise<{ userId: string; changeToken: string }> {
  const { data, error } = await supabase.functions.invoke(
    "get-pending-change-token",
    {
      body: {
        email: params.email.trim().toLowerCase(),
        password: params.password,
        captchaToken: params.captchaToken,
      },
    },
  );

  if (error) throw new Error(ERROR_MESSAGES["internal_error"]);

  if (data?.error) {
    if (data.error === "already_confirmed") throw new AlreadyConfirmedError();
    throw new Error(
      ERROR_MESSAGES[data.error as string] ?? ERROR_MESSAGES["internal_error"],
    );
  }

  return {
    userId: data.userId as string,
    changeToken: data.changeToken as string,
  };
}
