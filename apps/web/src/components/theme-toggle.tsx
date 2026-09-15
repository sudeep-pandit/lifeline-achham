"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme-context";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded p-2 text-navy-400 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-600"
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
