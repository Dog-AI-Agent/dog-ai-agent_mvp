/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#4361ee",
        secondary: "#7b2ff7",
        accent: "#f57c00",
        danger: "#ef4444",
        muted: "#6b7280",
        card: "#f8f9fa",
        border: "#e5e7eb",
      },
    },
  },
  plugins: [],
};
