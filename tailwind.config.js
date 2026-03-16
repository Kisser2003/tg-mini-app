/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
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

