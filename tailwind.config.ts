import type { Config } from "tailwindcss";

const wmColors = {
  "wm-bg": "#0A0C14",
  "wm-s1": "#12151F",
  "wm-s2": "#1A1E2E",
  "wm-s3": "#222840",
  "wm-border": "#2A3050",
  "wm-accent": "#3B82F6",
  "wm-gold": "#C8A45A",
  "wm-text": "#F0F2FA",
  "wm-text2": "#8B92B0",
  "wm-text3": "#5C6380",
  "wm-green": "#22C55E",
  "wm-red": "#EF4444",
  "wm-orange": "#F59E0B",
  "wm-purple": "#A855F7",
} as const;

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ...wmColors,
      },
    },
  },
  plugins: [],
};

export default config;
