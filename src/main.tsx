import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "./components/common/toaster";
import { ThemeToggle } from "./components/common/theme-toggle";
import { BrowserRouter } from "react-router";
import "./index.css";
import "./store/user-credential.store";
import { AppRoutes } from "./routes/app-routes";
import { AuthProvider } from "./contexts/auth-provider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <ThemeToggle />
        {/* <TopFixedNotice
          color="orange"
          message={"Período de testes acaba em 6 dias"}
          textAction={"Renovar agora"}
          onAction={() => alert("Renovado!")}
        /> */}
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
