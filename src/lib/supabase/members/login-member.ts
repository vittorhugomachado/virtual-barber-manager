import { supabase } from "@/lib/supabase/supabase";

export interface LoginMemberParams {
  username: string;
  password: string;
  slug: string;
}

export async function loginMember({
  username,
  password,
  slug,
}: LoginMemberParams) {
  // 1. Traduz username + slug → email sintético via RPC (seguro: SECURITY DEFINER)
  const { data: email, error: rpcError } = await supabase.rpc(
    "get_member_auth_email",
    {
      p_username: username.toLowerCase().trim(),
      p_slug: slug,
    },
  );

  if (rpcError || !email) {
    throw new Error("Usuário ou senha inválidos.");
  }

  // 2. Login com email sintético + senha
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !data.user) {
    throw new Error("Usuário ou senha inválidos.");
  }

  return data;
}
