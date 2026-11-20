import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" }
    },
    extend: {
      colors: {
        background: "#08090a",
        surface: {
          DEFAULT: "#101113",
          raised: "#151719",
          muted: "#1b1d20",
          border: "#26282c"
        },
        accent: {
          DEFAULT: "#8f2634",
          hover: "#a72f3f",
          soft: "#2a1116",
          border: "#5b1a24"
        },
        ink: {
          DEFAULT: "#f4f4f5",
          muted: "#a1a1aa",
          subtle: "#71717a"
        }
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      boxShadow: {
        panel: "0 20px 60px rgba(0, 0, 0, 0.35)",
        soft: "0 8px 28px rgba(0, 0, 0, 0.22)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        },
        "scale-in": {
          from: { opacity: "0", scale: "0.98" },
          to: { opacity: "1", scale: "1" }
        }
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "slide-in": "slide-in 220ms ease-out both",
        "scale-in": "scale-in 160ms ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
