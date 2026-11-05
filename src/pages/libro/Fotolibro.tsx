import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Cargando } from "../../components/ui";
import { marcoDe } from "../../components/Instantanea";
import { DISENOS, disenoDe, FORMATOS, formatoDe, type DisenoLibro, type FormatoLibro } from "../../lib/libro";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";
import { estiloTematica, tematica } from "../../lib/tematicas";
import type { Evento, FilaRanking, Foto, Invitado, Mensaje, Mision, Premio } from "../../lib/tipos";
import { urlsFirmadas } from "../../lib/urls";
import { armarPaginas, type DatosLibro } from "./PaginasLibro";

/**
 * Fotolibro: el anfitrión elige formato (A4 horizontal por defecto) y diseño, y lo descarga como PDF
 * con la impresión del navegador ("Guardar como PDF"). La elección queda guardada en el evento.
 */
export default function Fotolibro() {
  const { id } = useParams();
  const [datos, setDatos] = useState<DatosLibro | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [formato, setFormato] = useState<FormatoLibro>("a4h");
  const [diseno, setDiseno] = useState<DisenoLibro>("clasico");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ev = await supabase.from("eventos").select("*").eq("id", id!).maybeSingle();
      if (!ev.data) return setError("Evento no encontrado.");
      const evento = ev.data as Evento;
      const [inv, fo, me, mi, ra, pr] = await Promise.all([
        supabase.from("invitados").select("*").eq("evento_id", id!).eq("bloqueado", false).order("nombre"),
        supabase.from("fotos").select("*").eq("evento_id", id!).eq("estado", "aprobada").eq("en_libro", true).order("created_at"),
        supabase.from("mensajes").select("*").eq("evento_id", id!).eq("estado", "aprobada").eq("en_libro", true).order("created_at"),
        supabase.from("misiones").select("*").eq("evento_id", id!).order("orden"),
        supabase.rpc("ranking", { p_evento: id }),
        supabase.from("premios").select("*").eq("evento_id", id!).order("puesto"),
      ]);
      const err = inv.error || fo.error || me.error;
      if (err) return setError(mensajeError(err));
      const p = evento.personalizacion;
      const todas = ((fo.data as Foto[]) ?? []).map((f) => ({ ...f, marco: marcoDe(f, p) }));
      const clips = todas.filter((f) => f.medio !== "foto");
      const QRCode = (await import("qrcode")).default;
      const qrs = Object.fromEntries(
        await Promise.all(clips.map(async (c) => [c.id, await QRCode.toDataURL(`${APP_URL}/c/${c.id}`, { width: 300, margin: 0 })] as const)),
      );
      const d: DatosLibro = {
        evento,
        invitados: (inv.data as Invitado[]) ?? [],
        fotos: todas.filter((f) => f.medio === "foto"),
        clips,
        qrs,
        mensajes: (me.data as Mensaje[]) ?? [],
        misiones: (mi.data as Mision[]) ?? [],
        ranking: (ra.data as FilaRanking[]) ?? [],
        premios: (pr.data as Premio[]) ?? [],
      };
      const paths = [...d.fotos.map((f) => f.storage_path), ...d.clips.map((c) => c.thumb_path)];
      if (p.portada_path) paths.push(p.portada_path);
      setUrls(await urlsFirmadas(paths));
      setFormato(formatoDe(p.libro?.formato));
      setDiseno(disenoDe(p.libro?.diseno));
      setDatos(d);
    })().catch((e) => setError(mensajeError(e)));
  }, [id]);

  /** Guarda la elección en el evento (para la próxima vez y para el PDF del servidor). */
  async function elegir(nuevoFormato: FormatoLibro, nuevoDiseno: DisenoLibro) {
    setFormato(nuevoFormato);
    setDiseno(nuevoDiseno);
    if (!datos) return;
    const personalizacion = { ...datos.evento.personalizacion, libro: { formato: nuevoFormato, diseno: nuevoDiseno } };
    const { error } = await supabase.from("eventos").update({ personalizacion }).eq("id", datos.evento.id);
    if (error) setError(mensajeError(error));
    else setDatos({ ...datos, evento: { ...datos.evento, personalizacion } });
  }

  if (error && !datos) return <div className="p-8"><Aviso tipo="error">{error}</Aviso></div>;
  if (!datos) return <Cargando texto="Armando el fotolibro…" />;

  return (
    <HojasLibro
      datos={datos}
      urls={urls}
      formato={formato}
      diseno={diseno}
      barra={(estado) => (
        <div className="no-imprimir sticky top-0 z-10 border-b border-white/10 bg-noche/95 text-white backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <Link to={`/panel/${id}?tab=libro`} className="btn-chico rounded-full border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">← Volver</Link>
            <p className="mr-auto text-sm text-white/70">{estado}</p>
            <button className="btn-primario" disabled={!estado.startsWith("listo")} onClick={() => window.print()}>Descargar PDF</button>
          </div>
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-3 px-4 pb-3">
            <Selector titulo="Formato" valor={formato} opciones={FORMATOS} onChange={(f) => elegir(f, diseno)} />
            <Selector titulo="Diseño" valor={diseno} opciones={DISENOS} onChange={(x) => elegir(formato, x)} />
          </div>
          <p className="mx-auto max-w-6xl px-4 pb-2 text-xs text-white/50">
            En la ventana de impresión elegí <b>Destino: Guardar como PDF</b>, márgenes <b>Ninguno</b> y activá <b>Gráficos de fondo</b>. Formato {FORMATOS[formato].detalle}.
          </p>
          {error && <div className="mx-auto max-w-6xl px-4 pb-3"><Aviso tipo="error">{error}</Aviso></div>}
        </div>
      )}
    />
  );
}

