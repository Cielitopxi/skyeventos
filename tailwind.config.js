/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tema: {
          fondo: "rgb(var(--t-fondo) / <alpha-value>)",
          superficie: "rgb(var(--t-superficie) / <alpha-value>)",
          texto: "rgb(var(--t-texto) / <alpha-value>)",
          suave: "rgb(var(--t-suave) / <alpha-value>)",
          acento: "rgb(var(--t-acento) / <alpha-value>)",
          acento2: "rgb(var(--t-acento2) / <alpha-value>)",
        },
        // Paleta de marca "noche de gala". Reemplaza slate/sky para que el panel y
        // las páginas públicas tomen la identidad sin tocar cada clase.
        slate: {
          50: "#f8f6f1",
          100: "#f1ede5",
          200: "#e5dfd3",
          300: "#cfc7b8",
          400: "#a59d8f",
          500: "#7b7468",
          600: "#5c564c",
          700: "#3d3a3a",
          800: "#242636",
          900: "#151827",
          950: "#0b0d18",
        },
        sky: {
          50: "#faf6ee",
          100: "#f3ead6",
          200: "#e7d5ad",
          300: "#d6b97c",
          400: "#c29d58",
          500: "#94713a",
          600: "#7d5e2f",
          700: "#654b27",
          800: "#4d3a20",
          900: "#3a2c19",
        },
        noche: "#151827",
        marfil: "#f7f4ee",
        oro: "#c9a96e",
      },
      fontFamily: {
        titulo: "var(--t-font-titulo)",
        cuerpo: "var(--t-font-cuerpo)",
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        suave: "0 1px 2px rgba(21,24,39,.04), 0 10px 30px -12px rgba(21,24,39,.14)",
        elevada: "0 2px 4px rgba(21,24,39,.05), 0 24px 60px -20px rgba(21,24,39,.28)",
      },
    },
  },
  plugins: [],
};
