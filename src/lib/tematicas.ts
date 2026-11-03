import type { CSSProperties } from "react";
import type { Personalizacion } from "./tipos";

/** Colores como "R G B" para poder usar opacidad en Tailwind (rgb(var(--x) / a)). */
export interface Tematica {
  id: string;
  nombre: string;
  descripcion: string;
  tipos: string[]; // tipos de evento para los que se sugiere
  oscura: boolean;
  colores: { fondo: string; superficie: string; texto: string; suave: string; acento: string; acento2: string };
  fuenteTitulo: string;
  fuenteCuerpo: string;
  ornamento: string; // carácter decorativo para separadores
  fondoDecorado: string; // background CSS para portadas y pantalla
}

export const TEMATICAS: Tematica[] = [
  {
    id: "elegante",
    nombre: "Elegante",
    descripcion: "Marfil y dorado, tipografía clásica.",
    tipos: ["boda", "corporativo", "otro"],
    oscura: false,
    colores: { fondo: "250 247 240", superficie: "255 255 255", texto: "41 37 36", suave: "120 113 108", acento: "176 137 64", acento2: "120 94 46" },
    fuenteTitulo: "'Cormorant Garamond', Georgia, serif",
    fuenteCuerpo: "Inter, system-ui, sans-serif",
    ornamento: "❦",
    fondoDecorado: "radial-gradient(circle at 20% 10%, rgba(176,137,64,.18), transparent 45%), radial-gradient(circle at 85% 90%, rgba(176,137,64,.14), transparent 40%), #faf7f0",
  },
  {
    id: "romantico",
    nombre: "Romántico",
    descripcion: "Rosa empolvado y letra caligráfica.",
    tipos: ["boda", "baby_shower"],
    oscura: false,
    colores: { fondo: "253 244 245", superficie: "255 255 255", texto: "76 29 49", suave: "157 108 125", acento: "219 112 147", acento2: "159 18 57" },
    fuenteTitulo: "'Great Vibes', 'Playfair Display', cursive",
    fuenteCuerpo: "Inter, system-ui, sans-serif",
    ornamento: "♥",
    fondoDecorado: "radial-gradient(circle at 15% 20%, rgba(219,112,147,.22), transparent 40%), radial-gradient(circle at 90% 80%, rgba(251,207,232,.6), transparent 45%), #fdf4f5",
  },
  {
    id: "glam",
    nombre: "Glam noche",
    descripcion: "Negro, violeta y brillos. Ideal 15 años.",
    tipos: ["quince", "cumple", "egresados"],
    oscura: true,
    colores: { fondo: "17 12 28", superficie: "32 24 52", texto: "245 240 255", suave: "180 168 210", acento: "217 70 239", acento2: "250 204 21" },
    fuenteTitulo: "'Playfair Display', Georgia, serif",
    fuenteCuerpo: "Inter, system-ui, sans-serif",
    ornamento: "✦",
    fondoDecorado: "radial-gradient(circle at 20% 15%, rgba(217,70,239,.35), transparent 40%), radial-gradient(circle at 80% 85%, rgba(250,204,21,.18), transparent 40%), #110c1c",
  },
  {
    id: "fiesta",
    nombre: "Fiesta neón",
    descripcion: "Colores eléctricos para bailar toda la noche.",
    tipos: ["cumple", "egresados", "quince", "otro"],
    oscura: true,
    colores: { fondo: "9 9 20", superficie: "24 24 48", texto: "240 249 255", suave: "148 163 184", acento: "34 211 238", acento2: "244 63 94" },
    fuenteTitulo: "'Space Grotesk', Inter, sans-serif",
    fuenteCuerpo: "'Space Grotesk', Inter, sans-serif",
    ornamento: "★",
    fondoDecorado: "linear-gradient(135deg, rgba(34,211,238,.25), transparent 40%), linear-gradient(315deg, rgba(244,63,94,.25), transparent 40%), #090914",
  },
  {
    id: "infantil",
    nombre: "Infantil",
    descripcion: "Colores alegres y letras redondeadas.",
    tipos: ["infantil", "baby_shower"],
    oscura: false,
    colores: { fondo: "255 251 235", superficie: "255 255 255", texto: "30 41 59", suave: "100 116 139", acento: "249 115 22", acento2: "14 165 233" },
    fuenteTitulo: "Fredoka, 'Comic Sans MS', sans-serif",
    fuenteCuerpo: "Fredoka, Inter, sans-serif",
    ornamento: "✿",
    fondoDecorado: "radial-gradient(circle at 10% 20%, rgba(249,115,22,.22), transparent 30%), radial-gradient(circle at 90% 30%, rgba(14,165,233,.22), transparent 30%), radial-gradient(circle at 50% 95%, rgba(132,204,22,.22), transparent 35%), #fffbeb",
  },
  {
    id: "corporativo",
    nombre: "Corporativo",
    descripcion: "Sobrio, azul y gris. Para empresas y congresos.",
    tipos: ["corporativo"],
    oscura: false,
    colores: { fondo: "248 250 252", superficie: "255 255 255", texto: "15 23 42", suave: "100 116 139", acento: "37 99 235", acento2: "15 118 110" },
    fuenteTitulo: "'Space Grotesk', Inter, sans-serif",
    fuenteCuerpo: "Inter, system-ui, sans-serif",
    ornamento: "◆",
    fondoDecorado: "linear-gradient(160deg, rgba(37,99,235,.12), transparent 50%), #f8fafc",
  },
];

