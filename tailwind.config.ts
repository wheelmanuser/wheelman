import type { Config } from "tailwindcss";

const wmColors = {
  "wm-bg":     "rgb(var(--wm-bg)     / <alpha-value>)",
  "wm-s1":     "rgb(var(--wm-s1)     / <alpha-value>)",
  "wm-s2":     "rgb(var(--wm-s2)     / <alpha-value>)",
  "wm-s3":     "rgb(var(--wm-s3)     / <alpha-value>)",
  "wm-border": "rgb(var(--wm-border) / <alpha-value>)",
  "wm-accent": "rgb(var(--wm-accent) / <alpha-value>)",
  "wm-gold":   "rgb(var(--wm-gold)   / <alpha-value>)",
  "wm-text":   "rgb(var(--wm-text)   / <alpha-value>)",
  "wm-text2":  "rgb(var(--wm-text2)  / <alpha-value>)",
  "wm-text3":  "rgb(var(--wm-text3)  / <alpha-value>)",
  "wm-green":  "rgb(var(--wm-green)  / <alpha-value>)",
  "wm-red":    "rgb(var(--wm-red)    / <alpha-value>)",
  "wm-orange": "rgb(var(--wm-orange) / <alpha-value>)",
  "wm-purple": "rgb(var(--wm-purple) / <alpha-value>)",
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
