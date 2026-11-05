import type { CSSProperties } from "react";

/** Formatos de página del fotolibro (mm). El estándar de imprenta es A4 horizontal. */
export type FormatoLibro = "a4h" | "a4v" | "cuadrado";
export const FORMATOS: Record<FormatoLibro, { nombre: string; detalle: string; w: number; h: number }> = {
  a4h: { nombre: "A4 horizontal", detalle: "29,7 × 21 cm", w: 297, h: 210 },
  a4v: { nombre: "A4 vertical", detalle: "21 × 29,7 cm", w: 210, h: 297 },
  cuadrado: { nombre: "Cuadrado", detalle: "21 × 21 cm", w: 210, h: 210 },
};

/**
 * Diseños del fotolibro.
 * - clasico: colores y ornamentos de la temática, fotos con el marco que eligió el anfitrión.
 * - moderno: fotos a sangre con separaciones finas, tipografía sans en mayúsculas.
 * - minimal: fondo claro, márgenes amplios y nada de adornos.
 */
export type DisenoLibro = "clasico" | "moderno" | "minimal";
export interface ConfigDiseno {
  nombre: string;
  detalle: string;
  marcos: boolean; // respeta el marco instantánea del evento
  decorar: boolean; // fondos decorados de la temática en portadas y separadores
  ornamentos: boolean;
  pad: number; // margen interno de las páginas de fotos (mm)
  gap: number; // separación entre fotos (mm)
  foto: string; // clases de cada foto sin marco
  vars: CSSProperties; // pisa colores y fuentes de la temática
}
export const DISENOS: Record<DisenoLibro, ConfigDiseno> = {
  clasico: {
    nombre: "Clásico",
    detalle: "Colores y adornos de la temática",
    marcos: true,
    decorar: true,
    ornamentos: true,
    pad: 12,
    gap: 4,
    foto: "rounded-[2mm] shadow-md",
    vars: {},
  },
  moderno: {
    nombre: "Moderno",
    detalle: "Fotos a sangre, líneas finas",
    marcos: false,
    decorar: false,
    ornamentos: false,
    pad: 6,
    gap: 2,
    foto: "",
    vars: {
      "--t-fondo": "255 255 255",
      "--t-superficie": "243 244 246",
      "--t-texto": "17 24 39",
      "--t-font-titulo": "'Inter', 'Segoe UI', system-ui, sans-serif",
      "--t-font-cuerpo": "'Inter', 'Segoe UI', system-ui, sans-serif",
    } as CSSProperties,
  },
  minimal: {
    nombre: "Minimal",
    detalle: "Mucho aire, sin adornos",
    marcos: false,
    decorar: false,
    ornamentos: false,
    pad: 20,
    gap: 7,
    foto: "",
    vars: { "--t-fondo": "251 250 247", "--t-superficie": "255 255 255", "--t-texto": "38 38 38" } as CSSProperties,
  },
};

export const formatoDe = (x: unknown): FormatoLibro => (typeof x === "string" && x in FORMATOS ? (x as FormatoLibro) : "a4h");
export const disenoDe = (x: unknown): DisenoLibro => (typeof x === "string" && x in DISENOS ? (x as DisenoLibro) : "clasico");
