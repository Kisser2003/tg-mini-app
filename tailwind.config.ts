import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#050509",
        surface: "#101018",
        accent: "#22c55e"
      }
    }
  },
  plugins: []
};

export default config;

