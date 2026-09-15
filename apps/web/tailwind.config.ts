import type { Config } from "tailwindcss";

// Design tokens for Lifeline Achham (see docs/DESIGN.md for rationale).
// Deliberately NOT the cream+terracotta or dark+neon defaults: this is a
// Nepal-based NGO, so the palette draws from the national flag's crimson
// and a disciplined navy, set against a warm paper background.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "#F7F5F1",
        ink: "#1B2233",
        navy: {
          DEFAULT: "#1B2A4A",
          50: "#EEF1F7",
          100: "#D6DDEB",
          400: "#3D5075",
          600: "#233657",
          900: "#131C30",
        },
        crimson: {
          DEFAULT: "#A6192E",
          50: "#FBECEE",
          400: "#C23B4F",
          600: "#8A1526",
        },
        sage: {
          DEFAULT: "#5C7A63",
          50: "#EEF3EF",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
        lg: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
