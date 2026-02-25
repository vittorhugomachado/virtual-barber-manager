import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router";

export function useLogout() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  async function logout() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await supabase.auth.signOut();
      navigate("/entrar");
    } finally {
      setIsLoading(false);
    }
  }

  return { logout, isLoading };
}
