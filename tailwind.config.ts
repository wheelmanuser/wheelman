import type { Config } from "tailwindcss";

const wmColors = {
  "wm-bg":          "#131312",
  "wm-s1":          "#1a1a18",
  "wm-s2":          "#222220",
  "wm-s3":          "#2e2e2b",
  "wm-border":      "#2e2e2b",
  "wm-text":        "#e8e4dc",
  "wm-text2":       "#9c9888",
  "wm-text3":       "#6b6858",
  "wm-accent":      "#a5d0bc",
  "wm-accent-dark": "#0c3729",
  "wm-gold":        "#e6c364",
  "wm-red":         "#cf6679",
  "wm-green":       "#a5d0bc",
  "wm-orange":      "#f97316",
  "wm-purple":      "#a855f7",
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
      fontFamily: {
        headline: ["var(--font-headline)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
