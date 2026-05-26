// import { Navigate, Outlet, useLocation } from "react-router";
// import { useAuth } from "@/hooks/use-auth";
// import { Spinner } from "@/components/ui/spinner";
// import { useBarbershopData } from "@/hooks/use-barber-shop-data";
// import { useBarbershopStore } from "@/store/barbershop.store";
// import { SidebarComponent } from "@/components/common/sidebar";
// import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
//
// interface ProtectedRouteProps {
//   children?: React.ReactNode;
//   skeleton?: React.ReactNode;
//   withSidebar?: boolean;
// }
//
// export function ProtectedRoute({
//   children,
//   skeleton,
//   withSidebar = false,
// }: ProtectedRouteProps) {
//   const { isLogged, loading: authLoading } = useAuth();
//   const { barbershop, loading: barbershopLoading } = useBarbershopData();
//   const { memberRole } = useBarbershopStore();
//   const { pathname } = useLocation();
//
//   if (authLoading || barbershopLoading)
//     return skeleton ? (
//       <>{skeleton}</>
//     ) : (
//       <div className="w-screen h-screen flex justify-center items-center">
//         <Spinner className="size-10" />
//       </div>
//     );
//
//   if (!isLogged || !barbershop) return <Navigate to="/entrar" />;
//
//   if (memberRole === "reader" && pathname !== "/agenda")
//     return <Navigate to="/agenda" replace />;
//
//   if (pathname === "/configuracoes" && memberRole !== "owner")
//     return <Navigate to="/" replace />;
//
//   if (withSidebar) {
//     return (
//       <SidebarProvider>
//         <SidebarComponent />
//         <SidebarInset className="min-w-0 overflow-x-hidden">
//           <Outlet />
//         </SidebarInset>
//       </SidebarProvider>
//     );
//   }
//
//   return children;
// }
