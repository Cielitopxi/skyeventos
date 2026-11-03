import { useState } from "react";
import { Aviso, Campo } from "../../components/ui";
import { IconoDuo } from "../../components/Iconos";
import { Instantanea, MARCOS, MuestraMarco } from "../../components/Instantanea";
import { FUENTES_PORTADA, PORTADA_INICIAL, fuentePortada } from "../../components/Portada";
import { VistaPrevia } from "../../components/VistaPrevia";
import { TIPOS_EVENTO } from "../../lib/formato";
import { procesarImagen } from "../../lib/imagen";
import { BUCKET, mensajeError, supabase } from "../../lib/supabase";
import { TEMATICAS, tematica } from "../../lib/tematicas";
import type { DisenoPortada, JuegoId, Personalizacion } from "../../lib/tipos";
import { useUrls } from "../../lib/urls";
import type { PropsTab } from "./EventoPanel";

const JUEGOS: { id: JuegoId; t: string; d: string; i: string; premium?: boolean }[] = [
  { id: "misiones", t: "Misiones fotográficas", d: "Desafíos con puntos y misiones relámpago.", i: "mision" },
  { id: "bingo", t: "Bingo de momentos", d: "Cartón de 3x3 que se completa con fotos.", i: "bingo" },
  { id: "trivia", t: "Trivia personalizada", d: "Preguntas sobre ustedes, con puntos por acertar.", i: "trivia" },
  { id: "votacion", t: "Premios por votación", d: "Categorías con voto secreto y ganador en pantalla.", i: "votar" },
  { id: "capsula", t: "Cápsula del tiempo", d: "Mensajes y fotos sellados que se abren a los 11 meses.", i: "capsula", premium: true },
];

const rgbAHex = (rgb: string) =>
  "#" + rgb.split(" ").map((n) => Number(n).toString(16).padStart(2, "0")).join("");

