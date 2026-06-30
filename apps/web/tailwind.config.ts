import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mint: "#26A69A",
        coral: "#FF6B5F",
        amber: "#F4B942",
        berry: "#9B5DE5"
      },
      boxShadow: {
        soft: "0 16px 48px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
