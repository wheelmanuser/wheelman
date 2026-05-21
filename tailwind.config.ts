import type { Config } from "tailwindcss";

const wmColors = {
  "wm-bg":          "rgb(var(--wm-bg) / <alpha-value>)",
  "wm-s1":          "rgb(var(--wm-s1) / <alpha-value>)",
  "wm-s2":          "rgb(var(--wm-s2) / <alpha-value>)",
  "wm-s3":          "rgb(var(--wm-s3) / <alpha-value>)",
  "wm-border":      "rgb(var(--wm-border) / <alpha-value>)",
  "wm-text":        "rgb(var(--wm-text) / <alpha-value>)",
  "wm-text2":       "rgb(var(--wm-text2) / <alpha-value>)",
  "wm-text3":       "rgb(var(--wm-text3) / <alpha-value>)",
  "wm-accent":      "rgb(var(--wm-accent) / <alpha-value>)",
  "wm-accent-dark": "rgb(var(--wm-accent-dark) / <alpha-value>)",
  "wm-gold":        "rgb(var(--wm-gold) / <alpha-value>)",
  "wm-red":         "rgb(var(--wm-red) / <alpha-value>)",
  "wm-green":       "rgb(var(--wm-accent) / <alpha-value>)",
  "wm-orange":      "#f97316",
  "wm-purple":      "#a855f7",
};

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
      fontSize: {
        "body-md": ["18px", { lineHeight: "1.6" }],
        "headline-sm": ["26px", { lineHeight: "1.2" }],
        "headline-md": ["34px", { lineHeight: "1.1" }],
      },
    },
  },
  plugins: [],
};

export default config;
