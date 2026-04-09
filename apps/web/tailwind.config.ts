import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          primary: "#1a56db",
          accent: "#f59e0b",
          dark: "#111827",
          light: "#f9fafb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
