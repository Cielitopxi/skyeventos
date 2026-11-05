import type { ReactNode } from "react";
import { IconoDuo, Medalla } from "../../components/Iconos";
import { giro, Instantanea, PROPORCION_MARCO } from "../../components/Instantanea";
import { formatoDuracion } from "../../lib/clip";
import { fechaLarga, hora, nombreTipo } from "../../lib/formato";
import { DISENOS, FORMATOS, type ConfigDiseno, type DisenoLibro, type FormatoLibro } from "../../lib/libro";
import { tematica, type Tematica } from "../../lib/tematicas";
import type { Evento, FilaRanking, Foto, Invitado, Mensaje, Mision, Premio } from "../../lib/tipos";

/**
 * Páginas del fotolibro, separadas de la carga de datos para poder probarlas con datos de muestra.
 * Todo se mide en mm: lo que se ve en pantalla es lo que sale en el PDF.
 */

export interface DatosLibro {
  evento: Evento;
  invitados: Invitado[];
  fotos: Foto[]; // solo fotos; `marco` ya resuelto según la personalización
  clips: Foto[]; // videos y audios: van con un QR para reproducirlos desde el papel
  qrs: Record<string, string>;
  mensajes: Mensaje[];
  misiones: Mision[];
  ranking: FilaRanking[];
  premios: Premio[];
}

export interface Pagina {
  contenido: ReactNode;
  decorada?: boolean;
}

interface Ctx {
  d: DatosLibro;
  t: Tematica;
  cfg: ConfigDiseno;
  diseno: DisenoLibro;
  horizontal: boolean;
  vertical: boolean; // A4 vertical (más alta que ancha)
  urls: Record<string, string>;
  img: (path: string, className?: string) => ReactNode;
  titulo: string;
}

const trozos = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Agrupa fotos en páginas de 1 a 4, dejando sola a la destacada y sin terminar con una foto suelta. */
function paginarFotos(fotos: Foto[]): Foto[][] {
  const paginas: Foto[][] = fotos.filter((f) => f.destacada).map((f) => [f]);
  const resto = fotos.filter((f) => !f.destacada);
  let i = 0;
  while (i < resto.length) {
    const quedan = resto.length - i;
    const n = quedan === 5 ? 3 : Math.min(4, quedan);
    paginas.push(resto.slice(i, i + n));
    i += n;
  }
  return paginas;
}

