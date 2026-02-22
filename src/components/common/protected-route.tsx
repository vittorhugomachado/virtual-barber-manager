import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLogged, loading } = useAuth();

  if (loading)
    return (
      <div className="w-screen h-scren flex justify-center items-center gap-6">
        <Spinner className="size-10" />
      </div>
    );
  if (!isLogged) return <Navigate to="/entrar" />;

  return children;
}
