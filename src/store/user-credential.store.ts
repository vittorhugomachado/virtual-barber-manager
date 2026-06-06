import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/supabase";

/**
 * Fonte unica da credencial do usuario logado para decisao de UI.
 *
 * Seguranca:
 * - A RLS continua sendo a autoridade real de acesso. Os flags abaixo
 *   decidem apenas QUE chrome de UI renderizar, nunca QUAL dado entregar.
 * - O cache persistido serve somente para renderizar a UI mais rapido.
 * - Nao persistimos token de sessao, nem dados da barbearia (telefone,
 *   email, clientes, agenda) ou o objeto `barbershop` completo.
 * - `memberUsername` (parte local do email do proprio usuario logado) e
 *   persistido por conveniencia de UI; e PII do proprio usuario no
 *   sessionStorage dele, nao um segredo.
 */

export type ProfileRole = "barbershop" | "barbershop_member" | "master";
export type AccessLevel = "owner" | "admin" | "reader";
export type UserCredentialStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated";

export type Barbershop = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type UserCredential = {
  status: UserCredentialStatus;
  userId: string | null;
  email: string | null;
  role: ProfileRole | null;
  accessLevel: AccessLevel | null;
  barbershopId: string | null;
  barbershopName: string | null;
  barbershopSlug: string | null;
  memberUsername: string | null;
  /**
   * Objeto completo em memoria para telas que precisem dele.
   * Este campo nao e persistido para evitar salvar PII no storage.
   */
  barbershop: Barbershop | null;
};

type PersistedUserCredential = Pick<
  UserCredential,
  | "status"
  | "userId"
  | "role"
  | "accessLevel"
  | "barbershopId"
  | "barbershopName"
  | "barbershopSlug"
  | "memberUsername"
>;

const INITIAL: UserCredential = {
  status: "loading",
  userId: null,
  email: null,
  role: null,
  accessLevel: null,
  barbershopId: null,
  barbershopName: null,
  barbershopSlug: null,
  memberUsername: null,
  barbershop: null,
};

const EMPTY_PERSISTED: PersistedUserCredential = {
  status: "unauthenticated",
  userId: null,
  role: null,
  accessLevel: null,
  barbershopId: null,
  barbershopName: null,
  barbershopSlug: null,
  memberUsername: null,
};

export const useUserCredential = create<UserCredential>()(
  persist(() => ({ ...INITIAL }), {
    name: "virtual-barber-user-credential",
    storage: createJSONStorage(() => sessionStorage),
    partialize: state =>
      state.status === "authenticated"
        ? {
            status: state.status,
            userId: state.userId,
            role: state.role,
            accessLevel: state.accessLevel,
            barbershopId: state.barbershopId,
            barbershopName: state.barbershopName,
            barbershopSlug: state.barbershopSlug,
            memberUsername: state.memberUsername,
          }
        : { ...EMPTY_PERSISTED },
    merge: persistedState => ({
      ...INITIAL,
      ...(persistedState as PersistedUserCredential),
      barbershop: null,
    }),
  }),
);

let resolvedForUserId: string | null | undefined = undefined;

function hasUsableCachedUserCredential(state: UserCredential, userId: string) {
  return (
    state.status === "authenticated" &&
    state.userId === userId &&
    state.role !== null &&
    state.accessLevel !== null &&
    state.barbershopId !== null
  );
}

function getMemberUsername(email: string | null) {
  const [username] = email?.split("@") ?? [];
  return username || null;
}

async function resolveUserCredential(userId: string, email: string | null) {
  const [profileRes, ownerBarbershopRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("barbershops")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle(),
  ]);

  if (useUserCredential.getState().userId !== userId) return;

  const role = (profileRes.data?.role as ProfileRole | undefined) ?? null;
  const ownerBarbershop =
    (ownerBarbershopRes.data as Barbershop | null) ?? null;

  if (ownerBarbershop) {
    useUserCredential.setState({
      status: "authenticated",
      userId,
      email,
      role,
      accessLevel: "owner",
      barbershopId: ownerBarbershop.id,
      barbershopName: ownerBarbershop.name,
      barbershopSlug: ownerBarbershop.slug,
      memberUsername: null,
      barbershop: ownerBarbershop,
    });
    return;
  }

  const { data: memberRows } = await supabase
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("user_id", userId)
    .limit(1);

  if (useUserCredential.getState().userId !== userId) return;

  const member = memberRows?.[0] as
    | { barbershop_id: string; role: "admin" | "reader" }
    | undefined;

  if (!member) {
    useUserCredential.setState({
      ...INITIAL,
      status: "authenticated",
      userId,
      email,
      role,
    });
    return;
  }

  const { data: memberBarbershop } = await supabase
    .from("barbershops")
    .select("*")
    .eq("id", member.barbershop_id)
    .maybeSingle();

  if (useUserCredential.getState().userId !== userId) return;

  const barbershop = (memberBarbershop as Barbershop | null) ?? null;

  useUserCredential.setState({
    status: "authenticated",
    userId,
    email,
    role,
    accessLevel: member.role,
    barbershopId: member.barbershop_id,
    barbershopName: barbershop?.name ?? null,
    barbershopSlug: barbershop?.slug ?? null,
    memberUsername: getMemberUsername(email),
    barbershop,
  });
}

function handleSession(session: Session | null) {
  if (!session?.user) {
    resolvedForUserId = null;
    useUserCredential.setState({ ...INITIAL, status: "unauthenticated" });
    return;
  }

  const userId = session.user.id;
  const email = session.user.email ?? null;
  const current = useUserCredential.getState();

  if (hasUsableCachedUserCredential(current, userId)) {
    resolvedForUserId = userId;
    useUserCredential.setState({ email });
    return;
  }

  useUserCredential.setState({
    ...INITIAL,
    status: "loading",
    userId,
    email,
  });

  if (resolvedForUserId === userId) return;
  resolvedForUserId = userId;

  setTimeout(() => {
    void resolveUserCredential(userId, email);
  }, 0);
}

const {
  data: { subscription: authSubscription },
} = supabase.auth.onAuthStateChange((_event, session) => {
  handleSession(session);
});

void supabase.auth.getSession().then(({ data }) => {
  if (resolvedForUserId === undefined) handleSession(data.session);
});

// Em dev, o HMR recarrega este modulo sem descartar o anterior; sem isso
// os listeners de auth se acumulam. Em producao o bloco e ignorado.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    authSubscription.unsubscribe();
  });
}

export const getUserCredential = (): UserCredential =>
  useUserCredential.getState();

export type CredentialStatus = UserCredentialStatus;
export type Credential = UserCredential;
export const useCredential = useUserCredential;
export const getCredential = getUserCredential;

if (import.meta.env.DEV) {
  useUserCredential.subscribe(state => state);
}
