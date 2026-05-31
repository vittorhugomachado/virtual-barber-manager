import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "./components/common/toaster";
import { ThemeToggle } from "./components/common/theme-toggle";
import { BrowserRouter } from "react-router";
import "./index.css";
import { AppRoutes } from "./routes/app-routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Toaster />
      <ThemeToggle />
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
