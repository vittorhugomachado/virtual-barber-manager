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
        path="/configuracoes"
        element={
          <ProtectedRoute skeleton={<SettingsSkeleton />}>
            <SettingPage />
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
    </Routes>
  );
}
