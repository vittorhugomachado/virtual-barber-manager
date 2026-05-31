import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function getInitialTheme(): "dark" | "light" {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="fixed bottom-4 right-4 z-50 rounded-full shadow-md"
      onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
      aria-label="Alternar tema"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