export const tematica = (id: string | undefined) => TEMATICAS.find((t) => t.id === id) ?? TEMATICAS[0];

function hexARgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Variables CSS de la temática (con el acento personalizado si lo hay). */
export function estiloTematica(id: string | undefined, p?: Personalizacion): CSSProperties {
  const t = tematica(id);
  const acento = (p?.acento && hexARgb(p.acento)) || t.colores.acento;
  return {
    "--t-fondo": t.colores.fondo,
    "--t-superficie": t.colores.superficie,
    "--t-texto": t.colores.texto,
    "--t-suave": t.colores.suave,
    "--t-acento": acento,
    "--t-acento2": t.colores.acento2,
    "--t-font-titulo": t.fuenteTitulo,
    "--t-font-cuerpo": t.fuenteCuerpo,
    colorScheme: t.oscura ? "dark" : "light",
  } as CSSProperties;
}

export interface MisionSugerida {
  titulo: string;
  descripcion: string;
  puntos: number;
}

const COMUNES: MisionSugerida[] = [
  { titulo: "Selfie con alguien de otra mesa", descripcion: "Buscá a alguien que no conocías y saquense una selfie.", puntos: 15 },
  { titulo: "El mejor paso de baile", descripcion: "Capturá el paso más original de la pista.", puntos: 10 },
  { titulo: "Brindis", descripcion: "Una foto de tu mesa brindando.", puntos: 10 },
  { titulo: "La foto más divertida", descripcion: "Muecas, disfraces, lo que se te ocurra.", puntos: 10 },
  { titulo: "Detalle de la decoración", descripcion: "Fotografiá el detalle que más te gustó.", puntos: 5 },
];

export const MISIONES_SUGERIDAS: Record<string, MisionSugerida[]> = {
  boda: [
    { titulo: "Selfie con los novios", descripcion: "¡Acercate y sacate una selfie con ellos!", puntos: 20 },
    { titulo: "Los anillos", descripcion: "Una foto de los anillos de los novios.", puntos: 15 },
    { titulo: "El ramo", descripcion: "Capturá el momento del ramo.", puntos: 15 },
    ...COMUNES,
  ],
  quince: [
    { titulo: "Selfie con la quinceañera", descripcion: "¡Una selfie con la protagonista!", puntos: 20 },
    { titulo: "El vals", descripcion: "Capturá un momento del vals.", puntos: 15 },
    { titulo: "Las velas", descripcion: "La ceremonia de las velas.", puntos: 15 },
    ...COMUNES,
  ],
  infantil: [
    { titulo: "Soplando las velas", descripcion: "El momento de la torta.", puntos: 20 },
    { titulo: "Foto con el cumpleañero", descripcion: "Una foto con el protagonista.", puntos: 15 },
    { titulo: "Cara pintada", descripcion: "Mostrá tu mejor cara pintada o disfraz.", puntos: 10 },
    { titulo: "Juego en acción", descripcion: "Una foto de los chicos jugando.", puntos: 10 },
  ],
  corporativo: [
    { titulo: "Selfie con el equipo", descripcion: "Una foto con tu equipo de trabajo.", puntos: 15 },
    { titulo: "Conocé a alguien nuevo", descripcion: "Selfie con alguien de otra área.", puntos: 15 },
    { titulo: "El momento del discurso", descripcion: "Capturá a quien está hablando.", puntos: 10 },
    { titulo: "Brindis", descripcion: "Una foto brindando.", puntos: 10 },
  ],
};

export const misionesSugeridas = (tipo: string) => MISIONES_SUGERIDAS[tipo] ?? COMUNES;

// Bingo de momentos: 9 casillas por cartón (las propias de cada tipo primero, el resto se completa con las comunes).
const BINGO_COMUNES = ["Un brindis", "Un abrazo", "Selfie grupal", "Alguien bailando", "La torta", "Una carcajada", "Zapatos de fiesta", "Alguien de otra mesa", "La pista llena"];

const BINGO_SUGERIDO: Record<string, string[]> = {
  boda: ["El beso de los novios", "Los anillos", "El ramo", "Un brindis", "Selfie con los novios", "Alguien emocionado", "Un abrazo", "La pista llena", "La torta"],
  quince: ["El vals", "Las velas", "Selfie con la quinceañera", "Un brindis", "La pista llena", "Un abrazo", "La torta", "Zapatos de fiesta", "Una carcajada"],
  infantil: ["Soplando las velas", "Una cara pintada", "Un disfraz", "Chicos jugando", "La torta", "Globos", "Un abrazo", "Selfie grupal", "Una carcajada"],
  corporativo: ["El discurso", "Selfie con el equipo", "Alguien de otra área", "Un brindis", "Un apretón de manos", "Una carcajada", "Selfie grupal", "El logo de la empresa", "La pista llena"],
};

export const bingoSugerido = (tipo: string) => [...new Set([...(BINGO_SUGERIDO[tipo] ?? []), ...BINGO_COMUNES])].slice(0, 9);
