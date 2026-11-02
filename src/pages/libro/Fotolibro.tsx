import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Cargando } from "../../components/ui";
import { fechaLarga, hora, nombreTipo } from "../../lib/formato";
import { supabase } from "../../lib/supabase";
import { estiloTematica, tematica, type Tematica } from "../../lib/tematicas";
import type { Evento, FilaRanking, Foto, Invitado, Mensaje, Mision, Premio } from "../../lib/tipos";
import { urlsFirmadas } from "../../lib/urls";

/**
 * Fotolibro: páginas cuadradas de 21 × 21 cm. Se descarga como PDF con la impresión del navegador
 * ("Guardar como PDF"). La misma ruta puede renderizarse en un Chromium headless para generar el PDF en el servidor.
 */

interface Datos {
  evento: Evento;
  invitados: Invitado[];
  fotos: Foto[];
  mensajes: Mensaje[];
  misiones: Mision[];
  ranking: FilaRanking[];
  premios: Premio[];
}

const trozos = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Agrupa fotos en páginas de 1 a 4, dejando sola a la destacada. */
function paginarFotos(fotos: Foto[]): Foto[][] {
  const destacadas = fotos.filter((f) => f.destacada);
  const resto = fotos.filter((f) => !f.destacada);
  const paginas: Foto[][] = destacadas.map((f) => [f]);
  let i = 0;
  while (i < resto.length) {
    const quedan = resto.length - i;
    const n = quedan === 5 ? 3 : Math.min(4, quedan); // evita terminar con una foto suelta
    paginas.push(resto.slice(i, i + n));
    i += n;
  }
  return paginas;
}

