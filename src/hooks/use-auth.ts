import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/lazy-supabase";

export function useAuth() {
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
        (_event, session) => {
          if (!active) return;
          setSession(session);
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

  return { session, loading, isLogged: !!session };
}
