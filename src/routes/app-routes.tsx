import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import { PublicRoute } from "./public-route";
// import { ProtectedRoute } from "./protected-route";
// import { DashboardSkeleton } from "@/components/skeleton/dashboard-skeleton";
// import { SettingsSkeleton } from "@/components/skeleton/settings-skeleton";
// import { ManageTeamSkeleton } from "@/components/skeleton/manage-team-skeleton";
// import { ServicesSkeleton } from "@/components/skeleton/services-skeleton";
// import { CustomersSkeleton } from "@/components/skeleton/customers-skeleton";
import { Spinner } from "@/components/ui/spinner";
// import { ReportsSkeleton } from "@/components/skeleton/reports-skeleton";

// const DashboardPage = lazy(() =>
//   import("@/pages/dashboard-page").then(module => ({
//     default: module.DashboardPage,
//   })),
// );
const SignupPage = lazy(() =>
  import("@/pages/signup-page").then(module => ({
    default: module.SignupPage,
  })),
);
const ConfirmSignupPage = lazy(() =>
  import("@/pages/confirm-signup").then(module => ({
    default: module.ConfirmSignupPage,
  })),
);
// const EmailChangeConfirmedPage = lazy(() =>
//   import("@/pages/confirmation-email-page").then(module => ({
//     default: module.EmailChangeConfirmedPage,
//   })),
// );
const LoginPage = lazy(() =>
  import("@/pages/login-page").then(module => ({
    default: module.LoginPage,
  })),
);
const SignupPendingPage = lazy(() =>
  import("@/pages/signup-pending-page").then(module => ({
    default: module.SignupPendingPage,
  })),
);
// const ForgotPasswordPage = lazy(() =>
//   import("@/pages/forgot-password-page").then(module => ({
//     default: module.ForgotPasswordPage,
//   })),
// );
// const ResetPasswordPage = lazy(() =>
//   import("@/pages/reset-password-page").then(module => ({
//     default: module.ResetPasswordPage,
//   })),
// );
// const SettingPage = lazy(() =>
//   import("@/pages/settings-page").then(module => ({
//     default: module.SettingPage,
//   })),
// );
// const ManageServicePage = lazy(() =>
//   import("@/pages/manage-service-page").then(module => ({
//     default: module.ManageServicePage,
//   })),
// );
// const ManageStoreStylePage = lazy(() =>
//   import("@/pages/manage-store-style-page").then(module => ({
//     default: module.ManageStoreStylePage,
//   })),
// );
// const ManageTeamPage = lazy(() =>
//   import("@/pages/manage-team-page").then(module => ({
//     default: module.ManageTeamPage,
//   })),
// );
// const ReportsPage = lazy(() =>
//   import("@/pages/reports-page").then(module => ({
//     default: module.ReportsPage,
//   })),
// );
// const AppointmentsPage = lazy(() =>
//   import("@/pages/appointments-page").then(module => ({
//     default: module.AppointmentsPage,
//   })),
// );
// const CustomersPage = lazy(() =>
//   import("@/pages/customers-page").then(module => ({
//     default: module.CustomersPage,
//   })),
// );

// const skeletons: Record<string, React.ReactNode> = {
//   "/": <DashboardSkeleton />,
//   "/agenda": <DashboardSkeleton />,
//   "/clientes": <CustomersSkeleton />,
//   "/equipe": <ManageTeamSkeleton />,
//   "/servicos": <ServicesSkeleton />,
//   "/editar-pagina": <SettingsSkeleton />,
//   "/relatorios": <DashboardSkeleton />,
//   "/configuracoes": <SettingsSkeleton />,
// };

// function ProtectedRouteWithSkeleton({
//   children,
// }: {
//   children?: React.ReactNode;
// }) {
//   const { pathname } = useLocation();
//   const skeleton = skeletons[pathname] ?? <DashboardSkeleton />;

//   return (
//     <ProtectedRoute withSidebar skeleton={skeleton}>
//       {children}
//     </ProtectedRoute>
//   );
//}

// function ProtectedPageLoader({
//   fallback,
//   children,
// }: {
//   fallback: React.ReactNode;
//   children: React.ReactNode;
// }) {
//   return <Suspense fallback={fallback}>{children}</Suspense>;
// }

function PublicPageLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center">
          <Spinner className="size-10" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route
        path="/entrar"
        element={
          <PublicRoute>
            <PublicPageLoader>
              <LoginPage />
            </PublicPageLoader>
          </PublicRoute>
        }
      />
      <Route
        path="/confirmar-email"
        element={
          <PublicPageLoader>
            <ConfirmSignupPage />
          </PublicPageLoader>
        }
      />
      <Route
        path="/cadastro"
        element={
          <PublicRoute>
            <PublicPageLoader>
              <SignupPage />
            </PublicPageLoader>
          </PublicRoute>
        }
      />
      {/* Rota usada no login em email ainda não confirmado */}
      <Route
        path="/cadastro-pendente/:email"
        element={
          <PublicRoute>
            <PublicPageLoader>
              <SignupPendingPage />
            </PublicPageLoader>
          </PublicRoute>
        }
      />
      {/* Rotas de recuperação e atualização de senha */}
      {/* <Route
        path="/esqueci-minha-senha"
        element={
          <PublicRoute>
            <PublicPageLoader>
              <ForgotPasswordPage />
            </PublicPageLoader>
          </PublicRoute>
        }
      /> */}
      {/* <Route
        path="/criar-nova-senha"
        element={
          <PublicPageLoader>
            <ResetPasswordPage />
          </PublicPageLoader>
        }
      /> */}
      {/* Rota de sucesso de cadastro (pública, sem sidebar) */}
      {/* <Route
        path="/auth/email-change-confirmed"
        element={
          <PublicPageLoader>
            <EmailChangeConfirmedPage />
          </PublicPageLoader>
        }
      /> */}
      {/* Rotas protegidas com sidebar */}
      {/* <Route element={<ProtectedRouteWithSkeleton />}>
        <Route
          path="/"
          element={
            <ProtectedPageLoader fallback={<DashboardSkeleton />}>
              <DashboardPage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/agenda"
          element={
            <ProtectedPageLoader fallback={<DashboardSkeleton />}>
              <AppointmentsPage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedPageLoader fallback={<CustomersSkeleton />}>
              <CustomersPage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/equipe"
          element={
            <ProtectedPageLoader fallback={<ManageTeamSkeleton />}>
              <ManageTeamPage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/servicos"
          element={
            <ProtectedPageLoader fallback={<ServicesSkeleton />}>
              <ManageServicePage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/editar-pagina"
          element={
            <ProtectedPageLoader fallback={<SettingsSkeleton />}>
              {/* <ManageStoreStylePage />
              <ManageStoreStylePage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/relatorios"
          element={
            <ProtectedPageLoader fallback={<ReportsSkeleton />}>
              <ReportsPage />
            </ProtectedPageLoader>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <ProtectedPageLoader fallback={<SettingsSkeleton />}>
              <SettingPage />
            </ProtectedPageLoader>
          }
        />
      </Route> */}
    </Routes>
  );
}
