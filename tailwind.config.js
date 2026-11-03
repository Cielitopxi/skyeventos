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
        // Paleta de marca (logo SkyEventos). Reemplaza slate/sky para que el panel y
        // las páginas públicas tomen la identidad sin tocar cada clase.
        slate: {
          50: "#f4f6f8",
          100: "#eaeef2",
          200: "#dce2e8",
          300: "#c3ccd5",
          400: "#94a1ad",
          500: "#6b7884",
          600: "#515d68",
          700: "#3a4650",
          800: "#26323c",
          900: "#1a242d",
          950: "#10171d",
        },
        // Acero del logo: sky = #97a8b4, EVENTOS = #4d6170, diafragma = #c5d3e0 / #6a889e / #2f4a5a
        sky: {
          50: "#f2f5f8",
          100: "#e3eaf0",
          200: "#c5d3e0",
          300: "#97a8b4",
          400: "#6a889e",
          500: "#4d6170",
          600: "#3f5160",
          700: "#2f4a5a",
          800: "#243845",
          900: "#1a2a34",
        },
        noche: "#1a242d",
        marfil: "#f4f6f8",
        oro: "#a9bccb",
      },
      fontFamily: {
        titulo: "var(--t-font-titulo)",
        cuerpo: "var(--t-font-cuerpo)",
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        suave: "0 1px 2px rgba(26,36,45,.04), 0 10px 30px -12px rgba(26,36,45,.14)",
        elevada: "0 2px 4px rgba(26,36,45,.05), 0 24px 60px -20px rgba(26,36,45,.28)",
      },
    },
  },
  plugins: [],
};
