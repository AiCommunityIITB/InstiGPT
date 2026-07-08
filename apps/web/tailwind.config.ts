import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#090909",
          surface: "#111111",
          overlay: "#171717",
          muted: "#1c1c1c",
        },
        foreground: {
          DEFAULT: "#ededed",
          muted: "#888888",
          subtle: "#666666",
        },
        border: {
          DEFAULT: "#222222",
          hover: "#333333",
        },
        accent: {
          DEFAULT: "#3ecf8e",
          hover: "#3dd68c",
          muted: "#3ecf8e20",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      typography: {
        invert: {
          css: {
            "--tw-prose-body": "#b3b3b3",
            "--tw-prose-headings": "#ededed",
            "--tw-prose-links": "#3ecf8e",
            "--tw-prose-bold": "#ededed",
            "--tw-prose-code": "#3ecf8e",
            "--tw-prose-pre-bg": "#111111",
            "--tw-prose-pre-code": "#b3b3b3",
            "--tw-prose-hr": "#222222",
            "--tw-prose-quotes": "#888888",
            "--tw-prose-th-borders": "#333333",
            "--tw-prose-td-borders": "#222222",
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
