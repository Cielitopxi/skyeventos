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
