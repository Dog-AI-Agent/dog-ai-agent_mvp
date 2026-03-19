/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#4361ee",
        "primary-light": "#eef1ff",
        secondary: "#7b2ff7",
        accent: "#f57c00",
        danger: "#ef4444",
        muted: "#6b7280",
        card: "#f8f9fa",
        border: "#e5e7eb",
        // severity / risk badges
        "risk-high": "#fef2f2",
        "risk-high-text": "#dc2626",
        "risk-medium": "#fffbeb",
        "risk-medium-text": "#d97706",
        "risk-low": "#f0fdf4",
        "risk-low-text": "#16a34a",
      },
    },
  },
  plugins: [],
};