function Selector<K extends string>({ titulo, valor, opciones, onChange }: { titulo: string; valor: K; opciones: Record<K, { nombre: string; detalle: string }>; onChange: (k: K) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.2em] text-white/50">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(opciones) as K[]).map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            title={opciones[k].detalle}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${valor === k ? "bg-white text-noche shadow-[0_0_0_3px_rgba(56,189,248,.35)]" : "border border-white/20 text-white/80 hover:border-sky-300/60 hover:text-white"}`}
          >
            {opciones[k].nombre} <span className={valor === k ? "text-slate-500" : "text-white/40"}>· {opciones[k].detalle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Las hojas con su tamaño de página. Se usa también para probar el armado con datos de muestra. */
export function HojasLibro({ datos, urls, formato, diseno, barra }: {
  datos: DatosLibro;
  urls: Record<string, string>;
  formato: FormatoLibro;
  diseno: DisenoLibro;
  barra: (estado: string) => React.ReactNode;
}) {
  const vistas = useRef(new Set<string>());
  const [cargadas, setCargadas] = useState(0);
  const alCargar = useCallback((path: string) => {
    if (!vistas.current.has(path)) {
      vistas.current.add(path);
      setCargadas(vistas.current.size);
    }
  }, []);
  const paginas = useMemo(() => armarPaginas(datos, urls, formato, diseno, alCargar), [datos, urls, formato, diseno, alCargar]);
  const f = FORMATOS[formato];
  const t = tematica(datos.evento.tematica);
  const totalImgs = Object.keys(urls).length;
  const listo = cargadas >= totalImgs;
  const fotos = datos.fotos.length;
  const estado = `${listo ? "listo" : `cargando imágenes ${cargadas}/${totalImgs}…`} · ${paginas.length} páginas · ${fotos} foto${fotos === 1 ? "" : "s"}`;
  const estilo = { ...estiloTematica(datos.evento.tematica, datos.evento.personalizacion), ...DISENOS[diseno].vars } as CSSProperties;

  return (
    <div style={estilo} data-diseno={diseno} className="min-h-screen bg-slate-800 print:bg-white">
      <style>{`
        @page { size: ${f.w}mm ${f.h}mm; margin: 0; }
        .pagina { width: ${f.w}mm; height: ${f.h}mm; overflow: hidden; position: relative; break-after: page; page-break-after: always;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; background: rgb(var(--t-fondo)); color: rgb(var(--t-texto));
          font-family: var(--t-font-cuerpo); }
        .titulo { font-family: var(--t-font-titulo); color: rgb(var(--t-acento)); }
        [data-diseno=moderno] .titulo { text-transform: uppercase; letter-spacing: .06em; font-weight: 800; color: rgb(var(--t-texto)); }
        [data-diseno=moderno] .cifra { color: rgb(var(--t-acento)); }
        [data-diseno=minimal] .titulo { font-weight: 400; color: rgb(var(--t-texto)); }
        @media screen { .pagina { margin: 0 auto 10mm; box-shadow: 0 20px 50px rgba(0,0,0,.45); } }
        @media print { .pagina:last-child { break-after: auto; page-break-after: auto; } }
      `}</style>
      {barra(estado)}
      {fotos === 0 && (
        <div className="no-imprimir mx-auto max-w-3xl px-4 pt-6">
          <Aviso tipo="info">No hay fotos marcadas para el libro. En la pestaña Fotolibro del panel, tocá las fotos para incluirlas (o usá “Incluir todas”).</Aviso>
        </div>
      )}
      <div className="overflow-x-auto py-8 print:overflow-visible print:py-0">
        {paginas.map((p, i) => (
          <section key={i} className="pagina" style={{ background: p.decorada ? t.fondoDecorado : undefined }}>
            {p.contenido}
            {i > 0 && i < paginas.length - 1 && <span className="absolute bottom-[6mm] left-0 right-0 text-center text-[8pt] opacity-50">{i + 1}</span>}
          </section>
        ))}
      </div>
    </div>
  );
}
