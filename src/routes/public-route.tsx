import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLogged, loading } = useAuth();

  if (loading)
    return (
      <div className="max-w-screen min-h-scren flex justify-center items-center gap-6">
        <Spinner className="size-10" />
      </div>
    );
  if (isLogged) return <Navigate to="/" />;

  return children;
}
