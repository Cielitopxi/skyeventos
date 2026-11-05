import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Horario contratado de un evento. Los invitados pueden subir contenido desde `horas_antes` antes del inicio
 * hasta `horas_despues` después del fin (se regulan desde el admin). Sin horario cargado, el evento queda abierto.
 */
export interface Ajustes {
  horas_antes: number;
  horas_despues: number;
}
export const AJUSTES_POR_DEFECTO: Ajustes = { horas_antes: 3, horas_despues: 24 };

let cache: Promise<Ajustes> | null = null;
export function cargarAjustes(forzar = false): Promise<Ajustes> {
  if (!cache || forzar)
    cache = Promise.resolve(supabase.from("ajustes").select("horas_antes, horas_despues").eq("id", 1).maybeSingle()).then(
      ({ data }) => (data as Ajustes | null) ?? AJUSTES_POR_DEFECTO,
    );
  return cache;
}
export function useAjustes() {
  const [a, setA] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  useEffect(() => {
    cargarAjustes().then(setA);
  }, []);
  return a;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** Fecha (AAAA-MM-DD) y horas (HH:MM) locales → inicio y fin. Si el fin es igual o anterior al inicio, es al día siguiente. */
export function armarHorario(fecha: string, desde: string, hasta: string): { inicio: Date; fin: Date } | null {
  if (!fecha || !desde || !hasta) return null;
  const inicio = new Date(`${fecha}T${desde}:00`);
  const fin = new Date(`${fecha}T${hasta}:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  if (fin <= inicio) fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

/** Al revés: de los timestamps guardados a los campos del formulario. */
export function camposHorario(inicio?: string | null, fin?: string | null) {
  if (!inicio) return { fecha: "", desde: "", hasta: "" };
  const i = new Date(inicio);
  const f = fin ? new Date(fin) : null;
  return {
    fecha: `${i.getFullYear()}-${dosDigitos(i.getMonth() + 1)}-${dosDigitos(i.getDate())}`,
    desde: `${dosDigitos(i.getHours())}:${dosDigitos(i.getMinutes())}`,
    hasta: f ? `${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}` : "",
  };
}

const horaCorta = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const diaLargo = (d: Date) => d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

/** "sábado 12 de diciembre, de 21:00 a 05:00 (termina el domingo)" */
export function textoHorario(inicio?: string | null, fin?: string | null) {
  if (!inicio) return "";
  const i = new Date(inicio);
  if (!fin) return `${diaLargo(i)}, desde las ${horaCorta(i)}`;
  const f = new Date(fin);
  const otroDia = f.toDateString() !== i.toDateString();
  return `${diaLargo(i)}, de ${horaCorta(i)} a ${horaCorta(f)}${otroDia ? ` (termina el ${f.toLocaleDateString("es-AR", { weekday: "long" })})` : ""}`;
}

export type MomentoEvento = "sin_horario" | "antes" | "en_curso" | "despues";

/** En qué momento está el evento para los invitados, y desde cuándo se habilita. */
export function momentoEvento(inicio: string | null | undefined, fin: string | null | undefined, a: Ajustes, ahora = new Date()) {
  if (!inicio) return { momento: "sin_horario" as MomentoEvento, habilita: null, cierra: null };
  const i = new Date(inicio);
  const f = fin ? new Date(fin) : new Date(i.getTime() + 12 * 3600e3);
  const habilita = new Date(i.getTime() - a.horas_antes * 3600e3);
  const cierra = new Date(f.getTime() + a.horas_despues * 3600e3);
  const momento: MomentoEvento = ahora < habilita ? "antes" : ahora < cierra ? "en_curso" : "despues";
  return { momento, habilita, cierra };
}

/** "en 3 días", "en 5 h", "en 20 min" */
export function falta(hasta: Date, ahora = new Date()) {
  const min = Math.max(0, Math.round((hasta.getTime() - ahora.getTime()) / 60000));
  if (min >= 2 * 24 * 60) return `en ${Math.round(min / 1440)} días`;
  if (min >= 90) return `en ${Math.round(min / 60)} h`;
  return `en ${min} min`;
}
