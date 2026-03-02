import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";
import { useBarbershopData } from "@/hooks/use-barber-shop-data";

interface ProtectedRouteProps {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
}

export function ProtectedRoute({ children, skeleton }: ProtectedRouteProps) {
  const { isLogged, loading } = useAuth();
  useBarbershopData();

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
