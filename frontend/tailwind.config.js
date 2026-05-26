/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0a0d12",
          800: "#11161d",
          700: "#1a2029",
          600: "#252d39",
          500: "#3a4452",
          400: "#5d6878",
        },
        accent: "#38bdf8",
        ok: "#22c55e",
        warn: "#f59e0b",
        err: "#ef4444",
        idle: "#71717a",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