export default function Fotolibro() {
  const { id } = useParams();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [cargadas, setCargadas] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ev = await supabase.from("eventos").select("*").eq("id", id!).maybeSingle();
      if (!ev.data) return setError("Evento no encontrado.");
      const [inv, fo, me, mi, ra, pr] = await Promise.all([
        supabase.from("invitados").select("*").eq("evento_id", id!).eq("bloqueado", false).order("nombre"),
        supabase.from("fotos").select("*").eq("evento_id", id!).eq("estado", "aprobada").eq("en_libro", true).order("created_at"),
        supabase.from("mensajes").select("*").eq("evento_id", id!).eq("estado", "aprobada").eq("en_libro", true).order("created_at"),
        supabase.from("misiones").select("*").eq("evento_id", id!).order("orden"),
        supabase.rpc("ranking", { p_evento: id }),
        supabase.from("premios").select("*").eq("evento_id", id!).order("puesto"),
      ]);
      const d: Datos = {
        evento: ev.data as Evento,
        invitados: (inv.data as Invitado[]) ?? [],
        fotos: (fo.data as Foto[]) ?? [],
        mensajes: (me.data as Mensaje[]) ?? [],
        misiones: (mi.data as Mision[]) ?? [],
        ranking: (ra.data as FilaRanking[]) ?? [],
        premios: (pr.data as Premio[]) ?? [],
      };
      const paths = d.fotos.map((f) => f.storage_path);
      if (d.evento.personalizacion.portada_path) paths.push(d.evento.personalizacion.portada_path);
      setUrls(await urlsFirmadas(paths));
      setDatos(d);
    })();
  }, [id]);

  const paginas = useMemo(() => (datos ? armarPaginas(datos, urls, () => setCargadas((n) => n + 1)) : []), [datos, urls]);

  if (error) return <div className="p-8"><Aviso tipo="error">{error}</Aviso></div>;
  if (!datos) return <Cargando texto="Armando el fotolibro…" />;

  const t = tematica(datos.evento.tematica);
  const totalImgs = new Set(Object.keys(urls)).size;
  const listo = cargadas >= totalImgs;

  return (
    <div style={estiloTematica(datos.evento.tematica, datos.evento.personalizacion)} className="min-h-screen bg-slate-200 print:bg-white">
      <style>{`
        @page { size: 210mm 210mm; margin: 0; }
        .pagina { width: 210mm; height: 210mm; overflow: hidden; position: relative; break-after: page; page-break-after: always;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; background: rgb(var(--t-fondo)); color: rgb(var(--t-texto));
          font-family: var(--t-font-cuerpo); }
        .titulo { font-family: var(--t-font-titulo); color: rgb(var(--t-acento)); }
        @media screen { .pagina { margin: 0 auto 10mm; box-shadow: 0 10px 30px rgba(0,0,0,.18); } }
        @media print { .pagina:last-child { break-after: auto; page-break-after: auto; } }
      `}</style>

      <div className="no-imprimir sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to={`/panel/${id}?tab=libro`} className="btn-secundario btn-chico">← Volver</Link>
          <p className="mr-auto text-sm text-slate-600">
            {paginas.length} páginas · {datos.fotos.length} fotos · {listo ? "listo" : `cargando imágenes ${cargadas}/${totalImgs}…`}
          </p>
          <button className="btn-primario" disabled={!listo} onClick={() => window.print()}>Descargar PDF</button>
        </div>
        <p className="mx-auto max-w-4xl px-4 pb-2 text-xs text-slate-500">
          En la ventana de impresión elegí <b>Destino: Guardar como PDF</b>, márgenes <b>Ninguno</b> y activá <b>Gráficos de fondo</b>. Formato 21 × 21 cm.
        </p>
      </div>

      <div className="py-8 print:py-0">
        {paginas.map((p, i) => (
          <section key={i} className="pagina" style={{ background: p.decorada ? t.fondoDecorado : undefined }}>
            {p.contenido}
            {i > 0 && i < paginas.length - 1 && (
              <span className="absolute bottom-[6mm] left-0 right-0 text-center text-[8pt] opacity-50">{i + 1}</span>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

interface Pagina {
  contenido: ReactNode;
  decorada?: boolean;
}

function armarPaginas(d: Datos, urls: Record<string, string>, alCargar: () => void): Pagina[] {
  const t = tematica(d.evento.tematica);
  const p = d.evento.personalizacion;
  const titulo = p.titulo || d.evento.nombre;
  const nombre = (id: string) => d.invitados.find((i) => i.id === id)?.nombre ?? "Invitado";
  const vistas = new Set<string>();
  const Img = ({ f, className = "" }: { f: Foto; className?: string }) => {
    const u = urls[f.storage_path];
    if (!u) return null;
    return (
      <img
        src={u}
        alt=""
        className={`h-full w-full object-cover ${className}`}
        onLoad={() => {
          if (!vistas.has(f.storage_path)) {
            vistas.add(f.storage_path);
            alCargar();
          }
        }}
      />
    );
  };
  const paginas: Pagina[] = [];

  // 1. Portada
  const portadaPath = p.portada_path || d.fotos.find((f) => f.destacada)?.storage_path;
  paginas.push({
    decorada: true,
    contenido: (
      <div className="flex h-full flex-col">
        {portadaPath && urls[portadaPath] && (
          <div className="h-[125mm] overflow-hidden">
            <img src={urls[portadaPath]} alt="" className="h-full w-full object-cover" onLoad={() => { if (!vistas.has(portadaPath)) { vistas.add(portadaPath); alCargar(); } }} />
          </div>
        )}
        <div className="flex flex-1 flex-col items-center justify-center px-[15mm] text-center">
          <p className="text-[10pt] uppercase tracking-[.35em] opacity-60">{p.subtitulo || nombreTipo(d.evento.tipo)}</p>
          <h1 className="titulo mt-2 text-[40pt] leading-none">{titulo}</h1>
          <p className="titulo mt-2 text-[16pt]">{t.ornamento}</p>
          <p className="mt-1 text-[11pt] opacity-70">{fechaLarga(d.evento.fecha)}</p>
        </div>
      </div>
    ),
  });

  // 2. Dedicatoria
  if (p.dedicatoria) {
    paginas.push({
      contenido: (
        <div className="flex h-full flex-col items-center justify-center px-[30mm] text-center">
          <p className="titulo text-[20pt]">{t.ornamento}</p>
          <p className="mt-6 whitespace-pre-wrap text-[13pt] italic leading-relaxed">{p.dedicatoria}</p>
        </div>
      ),
    });
  }

  // 3. La noche en números
  const participantes = new Set([...d.fotos.map((f) => f.invitado_id), ...d.mensajes.map((m) => m.invitado_id)]);
  paginas.push({
    decorada: true,
    contenido: (
      <div className="flex h-full flex-col items-center justify-center px-[20mm] text-center">
        <h2 className="titulo text-[28pt]">La noche en números</h2>
        <div className="mt-10 grid grid-cols-2 gap-[10mm]">
          {[
            [d.fotos.length, "fotos"],
            [d.mensajes.length, "mensajes"],
            [participantes.size, "invitados participaron"],
            [d.fotos.filter((f) => f.mision_estado === "aprobada").length, "misiones cumplidas"],
          ].map(([n, l]) => (
            <div key={l as string}>
              <p className="titulo text-[36pt] leading-none">{n}</p>
              <p className="text-[10pt] uppercase tracking-widest opacity-70">{l}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  // 4. Capítulos por invitado
  const conContenido = d.invitados.filter((i) => d.fotos.some((f) => f.invitado_id === i.id) || d.mensajes.some((m) => m.invitado_id === i.id));
  if (conContenido.length) {
    paginas.push({
      decorada: true,
      contenido: (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="titulo text-[18pt]">{t.ornamento}</p>
          <h2 className="titulo text-[34pt]">Nuestros invitados</h2>
          <p className="mt-2 text-[11pt] opacity-70">Los recuerdos de cada uno</p>
        </div>
      ),
    });
  }
  for (const inv of conContenido) {
    const susFotos = d.fotos.filter((f) => f.invitado_id === inv.id);
    const susMensajes = d.mensajes.filter((m) => m.invitado_id === inv.id);
    const dedic = susMensajes.filter((m) => m.tipo === "dedicatoria");
    const notas = susMensajes.filter((m) => m.tipo === "nota");
    const cumplidas = d.misiones.filter((mi) => susFotos.some((f) => f.mision_id === mi.id && f.mision_estado === "aprobada"));
    const [primera, ...resto] = [...susFotos.filter((f) => f.destacada), ...susFotos.filter((f) => !f.destacada)];

    paginas.push({
      contenido: (
        <div className="flex h-full">
          <div className="flex w-1/2 flex-col justify-center gap-[5mm] px-[14mm]">
            <div>
              <p className="text-[9pt] uppercase tracking-[.3em] opacity-60">{inv.mesa ? `Mesa ${inv.mesa}` : "Invitado"}</p>
              <h3 className="titulo text-[28pt] leading-tight">{inv.nombre}</h3>
            </div>
            {[...dedic, ...notas].slice(0, 3).map((m) => (
              <p key={m.id} className={`whitespace-pre-wrap leading-snug ${m.tipo === "dedicatoria" ? "text-[11pt] italic" : "text-[10pt] opacity-80"}`}>
                “{m.texto.length > 380 ? m.texto.slice(0, 380) + "…" : m.texto}”
              </p>
            ))}
            {cumplidas.length > 0 && (
              <p className="text-[9pt] opacity-70">🎯 {cumplidas.map((c) => c.titulo).join(" · ")}</p>
            )}
            <p className="text-[9pt] opacity-50">{susFotos.length} foto{susFotos.length === 1 ? "" : "s"}</p>
          </div>
          <div className="w-1/2 p-[8mm]">
            {primera ? (
              <div className="h-full overflow-hidden rounded-[3mm] shadow-lg"><Img f={primera} /></div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[3mm] bg-black/5">
                <p className="titulo text-[60pt]">{t.ornamento}</p>
              </div>
            )}
          </div>
        </div>
      ),
    });
    for (const grupo of paginarFotos(resto)) paginas.push({ contenido: <PaginaFotos fotos={grupo} Img={Img} /> });
  }

  // 5. Misiones
  const conMision = d.misiones
    .map((m) => ({ m, fotos: d.fotos.filter((f) => f.mision_id === m.id && f.mision_estado === "aprobada") }))
    .filter((x) => x.fotos.length);
  if (conMision.length) {
    paginas.push({
      decorada: true,
      contenido: (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <h2 className="titulo text-[34pt]">Misiones cumplidas</h2>
          <p className="mt-2 text-[11pt] opacity-70">{conMision.length} desafíos de la noche</p>
        </div>
      ),
    });
    for (const { m, fotos } of conMision) {
      const elegidas = [...fotos.filter((f) => f.destacada), ...fotos.filter((f) => !f.destacada)].slice(0, 4);
      paginas.push({
        contenido: (
          <div className="flex h-full flex-col p-[12mm]">
            <div className="mb-[5mm] text-center">
              <h3 className="titulo text-[20pt]">🎯 {m.titulo}</h3>
              <p className="text-[9pt] opacity-70">{fotos.length} invitado(s) la cumplieron: {[...new Set(fotos.map((f) => nombre(f.invitado_id)))].slice(0, 8).join(", ")}</p>
            </div>
            <div className="min-h-0 flex-1"><Grilla fotos={elegidas} Img={Img} /></div>
          </div>
        ),
      });
    }
  }

  // 6. Muro de mensajes
  const notas = d.mensajes.filter((m) => m.tipo === "nota");
  trozos(notas, 8).forEach((grupo, i) =>
    paginas.push({
      decorada: i === 0,
      contenido: (
        <div className="flex h-full flex-col p-[14mm]">
          {i === 0 && <h2 className="titulo mb-[6mm] text-center text-[26pt]">Mensajes de la noche</h2>}
          <div className="grid flex-1 grid-cols-2 content-start gap-[5mm]">
            {grupo.map((m) => (
              <div key={m.id} className="rounded-[3mm] bg-white/70 p-[4mm] shadow-sm" style={{ background: "rgb(var(--t-superficie) / .8)" }}>
                <p className="text-[10pt] leading-snug">“{m.texto}”</p>
                <p className="mt-[2mm] text-[8pt] opacity-60">— {nombre(m.invitado_id)} · {hora(m.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    }),
  );

  // 7. Ranking
  if (d.evento.premios_activos && d.ranking.some((r) => r.puntos > 0)) {
    paginas.push({
      decorada: true,
      contenido: <PaginaRanking d={d} t={t} />,
    });
  }

  // 8. Contraportada
  paginas.push({
    decorada: true,
    contenido: (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="titulo text-[30pt]">Gracias</p>
        <p className="titulo text-[16pt]">{t.ornamento}</p>
        <p className="mt-4 text-[11pt] opacity-70">{titulo} · {fechaLarga(d.evento.fecha)}</p>
        {!d.evento.plan_id.startsWith("premium") && <p className="absolute bottom-[10mm] text-[8pt] opacity-40">Hecho con SkyEventos</p>}
      </div>
    ),
  });

  return paginas;
}

type ImgComp = (props: { f: Foto; className?: string }) => ReactNode;

function Grilla({ fotos, Img }: { fotos: Foto[]; Img: ImgComp }) {
  const marco = "overflow-hidden rounded-[2mm] shadow-md";
  if (fotos.length === 1) return <div className={`h-full ${marco}`}><Img f={fotos[0]} /></div>;
  if (fotos.length === 2)
    return (
      <div className="grid h-full grid-cols-2 gap-[4mm]">
        {fotos.map((f) => <div key={f.id} className={marco}><Img f={f} /></div>)}
      </div>
    );
  if (fotos.length === 3)
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-[4mm]">
        <div className={`row-span-2 ${marco}`}><Img f={fotos[0]} /></div>
        <div className={marco}><Img f={fotos[1]} /></div>
        <div className={marco}><Img f={fotos[2]} /></div>
      </div>
    );
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-[4mm]">
      {fotos.slice(0, 4).map((f) => <div key={f.id} className={marco}><Img f={f} /></div>)}
    </div>
  );
}

function PaginaFotos({ fotos, Img }: { fotos: Foto[]; Img: ImgComp }) {
  const conCaption = fotos.find((f) => f.caption);
  return (
    <div className="flex h-full flex-col p-[12mm]">
      <div className="min-h-0 flex-1"><Grilla fotos={fotos} Img={Img} /></div>
      {conCaption && <p className="mt-[3mm] text-center text-[9pt] italic opacity-70">{conCaption.caption}</p>}
    </div>
  );
}

function PaginaRanking({ d, t }: { d: Datos; t: Tematica }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-[25mm]">
      <h2 className="titulo text-[30pt]">Ranking final</h2>
      <p className="titulo mb-[8mm] text-[14pt]">{t.ornamento}</p>
      <ol className="w-full space-y-[3mm]">
        {d.ranking.slice(0, 10).map((r, i) => {
          const premio = d.premios.find((p) => p.puesto === i + 1);
          return (
            <li key={r.invitado_id} className="flex items-center gap-[4mm] rounded-[2mm] px-[4mm] py-[2mm] text-[12pt]" style={{ background: "rgb(var(--t-superficie) / .75)" }}>
              <span className="w-[8mm] text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
              <span className="flex-1 font-semibold">
                {r.nombre}
                {premio && <span className="block text-[8pt] font-normal opacity-70">🎁 {premio.descripcion}</span>}
              </span>
              <span className="font-bold">{r.puntos} pts</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
