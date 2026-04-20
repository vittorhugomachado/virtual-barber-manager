import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps, context) => {
        if (context.hostType !== "html") {
          return deps;
        }

        return deps.filter(
          dep => !dep.includes("charts-") && !dep.includes("supabase-"),
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          radix: ["radix-ui"],
          icons: ["lucide-react"],
          forms: ["react-day-picker", "react-easy-crop"],
        },
      },
    },
  },
});
