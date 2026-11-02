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
      },
      fontFamily: {
        titulo: "var(--t-font-titulo)",
        cuerpo: "var(--t-font-cuerpo)",
      },
    },
  },
  plugins: [],
};
