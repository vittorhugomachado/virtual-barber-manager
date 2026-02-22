import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
}

export function ProtectedRoute({ children, skeleton }: ProtectedRouteProps) {
  const { isLogged, loading } = useAuth();

  if (loading)
    return skeleton ? (
      <>{skeleton}</>
    ) : (
      <div className="w-screen h-screen flex justify-center items-center">
        <Spinner className="size-10" />
      </div>
    );

  if (!isLogged) return <Navigate to="/entrar" />;

  return children;
}
