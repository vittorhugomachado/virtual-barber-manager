import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";

/**
 * Lê a sessão da fonte única (AuthProvider).
 * Retorna { session, loading, isLogged }.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de um <AuthProvider>.");
  }
  return context;
}
