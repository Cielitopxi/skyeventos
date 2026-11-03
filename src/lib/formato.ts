export const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export const fechaLarga = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
};

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

export const TIPOS_EVENTO: { id: string; nombre: string }[] = [
  { id: "boda", nombre: "Boda" },
  { id: "quince", nombre: "15 años" },
  { id: "cumple", nombre: "Cumpleaños" },
  { id: "infantil", nombre: "Cumpleaños infantil" },
  { id: "corporativo", nombre: "Corporativo" },
  { id: "egresados", nombre: "Egresados" },
  { id: "baby_shower", nombre: "Baby shower" },
  { id: "otro", nombre: "Otro" },
];

export const nombreTipo = (id: string) => TIPOS_EVENTO.find((t) => t.id === id)?.nombre ?? id;

export interface FilaMesa {
  mesa: string;
  puntos: number;
  invitados: number;
}

/** Competencia por mesas: suma los puntos de los invitados de cada mesa (sin mesa no compite). */
export function rankingPorMesa(filas: { mesa: string | null; puntos: number }[]): FilaMesa[] {
  const m = new Map<string, FilaMesa>();
  for (const f of filas) {
    const clave = f.mesa?.trim();
    if (!clave) continue;
    const fila = m.get(clave.toLowerCase()) ?? { mesa: clave, puntos: 0, invitados: 0 };
    fila.puntos += Number(f.puntos);
    fila.invitados += 1;
    m.set(clave.toLowerCase(), fila);
  }
  return [...m.values()].sort((a, b) => b.puntos - a.puntos || a.mesa.localeCompare(b.mesa, "es", { numeric: true }));
}
