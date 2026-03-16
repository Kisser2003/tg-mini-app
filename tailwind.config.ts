import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Telegram / iOS dark style
        background: "#080808",
        surface: "#141416",
        primary: "#007AFF",
        "primary-hover": "#0051FF",
        text: "#FFFFFF",
        "text-muted": "#8E8E93",
        border: "#3A3A3C"
      },
      borderRadius: {
        lg: "20px"
      }
    }
  },
  plugins: []
};
export default config;

