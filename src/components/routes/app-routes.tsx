import { Routes, Route } from "react-router";
import { PublicRoute } from "./public-route";
import { ProtectedRoute } from "./protected-route";
import { DashboardPage } from "@/pages/dashboard-page";
import { SignupPage } from "@/pages/signup-page";
import { LoginPage } from "@/pages/login-page";
import { DashboardSkeleton } from "../skeleton/dashboard";
import { SettingPage } from "@/pages/settings-page";

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
          <ProtectedRoute skeleton={<DashboardSkeleton />}>
            <SettingPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
