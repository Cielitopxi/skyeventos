import { fechaLarga } from "../lib/formato";
import { tematica } from "../lib/tematicas";
import type { DisenoPortada, Personalizacion } from "../lib/tipos";

/** Tipografías para el título de la portada personalizada. */
export const FUENTES_PORTADA = [
  { id: "tema", nombre: "La de la temática", css: "" },
  { id: "bodoni", nombre: "Bodoni", css: "'Bodoni Moda', Didot, serif" },
  { id: "cormorant", nombre: "Cormorant", css: "'Cormorant Garamond', Georgia, serif" },
  { id: "cinzel", nombre: "Cinzel", css: "Cinzel, 'Trajan Pro', serif" },
  { id: "italiana", nombre: "Italiana", css: "Italiana, Didot, serif" },
  { id: "vibes", nombre: "Caligráfica", css: "'Great Vibes', cursive" },
  { id: "fraunces", nombre: "Fraunces", css: "Fraunces, Georgia, serif" },
  { id: "grotesk", nombre: "Moderna", css: "'Space Grotesk', Inter, sans-serif" },
];

export const PORTADA_INICIAL: DisenoPortada = { estilo: "completa", fuente: "bodoni", alineacion: "abajo", oscurecer: 35, color: "#ffffff" };

export const fuentePortada = (id?: string) => FUENTES_PORTADA.find((f) => f.id === id)?.css || "var(--t-font-titulo)";

interface Props {
  tematicaId: string;
  nombre: string;
  fecha?: string | null;
  p: Personalizacion;
  url?: string; // URL firmada de la foto de portada
  mini?: boolean; // vista previa dentro del celular del panel
}

/**
 * Encabezado del evento. Con diseño personalizado (Premium) puede ser foto completa con el
 * título encima, banda de foto o foto enmarcada; sin diseño usa el estilo de la temática.
 */
export function Portada({ tematicaId, nombre, fecha, p, url, mini = false }: Props) {
  const t = tematica(tematicaId);
  const d = p.portada;
  const titulo = p.titulo || nombre || "Nuestro evento";
  const sub = p.subtitulo || (fecha ? fechaLarga(fecha) : "Bienvenidos");
  const fuente = d ? fuentePortada(d.fuente) : "var(--t-font-titulo)";

  if (d?.estilo === "completa" && url) {
    return (
      <div className={`relative overflow-hidden ${mini ? "h-56" : "h-[62vh] min-h-[340px]"}`}>
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, rgba(0,0,0,${(d.oscurecer + 25) / 100}), rgba(0,0,0,${d.oscurecer / 200}) 55%, rgba(0,0,0,${d.oscurecer / 300}))` }}
        />
        <div
          className={`absolute inset-x-0 flex flex-col items-center px-5 text-center ${d.alineacion === "centro" ? "inset-y-0 justify-center" : `bottom-0 ${mini ? "pb-5" : "pb-10"}`}`}
          style={{ color: d.color || "#fff" }}
        >
          <p className={`${mini ? "text-[8px]" : "text-[11px]"} uppercase tracking-[.35em] opacity-85`}>{sub}</p>
          <h1 className={`${mini ? "mt-1 text-3xl" : "mt-2 text-5xl"} leading-[1.05] drop-shadow-[0_2px_12px_rgba(0,0,0,.35)]`} style={{ fontFamily: fuente }}>
            {titulo}
          </h1>
          <span className={`${mini ? "mt-2 w-8" : "mt-4 w-14"} h-px bg-current opacity-60`} />
        </div>
      </div>
    );
  }

  if (d?.estilo === "marco" && url) {
    return (
      <div style={{ background: t.fondoDecorado }} className={`relative overflow-hidden px-6 text-center ${mini ? "pb-4 pt-5" : "pb-8 pt-10"}`}>
        <div className={`mx-auto overflow-hidden rounded-t-full border-[3px] border-tema-acento/70 p-1.5 shadow-lg ${mini ? "h-36 w-28" : "h-72 w-56"}`}>
          <img src={url} alt="" className="h-full w-full rounded-t-full object-cover" />
        </div>
        <p className={`${mini ? "mt-3 text-[8px]" : "mt-6 text-[11px]"} uppercase tracking-[.35em] text-tema-suave`}>{sub}</p>
        <h1 className={`${mini ? "text-3xl" : "text-5xl"} mt-1 leading-tight text-tema-acento`} style={{ fontFamily: fuente }}>{titulo}</h1>
        <p className="mt-1 text-tema-acento">{t.ornamento}</p>
      </div>
    );
  }

  return (
    <div style={{ background: t.fondoDecorado }} className="relative overflow-hidden">
      {url && <img src={url} alt="" className={`${mini ? "h-28" : "h-48"} w-full object-cover`} />}
      <div className={`px-5 text-center ${mini ? "py-5" : "py-6"}`}>
        <p className={`${mini ? "text-[10px]" : "text-xs"} uppercase tracking-[.3em] text-tema-suave`}>{sub}</p>
        <h1 className={`${mini ? "mt-1 text-3xl" : "text-4xl"} leading-tight text-tema-acento`} style={{ fontFamily: fuente }}>
          {titulo}
        </h1>
        <p className="mt-1 text-tema-acento">{t.ornamento}</p>
      </div>
    </div>
  );
}
