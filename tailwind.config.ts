import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Fonts ─────────────────────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", ...fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...fontFamily.mono],
      },

      // ── Letter spacing ────────────────────────────────────────────────────
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.03em",
        tight: "-0.025em",
        snug: "-0.015em",
      },

      // ── Colors ────────────────────────────────────────────────────────────
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // VinFlow surface scale
        surface: {
          0: "#060608",
          1: "#0C0E16",
          2: "#0F1117",
          3: "#13151F",
          4: "#1A1D2B",
        },

        // Ocean Blue palette
        ocean: {
          DEFAULT: "#007AFF",
          50:  "rgba(0, 122, 255, 0.05)",
          100: "rgba(0, 122, 255, 0.10)",
          200: "rgba(0, 122, 255, 0.20)",
          light: "#0A84FF",
          dark:  "#0062CC",
          glow:  "rgba(0, 122, 255, 0.40)",
        },

        // iOS semantic
        ios: {
          blue:   "#007AFF",
          green:  "#30D158",
          red:    "#FF453A",
          orange: "#FF9F0A",
          purple: "#BF5AF2",
          teal:   "#5AC8FA",
        },

        // Semantic finance
        income:  { DEFAULT: "#30D158", muted: "rgba(48, 209, 88, 0.12)" },
        expense: { DEFAULT: "#FF453A", muted: "rgba(255, 69, 58, 0.12)" },

        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },

      // ── Border radius ─────────────────────────────────────────────────────
      borderRadius: {
        none: "0",
        sm:   "0.375rem",
        DEFAULT: "0.5rem",
        md:   "0.75rem",
        lg:   "1rem",
        xl:   "1.125rem",
        "2xl": "1.25rem",   // primary card
        "3xl": "1.5rem",    // large card / balance
        "4xl": "2rem",
        full: "9999px",
      },

      // ── Box shadows — diffused, no harsh drops ────────────────────────────
      boxShadow: {
        "diffused-sm": "0 1px 2px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)",
        diffused:      "0 1px 2px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.18)",
        "diffused-lg": "0 2px 4px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.35), 0 20px 50px rgba(0,0,0,0.22)",

        // Blue glow
        "glow-sm": "0 0 8px rgba(0,122,255,0.3), 0 0 18px rgba(0,122,255,0.15)",
        glow:      "0 0 14px rgba(0,122,255,0.4), 0 0 36px rgba(0,122,255,0.18), 0 2px 8px rgba(0,0,0,0.7)",
        "glow-lg": "0 0 22px rgba(0,122,255,0.55), 0 0 55px rgba(0,122,255,0.25), 0 4px 16px rgba(0,0,0,0.8)",

        card: "0 1px 2px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-hover": "0 2px 6px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.07)",

        none: "none",
      },

      // ── Backdrop blur ─────────────────────────────────────────────────────
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "36px",
        "3xl": "48px",
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0,122,255,0.3), 0 0 20px rgba(0,122,255,0.1)" },
          "50%":       { boxShadow: "0 0 18px rgba(0,122,255,0.6), 0 0 45px rgba(0,122,255,0.28)" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%":           { transform: "scale(1)" },
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "fade-up":    "fade-up 0.35s ease-out",
        "fade-in":    "fade-in 0.25s ease-out",
        "slide-up":   "slide-up 0.45s ease-out",
        shimmer:      "shimmer 2s linear infinite",
      },

      // ── Transitions ───────────────────────────────────────────────────────
      transitionDuration: { 200: "200ms", 250: "250ms", 350: "350ms" },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
