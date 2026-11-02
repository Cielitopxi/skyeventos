import { useState } from "react";
import { Aviso, Campo } from "../../components/ui";
import { VistaPrevia } from "../../components/VistaPrevia";
import { TIPOS_EVENTO } from "../../lib/formato";
import { procesarImagen } from "../../lib/imagen";
import { BUCKET, mensajeError, supabase } from "../../lib/supabase";
import { TEMATICAS, tematica } from "../../lib/tematicas";
import type { Personalizacion } from "../../lib/tipos";
import { useUrls } from "../../lib/urls";
import type { PropsTab } from "./EventoPanel";

const rgbAHex = (rgb: string) =>
  "#" + rgb.split(" ").map((n) => Number(n).toString(16).padStart(2, "0")).join("");

export default function TabPersonalizar({ evento, recargar }: PropsTab) {
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
