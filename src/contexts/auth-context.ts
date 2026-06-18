import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";

export type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  isLogged: boolean;
};

// null = usado fora do <AuthProvider> (o hook useAuth detecta e avisa).
export const AuthContext = createContext<AuthContextValue | null>(null);
