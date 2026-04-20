import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router";
import { PublicRoute } from "./public-route";
import { ProtectedRoute } from "./protected-route";
import { DashboardSkeleton } from "@/components/skeleton/dashboard-skeleton";
import { SettingsSkeleton } from "@/components/skeleton/settings-skeleton";
import { ManageTeamSkeleton } from "@/components/skeleton/manage-team-skeleton";
import { ServicesSkeleton } from "@/components/skeleton/services-skeleton";
import { CustomersSkeleton } from "@/components/skeleton/customers-skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ReportsSkeleton } from "@/components/skeleton/reports-skeleton";

const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then(module => ({
    default: module.DashboardPage,
  })),
);
const SignupPage = lazy(() =>
  import("@/pages/signup-page").then(module => ({
    default: module.SignupPage,
  })),
);
const ConfirmationEmailPage = lazy(() =>
  import("@/pages/confirmation-email-page").then(module => ({
    default: module.ConfirmationEmailPage,
  })),
);
const EmailConfirmedPage = lazy(() =>
  import("@/pages/email-confirmed-page").then(module => ({
    default: module.EmailConfirmedPage,
  })),
);
const LoginPage = lazy(() =>
  import("@/pages/login-page").then(module => ({
    default: module.LoginPage,
  })),
);
const SettingPage = lazy(() =>
  import("@/pages/settings-page").then(module => ({
    default: module.SettingPage,
  })),
);
const ManageServicePage = lazy(() =>
  import("@/pages/manage-service-page").then(module => ({
    default: module.ManageServicePage,
  })),
);
const ManageTeamPage = lazy(() =>
  import("@/pages/manage-team-page").then(module => ({
    default: module.ManageTeamPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/pages/reports-page").then(module => ({
    default: module.ReportsPage,
  })),
);
const AppointmentsPage = lazy(() =>
  import("@/pages/appointments-page").then(module => ({
    default: module.AppointmentsPage,
  })),
);
const CustomersPage = lazy(() =>
  import("@/pages/customers-page").then(module => ({
    default: module.CustomersPage,
  })),
);

const skeletons: Record<string, React.ReactNode> = {
  "/": <DashboardSkeleton />,
  "/agenda": <DashboardSkeleton />,
  "/clientes": <CustomersSkeleton />,
  "/equipe": <ManageTeamSkeleton />,
  "/servicos": <ServicesSkeleton />,
  "/relatorios": <DashboardSkeleton />,
  "/configuracoes": <SettingsSkeleton />,
};

function ProtectedRouteWithSkeleton({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const skeleton = skeletons[pathname] ?? <DashboardSkeleton />;

  return (
    <ProtectedRoute withSidebar skeleton={skeleton}>
      {children}
    </ProtectedRoute>
  );
}

function ProtectedPageLoader({
  fallback,
  children,
}: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

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
        path="/cadastro"
        element={
          <PublicRoute>
            <PublicPageLoader>
              <SignupPage />
            </PublicPageLoader>
          </PublicRoute>
        }
      />

      {/* Rota de sucesso de cadastro (pública, sem sidebar) */}
      <Route
        path="/confirmacao-email"
        element={
          <PublicRoute>
            <PublicPageLoader>
              <ConfirmationEmailPage />
            </PublicPageLoader>
          </PublicRoute>
        }
      />
      <Route
        path="/email-confirmado"
        element={
          <PublicPageLoader>
            <EmailConfirmedPage />
          </PublicPageLoader>
        }
      />

      {/* Rotas protegidas com sidebar */}
      <Route element={<ProtectedRouteWithSkeleton />}>
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
      </Route>
    </Routes>
  );
}
