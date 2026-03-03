import { Routes, Route } from "react-router";
import { PublicRoute } from "./public-route";
import { ProtectedRoute } from "./protected-route";
import { DashboardPage } from "@/pages/dashboard-page";
import { SignupPage } from "@/pages/signup-page";
import { LoginPage } from "@/pages/login-page";
import { DashboardSkeleton } from "../components/skeleton/dashboard";
import { SettingPage } from "@/pages/settings-page";
import { ManageServicePage } from "@/pages/manage-service-page";
import { SettingsSkeleton } from "../components/skeleton/settings-skeleton";
import { ManageTeamPage } from "@/pages/manage-team-page";
import { ReportsPage } from "@/pages/reports-page";
import { AppointmentsPage } from "@/pages/appointments-page";
import { CustomersPage } from "@/pages/customers-page";

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/entrar"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/cadastro"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <AppointmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipe"
        element={
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <ManageTeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/servicos"
        element={
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <ManageServicePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorios"
        element={
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute skeleton={<SettingsSkeleton />}>
            <SettingPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
