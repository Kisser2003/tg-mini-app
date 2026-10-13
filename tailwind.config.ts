import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  /**
   * `hover:` только для мыши/трекпада. В Telegram на телефоне hover-стили «залипали»
   * после тапа (строка/кнопка оставалась подсвеченной), что выглядит как баг.
   */
  future: {
    hoverOnlyWhenSupported: true
  },
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" }
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geologica)",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif"
        ],
        display: [
          "var(--font-geologica)",
          "-apple-system",
          "system-ui",
          "sans-serif"
        ]
      },
      colors: {
        omf: {
          bg: "var(--omf-bg)",
          surface: "var(--omf-surface)",
          "surface-2": "var(--omf-surface-2)",
          line: "var(--omf-line)",
          "line-strong": "var(--omf-line-strong)",
          ink: "var(--omf-ink)",
          graphite: "var(--omf-graphite)",
          faint: "var(--omf-faint)",
          ultra: "var(--omf-ultra)",
          "ultra-text": "var(--omf-ultra-text)",
          yellow: "var(--omf-yellow)",
          "yellow-ink": "var(--omf-yellow-ink)",
          green: "var(--omf-green)",
          red: "var(--omf-red)"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        surface: "var(--omf-surface)",
        text: "var(--omf-ink)",
        "text-muted": "var(--omf-graphite)",
        "primary-hover": "var(--omf-ultra-hover)"
      },
      borderRadius: {
        sleeve: "var(--omf-sleeve-radius)",
        control: "var(--omf-control-radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        /** Лёгкое «дыхание» всей SVG-группы с волнами */
        "empty-wave-breathe": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" }
        },
        /** Пульс неонового свечения под волной */
        "empty-wave-glow": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.9" }
        },
        /** Фоновая волна за hero (библиотека) — CSS, не Framer */
        "hero-wave-bar": {
          "0%, 100%": { transform: "scaleY(0.08)" },
          "50%": { transform: "scaleY(var(--peak, 0.5))" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "accordion-up": "accordion-up 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
        "empty-wave-breathe": "empty-wave-breathe 3.2s ease-in-out infinite",
        "empty-wave-glow": "empty-wave-glow 2.4s ease-in-out infinite",
        "hero-wave-bar": "hero-wave-bar var(--bar-dur, 1.6s) ease-in-out infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;