export function armarPaginas(
  d: DatosLibro,
  urls: Record<string, string>,
  formato: FormatoLibro,
  diseno: DisenoLibro,
  alCargar: (path: string) => void,
): Pagina[] {
  const f = FORMATOS[formato];
  const cfg = DISENOS[diseno];
  const t = tematica(d.evento.tematica);
  const p = d.evento.personalizacion;
  const titulo = p.titulo || d.evento.nombre;
  const ctx: Ctx = {
    d,
    t,
    cfg,
    diseno,
    horizontal: f.w > f.h,
    vertical: f.h > f.w,
    urls,
    titulo,
    img: (path, className = "") =>
      urls[path] ? (
        <img src={urls[path]} alt="" decoding="sync" className={`block h-full w-full object-cover ${className}`} onLoad={() => alCargar(path)} onError={() => alCargar(path)} />
      ) : null,
  };
  // Sin marcos en los diseños limpios: la foto va recortada a su celda.
  const fotos = cfg.marcos ? d.fotos : d.fotos.map((x) => ({ ...x, marco: null }));
  const orn = (clase: string) => (cfg.ornamentos ? <p className={`titulo ${clase}`}>{t.ornamento}</p> : null);
  const nombre = (id: string) => d.invitados.find((i) => i.id === id)?.nombre ?? "Invitado";
  const paginas: Pagina[] = [];

  // 1. Portada
  const portadaPath = p.portada_path || fotos.find((x) => x.destacada)?.storage_path || fotos[0]?.storage_path;
  paginas.push({ decorada: cfg.decorar, contenido: <Portada c={ctx} path={portadaPath} orn={orn} /> });

  // 2. Dedicatoria
  if (p.dedicatoria) {
    paginas.push({
      contenido: (
        <div className="flex h-full flex-col items-center justify-center px-[30mm] text-center">
          {orn("text-[20pt]")}
          <p className="mt-6 max-w-[200mm] whitespace-pre-wrap text-[13pt] italic leading-relaxed">{p.dedicatoria}</p>
        </div>
      ),
    });
  }

  // 3. El evento en números
  const participantes = new Set([...fotos.map((x) => x.invitado_id), ...d.mensajes.map((m) => m.invitado_id)]);
  paginas.push({
    decorada: cfg.decorar,
    contenido: (
      <div className="flex h-full flex-col items-center justify-center px-[20mm] text-center">
        <h2 className="titulo text-[28pt]">El evento en números</h2>
        <div className={`mt-10 grid gap-[10mm] ${ctx.horizontal ? "grid-cols-4" : "grid-cols-2"}`}>
          {[
            [fotos.length, "fotos"],
            [d.mensajes.length, "mensajes"],
            [participantes.size, "invitados participaron"],
            [fotos.filter((x) => x.mision_estado === "aprobada").length, "misiones cumplidas"],
          ].map(([n, l]) => (
            <div key={l as string}>
              <p className="titulo cifra text-[36pt] leading-none">{n}</p>
              <p className="mt-[2mm] text-[9pt] uppercase tracking-widest opacity-70">{l}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  // 4. Capítulos por invitado
  const conContenido = d.invitados.filter((i) => fotos.some((x) => x.invitado_id === i.id) || d.mensajes.some((m) => m.invitado_id === i.id));
  if (conContenido.length) paginas.push({ decorada: cfg.decorar, contenido: <Separador orn={orn} t="Nuestros invitados" s="Los recuerdos de cada uno" /> });
  for (const inv of conContenido) {
    const susFotos = fotos.filter((x) => x.invitado_id === inv.id);
    const susMensajes = d.mensajes.filter((m) => m.invitado_id === inv.id);
    const cumplidas = d.misiones.filter((mi) => susFotos.some((x) => x.mision_id === mi.id && x.mision_estado === "aprobada"));
    const [primera, ...resto] = [...susFotos.filter((x) => x.destacada), ...susFotos.filter((x) => !x.destacada)];
    const textos = [...susMensajes.filter((m) => m.tipo === "dedicatoria"), ...susMensajes.filter((m) => m.tipo === "nota")].slice(0, 3);

    const texto = (
      <div className="flex flex-col justify-center gap-[5mm]">
        <div>
          <p className="text-[9pt] uppercase tracking-[.3em] opacity-60">{inv.mesa ? `Mesa ${inv.mesa}` : "Invitado"}</p>
          <h3 className="titulo text-[28pt] leading-tight">{inv.nombre}</h3>
        </div>
        {textos.map((m) => (
          <p key={m.id} className={`whitespace-pre-wrap leading-snug ${m.tipo === "dedicatoria" ? "text-[11pt] italic" : "text-[10pt] opacity-80"}`}>
            “{m.texto.length > 380 ? m.texto.slice(0, 380) + "…" : m.texto}”
          </p>
        ))}
        {cumplidas.length > 0 && (
          <p className="flex items-center gap-[1.5mm] text-[9pt] opacity-70"><IconoDuo nombre="mision" className="h-[4mm] w-[4mm] shrink-0" /> {cumplidas.map((c) => c.titulo).join(" · ")}</p>
        )}
        <p className="text-[9pt] opacity-50">{susFotos.length} foto{susFotos.length === 1 ? "" : "s"}</p>
      </div>
    );
    const foto = primera ? (
      <Celda f={primera} c={ctx} className="h-full" />
    ) : (
      <div className="flex h-full items-center justify-center rounded-[3mm]" style={{ background: "rgb(var(--t-superficie))" }}>
        <p className="titulo text-[60pt]">{cfg.ornamentos ? t.ornamento : inv.nombre.charAt(0)}</p>
      </div>
    );
    paginas.push({
      contenido: ctx.vertical ? (
        <div className="flex h-full flex-col">
          <div className="h-[58%] p-[12mm] pb-[4mm]">{foto}</div>
          <div className="flex-1 px-[16mm] py-[8mm]">{texto}</div>
        </div>
      ) : (
        <div className="flex h-full">
          <div className={`flex ${ctx.horizontal ? "w-[42%] px-[18mm]" : "w-1/2 px-[14mm]"}`}>{texto}</div>
          <div className={`${ctx.horizontal ? "w-[58%]" : "w-1/2"} p-[10mm] pl-0`}>{foto}</div>
        </div>
      ),
    });
    for (const grupo of paginarFotos(resto)) paginas.push({ contenido: <PaginaFotos fotos={grupo} c={ctx} /> });
  }

  // 5. Misiones
  const conMision = d.misiones
    .map((m) => ({ m, fotos: fotos.filter((x) => x.mision_id === m.id && x.mision_estado === "aprobada") }))
    .filter((x) => x.fotos.length);
  if (conMision.length) {
    paginas.push({ decorada: cfg.decorar, contenido: <Separador orn={orn} t="Misiones cumplidas" s={`${conMision.length} desafíos cumplidos`} /> });
    for (const { m, fotos: fm } of conMision) {
      const elegidas = [...fm.filter((x) => x.destacada), ...fm.filter((x) => !x.destacada)].slice(0, 4);
      paginas.push({
        contenido: (
          <div className="flex h-full flex-col" style={{ padding: `${Math.max(cfg.pad, 10)}mm` }}>
            <div className="mb-[5mm] text-center">
              <h3 className="titulo flex items-center justify-center gap-[2mm] text-[20pt]"><IconoDuo nombre="mision" className="h-[7mm] w-[7mm]" /> {m.titulo}</h3>
              <p className="text-[9pt] opacity-70">{fm.length} invitado(s) la cumplieron: {[...new Set(fm.map((x) => nombre(x.invitado_id)))].slice(0, 8).join(", ")}</p>
            </div>
            <div className="min-h-0 flex-1"><Grilla fotos={elegidas} c={ctx} /></div>
          </div>
        ),
      });
    }
  }

  // 6. Muro de mensajes
  const notas = d.mensajes.filter((m) => m.tipo === "nota");
  trozos(notas, ctx.horizontal ? 9 : 8).forEach((grupo, i) =>
    paginas.push({
      decorada: cfg.decorar && i === 0,
      contenido: (
        <div className="flex h-full flex-col p-[14mm]">
          {i === 0 && <h2 className="titulo mb-[6mm] text-center text-[26pt]">Mensajes de los invitados</h2>}
          <div className={`grid flex-1 content-start gap-[5mm] ${ctx.horizontal ? "grid-cols-3" : "grid-cols-2"}`}>
            {grupo.map((m) => (
              <div key={m.id} className="rounded-[3mm] p-[4mm]" style={{ background: "rgb(var(--t-superficie) / .85)" }}>
                <p className="text-[10pt] leading-snug">“{m.texto}”</p>
                <p className="mt-[2mm] text-[8pt] opacity-60">— {nombre(m.invitado_id)} · {hora(m.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    }),
  );

  // 7. Videos y mensajes de voz: cada uno con su QR para verlo o escucharlo desde el libro impreso
  trozos(d.clips, 4).forEach((grupo, i) =>
    paginas.push({
      decorada: cfg.decorar && i === 0,
      contenido: (
        <div className="flex h-full flex-col p-[14mm]">
          {i === 0 && (
            <div className="mb-[6mm] text-center">
              <h2 className="titulo text-[26pt]">Para ver y escuchar</h2>
              <p className="text-[9pt] opacity-70">Escaneá cada código con la cámara del teléfono</p>
            </div>
          )}
          <div className={`grid min-h-0 flex-1 gap-[5mm] ${ctx.horizontal ? "grid-cols-4" : "grid-cols-2 grid-rows-2"}`}>
            {grupo.map((c) => (
              <div key={c.id} className="flex min-h-0 flex-col overflow-hidden rounded-[3mm]" style={{ background: "rgb(var(--t-superficie) / .85)" }}>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {ctx.img(c.thumb_path)}
                  <span className="absolute left-[3mm] top-[3mm] flex items-center gap-[1mm] rounded-full bg-black/55 px-[2.5mm] py-[0.8mm] text-[7pt] font-semibold text-white">
                    <IconoDuo nombre={c.medio === "video" ? "play" : "microfono"} className="h-[3mm] w-[3mm]" trazo={2} />
                    {c.medio === "video" ? "Video" : "Audio"} · {formatoDuracion(c.duracion)}
                  </span>
                </div>
                <div className="flex items-center gap-[3mm] p-[3mm]">
                  <img src={d.qrs[c.id]} alt="" className="h-[20mm] w-[20mm] shrink-0 rounded-[1mm] bg-white p-[1mm]" />
                  <div className="min-w-0">
                    <p className="truncate text-[10pt] font-semibold">{nombre(c.invitado_id)}</p>
                    {c.caption && <p className="line-clamp-2 text-[8pt] italic opacity-75">{c.caption}</p>}
                    <p className="text-[7pt] opacity-50">{hora(c.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    }),
  );

  // 8. Ranking
  if (d.evento.premios_activos && d.ranking.some((r) => r.puntos > 0)) {
    paginas.push({ decorada: cfg.decorar, contenido: <PaginaRanking d={d} orn={orn} /> });
  }

  // 9. Contraportada
  paginas.push({
    decorada: cfg.decorar,
    contenido: (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="titulo text-[30pt]">Gracias</p>
        {orn("text-[16pt]")}
        <p className="mt-4 text-[11pt] opacity-70">{titulo} · {fechaLarga(d.evento.fecha)}</p>
        {!d.evento.plan_id.startsWith("premium") && <p className="absolute bottom-[10mm] text-[8pt] opacity-40">Hecho con SkyEventos · SkyStudio</p>}
      </div>
    ),
  });

  return paginas;
}

function Separador({ orn, t, s }: { orn: (c: string) => ReactNode; t: string; s: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {orn("text-[18pt]")}
      <h2 className="titulo text-[34pt]">{t}</h2>
      <p className="mt-2 text-[11pt] opacity-70">{s}</p>
    </div>
  );
}

function Portada({ c, path, orn }: { c: Ctx; path?: string; orn: (cl: string) => ReactNode }) {
  const { d, titulo } = c;
  const p = d.evento.personalizacion;
  const textos = (claro = false) => (
    <>
      <p className={`text-[10pt] uppercase tracking-[.35em] ${claro ? "text-white/80" : "opacity-60"}`}>{p.subtitulo || nombreTipo(d.evento.tipo)}</p>
      <h1 className={`titulo mt-2 text-[40pt] leading-none ${claro ? "!text-white" : ""}`}>{titulo}</h1>
      {!claro && orn("mt-2 text-[16pt]")}
      <p className={`mt-2 text-[11pt] ${claro ? "text-white/80" : "opacity-70"}`}>{fechaLarga(d.evento.fecha)}</p>
    </>
  );
  // Moderno: la foto ocupa toda la tapa y el título va encima.
  if (c.diseno === "moderno" && path && c.urls[path])
    return (
      <div className="relative h-full">
        {c.img(path)}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-[16mm] pb-[14mm] pt-[40mm]">{textos(true)}</div>
      </div>
    );
  const foto = path && c.urls[path] ? <div className={`overflow-hidden ${c.cfg.foto}`}>{c.img(path)}</div> : null;
  if (c.horizontal)
    return (
      <div className="flex h-full" style={{ padding: c.diseno === "minimal" ? "18mm" : 0 }}>
        {foto && <div className="w-[56%] [&>div]:h-full">{foto}</div>}
        <div className="flex flex-1 flex-col items-center justify-center px-[14mm] text-center">{textos()}</div>
      </div>
    );
  return (
    <div className="flex h-full flex-col" style={{ padding: c.diseno === "minimal" ? "18mm" : 0 }}>
      {foto && <div className="h-[60%] [&>div]:h-full">{foto}</div>}
      <div className="flex flex-1 flex-col items-center justify-center px-[15mm] text-center">{textos()}</div>
    </div>
  );
}

/** Celda de foto: con marco instantánea (inclinado, con texto manuscrito) o recortada a la celda. */
function Celda({ f, c, className = "" }: { f: Foto; c: Ctx; className?: string }) {
  if (f.marco)
    return (
      // La celda es contenedor de tamaño: el marco entra entero tanto en celdas anchas como en altas.
      <div className={`flex min-h-0 min-w-0 items-center justify-center [container-type:size] ${className}`}>
        <Instantanea marco={f.marco} pie={f.caption || c.titulo} inclinar={giro(f.id, 2.5)} style={{ width: `min(94cqw, calc(94cqh / ${PROPORCION_MARCO}))` }}>
          {c.img(f.storage_path)}
        </Instantanea>
      </div>
    );
  return <div className={`min-h-0 min-w-0 overflow-hidden ${c.cfg.foto} ${className}`}>{c.img(f.storage_path)}</div>;
}

function Grilla({ fotos, c }: { fotos: Foto[]; c: Ctx }) {
  const gap = { gap: `${c.cfg.gap}mm` };
  const cel = (f: Foto, cl = "") => <Celda key={f.id} f={f} c={c} className={cl} />;
  if (fotos.length === 1) return cel(fotos[0], "h-full");
  if (fotos.length === 2)
    return <div className={`grid h-full ${c.vertical ? "grid-rows-2" : "grid-cols-2"}`} style={gap}>{fotos.map((f) => cel(f))}</div>;
  if (fotos.length === 3) {
    // Con marco o en A4 horizontal: tres columnas parejas (los marcos son casi cuadrados).
    if (c.horizontal && fotos[0].marco) return <div className="grid h-full grid-cols-3" style={gap}>{fotos.map((f) => cel(f))}</div>;
    if (!fotos[0].marco)
      return (
        <div className={`grid h-full grid-rows-2 ${c.horizontal ? "grid-cols-[3fr_2fr]" : "grid-cols-2"}`} style={gap}>
          {c.vertical ? cel(fotos[0], "col-span-2") : cel(fotos[0], "row-span-2")}
          {cel(fotos[1])}
          {cel(fotos[2])}
        </div>
      );
  }
  return <div className="grid h-full grid-cols-2 grid-rows-2" style={gap}>{fotos.slice(0, 4).map((f) => cel(f))}</div>;
}

function PaginaFotos({ fotos, c }: { fotos: Foto[]; c: Ctx }) {
  const conCaption = fotos.find((f) => f.caption && !f.marco);
  return (
    <div className="flex h-full flex-col" style={{ padding: `${c.cfg.pad}mm` }}>
      <div className="min-h-0 flex-1"><Grilla fotos={fotos} c={c} /></div>
      {conCaption && <p className="mt-[3mm] text-center text-[9pt] italic opacity-70">{conCaption.caption}</p>}
    </div>
  );
}

function PaginaRanking({ d, orn }: { d: DatosLibro; orn: (c: string) => ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-[25mm]">
      <h2 className="titulo text-[30pt]">Ranking final</h2>
      {orn("mb-[8mm] text-[14pt]")}
      <ol className="mt-[4mm] w-full max-w-[180mm] space-y-[3mm]">
        {d.ranking.slice(0, 10).map((r, i) => {
          const premio = d.premios.find((p) => p.puesto === i + 1);
          return (
            <li key={r.invitado_id} className="flex items-center gap-[4mm] rounded-[2mm] px-[4mm] py-[2mm] text-[12pt]" style={{ background: "rgb(var(--t-superficie) / .75)" }}>
              <span className="flex w-[8mm] justify-center"><Medalla puesto={i + 1} className="h-[7mm] w-[7mm]" /></span>
              <span className="flex-1 font-semibold">
                {r.nombre}
                {premio && <span className="flex items-center gap-[1mm] text-[8pt] font-normal opacity-70"><IconoDuo nombre="regalo" className="h-[3.5mm] w-[3.5mm]" /> {premio.descripcion}</span>}
              </span>
              <span className="font-bold">{r.puntos} pts</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
