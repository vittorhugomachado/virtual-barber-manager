import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";
import { AuthContext } from "@/contexts/auth-context";

/**
 * Fonte única de verdade da sessão. Mantém UMA assinatura de
 * onAuthStateChange para toda a árvore — em vez de cada componente que chama
 * useAuth abrir a sua. Deve ficar no topo da aplicação.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    async function setupAuth() {
      const supabase = await getSupabaseClient();
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      setSession(data.session);
      setLoading(false);

      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!active) return;
          setSession(nextSession);
        },
      );

      unsubscribe = () => listener.subscription.unsubscribe();
    }

    void setupAuth();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // useMemo mantém a referência estável: só muda quando session/loading mudam,
  // evitando re-render desnecessário em todos os consumidores.
  const value = useMemo(
    () => ({ session, loading, isLogged: !!session }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