export default function TabPersonalizar({ evento, plan, recargar }: PropsTab) {
  const [nombre, setNombre] = useState(evento.nombre);
  const [fecha, setFecha] = useState(evento.fecha ?? "");
  const [tipo, setTipo] = useState(evento.tipo);
  const [tematicaId, setTematicaId] = useState(evento.tematica);
  const [moderacion, setModeracion] = useState(evento.moderacion);
  const [premios, setPremios] = useState(evento.premios_activos);
  const [p, setP] = useState<Personalizacion>(evento.personalizacion);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const urls = useUrls([p.portada_path]);

  const set = (k: keyof Personalizacion, v: string) => setP((x) => ({ ...x, [k]: v }));
  const juegoActivo = (j: JuegoId) => p.juegos?.[j] !== false;
  const setJuego = (j: JuegoId, v: boolean) => setP((x) => ({ ...x, juegos: { ...x.juegos, [j]: v } }));
  const diseno = p.portada;
  const setDiseno = (cambios: Partial<DisenoPortada>) => setP((x) => ({ ...x, portada: { ...PORTADA_INICIAL, ...x.portada, ...cambios } }));
  const premiumPortada = !!plan?.portada_personalizada;

  async function subirPortada(f: File | undefined) {
    if (!f) return;
    setSubiendo(true);
    try {
      const img = await procesarImagen(f, 2400);
      const path = `${evento.id}/portada/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, img.completa, { contentType: "image/jpeg" });
      if (error) throw error;
      setP((x) => ({ ...x, portada_path: path }));
    } catch (e) {
      setMsg({ t: "error", m: mensajeError(e) });
    }
    setSubiendo(false);
  }

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    const { error } = await supabase
      .from("eventos")
      .update({ nombre: nombre.trim(), fecha: fecha || null, tipo, tematica: tematicaId, moderacion, premios_activos: premios, personalizacion: p })
      .eq("id", evento.id);
    setGuardando(false);
    if (error) return setMsg({ t: "error", m: mensajeError(error) });
    setMsg({ t: "ok", m: "Cambios guardados." });
    recargar();
  }

  const t = tematica(tematicaId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div className="tarjeta grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Datos del evento</h2>
          <Campo label="Nombre interno"><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
          <Campo label="Fecha"><input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
          <Campo label="Tipo">
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_EVENTO.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Moderación">
            <select className="input" value={moderacion} onChange={(e) => setModeracion(e.target.value as "previa" | "posterior")}>
              <option value="posterior">Posterior: se muestra al instante, puedo ocultar</option>
              <option value="previa">Previa: apruebo antes de que se vea</option>
            </select>
          </Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={premios} onChange={(e) => setPremios(e.target.checked)} />
            Mostrar ranking y premios a los invitados (si lo desactivás, las misiones siguen siendo solo por diversión)
          </label>
        </div>

        <div className="tarjeta space-y-4">
          <h2 className="font-bold">Temática</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMATICAS.map((x) => (
              <button
                key={x.id}
                onClick={() => setTematicaId(x.id)}
                className={`overflow-hidden rounded-xl border-2 ${tematicaId === x.id ? "border-sky-500" : "border-slate-200"}`}
              >
                <div className="flex h-14 items-center justify-center text-lg" style={{ background: x.fondoDecorado, fontFamily: x.fuenteTitulo, color: `rgb(${x.colores.acento})` }}>
                  {x.nombre}
                </div>
              </button>
            ))}
          </div>
          <Campo label="Color principal" ayuda="Pisa el color de acento de la temática.">
            <div className="flex items-center gap-2">
              <input type="color" className="h-10 w-14 cursor-pointer rounded border" value={p.acento || rgbAHex(t.colores.acento)} onChange={(e) => set("acento", e.target.value)} />
              {p.acento && <button className="btn-secundario btn-chico" onClick={() => set("acento", "")}>Usar el de la temática</button>}
            </div>
          </Campo>
        </div>

        <div className="tarjeta grid gap-4">
          <h2 className="font-bold">Textos y portada</h2>
          <Campo label="Título"><input className="input" value={p.titulo ?? ""} maxLength={60} onChange={(e) => set("titulo", e.target.value)} placeholder="Ana & Juan" /></Campo>
          <Campo label="Subtítulo"><input className="input" value={p.subtitulo ?? ""} maxLength={60} onChange={(e) => set("subtitulo", e.target.value)} placeholder="Nuestra boda" /></Campo>
          <Campo label="Mensaje de bienvenida (página de invitados)">
            <textarea className="input" rows={2} maxLength={300} value={p.bienvenida ?? ""} onChange={(e) => set("bienvenida", e.target.value)} placeholder="¡Gracias por acompañarnos! Compartí tus fotos de la noche." />
          </Campo>
          <Campo label="Dedicatoria (primera página del fotolibro)">
            <textarea className="input" rows={3} maxLength={800} value={p.dedicatoria ?? ""} onChange={(e) => set("dedicatoria", e.target.value)} />
          </Campo>
        </div>

        <div className="tarjeta space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="mr-auto font-bold">Diseño de portada</h2>
            <span className="chip bg-sky-100 text-sky-700">Premium</span>
          </div>
          {!premiumPortada ? (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <IconoDuo nombre="candado" className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p>La portada con foto y diseño propio (foto completa, enmarcada, tipografía y velo) está incluida en el plan Premium. Con tu plan se usa la portada de la temática.</p>
            </div>
          ) : (
            <>
              <Campo label="Foto de portada">
                <div className="flex items-center gap-3">
                  {p.portada_path && urls[p.portada_path] && <img src={urls[p.portada_path]} alt="" className="h-16 w-24 rounded-lg object-cover" />}
                  <label className="btn-secundario btn-chico cursor-pointer">
                    {subiendo ? "Subiendo…" : p.portada_path ? "Cambiar" : "Subir foto"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => subirPortada(e.target.files?.[0])} />
                  </label>
                  {p.portada_path && <button className="btn-secundario btn-chico" onClick={() => set("portada_path", "")}>Quitar</button>}
                </div>
              </Campo>
              <div>
                <span className="etiqueta">Composición</span>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "completa", t: "Foto completa", d: "Título sobre la foto" },
                    { id: "marco", t: "Enmarcada", d: "Foto en arco" },
                    { id: "banda", t: "Banda", d: "Foto arriba, título abajo" },
                  ] as const).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setDiseno({ estilo: o.id })}
                      className={`rounded-xl border-2 p-3 text-left text-sm ${(diseno?.estilo ?? "") === o.id ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}
                    >
                      <span className="block font-semibold">{o.t}</span>
                      <span className="text-xs text-slate-500">{o.d}</span>
                    </button>
                  ))}
                </div>
              </div>
              {diseno && (
                <>
                  <div>
                    <span className="etiqueta">Tipografía del título</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {FUENTES_PORTADA.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setDiseno({ fuente: f.id })}
                          className={`rounded-xl border-2 px-3 py-2 text-left ${diseno.fuente === f.id ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}
                        >
                          <span className="block truncate text-xl leading-tight" style={{ fontFamily: f.id === "tema" ? t.fuenteTitulo : fuentePortada(f.id) }}>
                            {p.titulo || nombre || "Ana & Juan"}
                          </span>
                          <span className="text-[11px] text-slate-500">{f.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {diseno.estilo === "completa" && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Campo label="Posición del título">
                        <select className="input" value={diseno.alineacion} onChange={(e) => setDiseno({ alineacion: e.target.value as DisenoPortada["alineacion"] })}>
                          <option value="abajo">Abajo</option>
                          <option value="centro">Centrado</option>
                        </select>
                      </Campo>
                      <Campo label={`Velo sobre la foto (${diseno.oscurecer}%)`}>
                        <input type="range" min={0} max={80} step={5} className="mt-3 w-full" value={diseno.oscurecer} onChange={(e) => setDiseno({ oscurecer: Number(e.target.value) })} />
                      </Campo>
                      <Campo label="Color del título">
                        <input type="color" className="h-10 w-14 cursor-pointer rounded border" value={diseno.color || "#ffffff"} onChange={(e) => setDiseno({ color: e.target.value })} />
                      </Campo>
                    </div>
                  )}
                  {!p.portada_path && <Aviso>Subí una foto para ver la composición elegida.</Aviso>}
                  <button className="text-sm text-slate-500 underline" onClick={() => setP((x) => ({ ...x, portada: undefined }))}>Volver a la portada de la temática</button>
                </>
              )}
            </>
          )}
        </div>

        <div className="tarjeta space-y-4">
          <div>
            <h2 className="font-bold">Marco de foto instantánea</h2>
            <p className="mt-1 text-sm text-slate-600">
              Cada invitado elige si su foto va con marco al subirla. Acá definís cuál aparece sugerido. La foto original no se toca: el marco se ve en la galería, la pantalla y el fotolibro.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6 text-sky-600">
            <MuestraMarco marco={null} activo={!p.marco} onClick={() => setP((x) => ({ ...x, marco: null }))} etiqueta="Sin marco" />
            {MARCOS.map((m) => (
              <MuestraMarco key={m.id} marco={m.id} activo={p.marco === m.id} onClick={() => setP((x) => ({ ...x, marco: m.id }))} etiqueta={m.nombre} />
            ))}
            {p.marco && (
              <Instantanea marco={p.marco} pie={p.titulo || nombre || "Nuestro evento"} inclinar={-2} className="ml-auto w-36">
                <span className="block h-full w-full" style={{ background: t.fondoDecorado }} />
              </Instantanea>
            )}
          </div>
        </div>

        <div className="tarjeta space-y-4">
          <div>
            <h2 className="font-bold">Juegos y desafíos</h2>
            <p className="mt-1 text-sm text-slate-600">Elegí qué juegos ven tus invitados. Los que apagues desaparecen del celular y de la pantalla.</p>
          </div>
          {plan && !plan.misiones ? (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <IconoDuo nombre="candado" className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p>Los juegos están incluidos desde el plan Fiesta.</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {JUEGOS.map((j) => {
                const bloqueado = j.premium && !plan?.capsula;
                const activo = !bloqueado && juegoActivo(j.id);
                return (
                  <label
                    key={j.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${activo ? "border-sky-400 bg-sky-50/60" : "border-slate-200"} ${bloqueado ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activo ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                      <IconoDuo nombre={j.i} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold">
                        {j.t}
                        {j.premium && <span className="chip bg-sky-100 text-sky-700">Premium</span>}
                      </span>
                      <span className="block text-xs text-slate-500">{j.d}</span>
                    </span>
                    <input type="checkbox" className="mt-1 h-4 w-4" disabled={bloqueado} checked={activo} onChange={(e) => setJuego(j.id, e.target.checked)} />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {msg && <Aviso tipo={msg.t}>{msg.m}</Aviso>}
        <button className="btn-primario w-full sm:w-auto" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="etiqueta mb-3 text-center">Vista previa</p>
        <VistaPrevia tematicaId={tematicaId} nombre={nombre} p={p} portadaUrl={p.portada_path ? urls[p.portada_path] : undefined} />
      </aside>
    </div>
  );
}
