import { Routes, Route } from "react-router";
import { PublicRoute } from "./public-route";
import { ProtectedRoute } from "./protected-route";
import { DashboardPage } from "@/pages/dashboard-page";
import { SignupPage } from "@/pages/signup-page";
import { LoginPage } from "@/pages/login-page";
import { DashboardSkeleton } from "../components/skeleton/dashboard";
import { SettingPage } from "@/pages/settings-page";
import { ManageServicePage } from "@/pages/manage-service-page";
import { ManageTeamPage } from "@/pages/manage-team-page";
import { ReportsPage } from "@/pages/reports-page";
import { AppointmentsPage } from "@/pages/appointments-page";
import { CustomersPage } from "@/pages/customers-page";

export function AppRoutes() {
  return (
    <Routes>
      {/* Rotas públicas */}
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
        element={
          <ProtectedRoute withSidebar skeleton={<DashboardSkeleton />} />
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agenda" element={<AppointmentsPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/equipe" element={<ManageTeamPage />} />
        <Route path="/servicos" element={<ManageServicePage />} />
        <Route path="/relatorios" element={<ReportsPage />} />
        <Route path="/configuracoes" element={<SettingPage />} />
      </Route>
    </Routes>
  );
}
