import { Routes, Route } from "react-router";
import { PublicRoute } from "../common/public-route";
import { ProtectedRoute } from "../common/protected-route";
import { DashboardPage } from "@/pages/dashboard-page";
import { SignupPage } from "@/pages/signup-page";
import { LoginPage } from "@/pages/login-page";
import { DashboardSkeleton } from "../skeleton/dashboard";

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
    </Routes>
  );
}
