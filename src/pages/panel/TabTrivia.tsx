import { useCallback, useEffect, useState } from "react";
import { Aviso, Campo, Modal } from "../../components/ui";
import { mensajeError, supabase } from "../../lib/supabase";
import { preguntasSugeridas } from "../../lib/tematicas";
import type { EstadoTrivia, PreguntaTrivia, ResumenTrivia } from "../../lib/tipos";
import type { PropsTab } from "./EventoPanel";

const ESTADO: Record<EstadoTrivia, { t: string; c: string }> = {
  preparada: { t: "Preparada", c: "bg-slate-100 text-slate-600" },
  abierta: { t: "Abierta", c: "bg-emerald-100 text-emerald-700" },
  cerrada: { t: "Respuesta revelada", c: "bg-sky-100 text-sky-700" },
};

const LETRAS = ["A", "B", "C", "D"];
const vacia = { texto: "", opciones: ["", "", "", ""], correcta: 0, puntos: 10 };

export default function TabTrivia({ evento, plan }: PropsTab) {
  const [preguntas, setPreguntas] = useState<PreguntaTrivia[]>([]);
  const [claves, setClaves] = useState<Record<string, number>>({});
  const [resumen, setResumen] = useState<ResumenTrivia[]>([]);
  const [form, setForm] = useState<typeof vacia | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [p, k, r] = await Promise.all([
      supabase.from("trivia_preguntas").select("*").eq("evento_id", evento.id).order("orden").order("created_at"),
      supabase.from("trivia_claves").select("pregunta_id, correcta").eq("evento_id", evento.id),
      supabase.rpc("trivia_resumen", { p_evento: evento.id }),
    ]);
    setPreguntas((p.data as PreguntaTrivia[]) ?? []);
    setClaves(Object.fromEntries((k.data ?? []).map((x: { pregunta_id: string; correcta: number }) => [x.pregunta_id, x.correcta])));
    setResumen((r.data as ResumenTrivia[]) ?? []);
  }, [evento.id]);

  // Las respuestas no se publican por Realtime: se refrescan cada 10 s.
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 10_000);
    return () => clearInterval(t);
  }, [cargar]);

  if (plan && !plan.misiones) {
    return (
      <div className="tarjeta text-center">
        <p className="text-3xl">❓</p>
        <p className="mt-2 font-semibold">La trivia está incluida desde el plan Fiesta.</p>
      </div>
    );
  }

  async function guardar() {
    if (!form) return;
    setError("");
    // Se descartan las opciones vacías, manteniendo cuál es la correcta.
    const usadas = form.opciones.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
    const correcta = usadas.findIndex((x) => x.i === form.correcta);
    if (!form.texto.trim()) return setError("Escribí la pregunta.");
    if (usadas.length < 2) return setError("Cargá al menos dos opciones.");
    if (correcta < 0) return setError("Marcá una opción completa como correcta.");
    const fila = { evento_id: evento.id, texto: form.texto.trim(), opciones: usadas.map((x) => x.o), puntos: form.puntos };
    const r = editando
      ? await supabase.from("trivia_preguntas").update(fila).eq("id", editando).select("id").single()
      : await supabase.from("trivia_preguntas").insert({ ...fila, orden: preguntas.length }).select("id").single();
    if (r.error) return setError(mensajeError(r.error));
    const k = await supabase.from("trivia_claves").upsert({ pregunta_id: r.data.id, evento_id: evento.id, correcta });
    if (k.error) return setError(mensajeError(k.error));
    setForm(null);
    setEditando(null);
    cargar();
  }

  async function cambiarEstado(p: PreguntaTrivia, estado: EstadoTrivia) {
    setError("");
    const r = await supabase.from("trivia_preguntas").update({ estado }).eq("id", p.id);
    if (r.error) return setError(mensajeError(r.error));
    if (estado === "abierta") await supabase.from("anuncios").insert({ evento_id: evento.id, texto: `❓ Trivia: ${p.texto}` });
    cargar();
  }

  async function borrar(p: PreguntaTrivia) {
    if (!confirm(`¿Borrar la pregunta "${p.texto}" y sus respuestas?`)) return;
    await supabase.from("trivia_preguntas").delete().eq("id", p.id);
    cargar();
  }

  function editar(p: PreguntaTrivia) {
    setEditando(p.id);
    setForm({ texto: p.texto, opciones: [...p.opciones, "", "", ""].slice(0, 4), correcta: claves[p.id] ?? 0, puntos: p.puntos });
  }

  const abierto = evento.estado === "activo" || evento.estado === "cerrado";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-bold">Trivia</h2>
          <button className="btn-primario btn-chico" onClick={() => { setForm({ ...vacia, opciones: [...vacia.opciones] }); setEditando(null); }}>+ Nueva pregunta</button>
        </div>
        <p className="text-sm text-slate-600">
          Preguntas sobre ustedes para los invitados. Abrí cada una en el momento que quieras: se anuncia en la pantalla y cada invitado responde una sola vez. Al
          revelar la respuesta, la pantalla muestra cuántos acertaron y los aciertos suman puntos al ranking.
        </p>
        {error && !form && <Aviso tipo="error">{error}</Aviso>}
        {!preguntas.length && <div className="tarjeta text-center text-slate-500">Sin preguntas todavía.</div>}
        {preguntas.map((p) => {
          const filas = resumen.filter((r) => r.pregunta_id === p.id);
          const total = filas.reduce((s, r) => s + Number(r.respuestas), 0);
          const correcta = claves[p.id];
          return (
            <div key={p.id} className="tarjeta space-y-3 p-4">
              <div className="flex flex-wrap items-start gap-2">
                <p className="mr-auto min-w-0 flex-1 font-semibold">
                  {p.texto} <span className="chip bg-sky-100 text-sky-700">{p.puntos} pts</span>{" "}
                  <span className={`chip ${ESTADO[p.estado].c}`}>{ESTADO[p.estado].t}</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.estado === "preparada" && (
                    <>
                      <button className="btn-primario btn-chico" disabled={!abierto} onClick={() => cambiarEstado(p, "abierta")} title="Se anuncia en la pantalla">Abrir</button>
                      <button className="btn-secundario btn-chico" onClick={() => editar(p)}>Editar</button>
                    </>
                  )}
                  {p.estado === "abierta" && <button className="btn-primario btn-chico" onClick={() => cambiarEstado(p, "cerrada")}>Cerrar y revelar</button>}
                  {p.estado === "cerrada" && <button className="btn-secundario btn-chico" disabled={!abierto} onClick={() => cambiarEstado(p, "abierta")}>Reabrir</button>}
                  <button className="btn-secundario btn-chico text-rose-600" onClick={() => borrar(p)}>Borrar</button>
                </div>
              </div>
              <ul className="space-y-1.5">
                {p.opciones.map((o, i) => {
                  const n = Number(filas.find((r) => r.opcion === i)?.respuestas ?? 0);
                  return (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === correcta ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {i === correcta ? "✓" : LETRAS[i]}
                      </span>
                      <span className="w-40 truncate">{o}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${i === correcta ? "bg-emerald-400" : "bg-sky-300"}`} style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
                      </span>
                      <span className="w-8 text-right text-slate-500">{n}</span>
                    </li>
                  );
                })}
              </ul>
              {total > 0 && <p className="text-xs text-slate-500">{total} respuestas</p>}
            </div>
          );
        })}
      </div>

      <div className="tarjeta h-fit space-y-3">
        <h2 className="font-bold">Ideas de preguntas</h2>
        <div className="flex flex-wrap gap-2">
          {preguntasSugeridas(evento.tipo).map((t) => (
            <button key={t} className="chip bg-slate-100 text-slate-700 hover:bg-sky-100" onClick={() => { setEditando(null); setForm({ ...vacia, opciones: [...vacia.opciones], texto: t }); }}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-slate-500">Tocá una idea y completá las opciones con tu historia.</p>
      </div>

      <Modal abierto={!!form} onCerrar={() => { setForm(null); setError(""); }} titulo={editando ? "Editar pregunta" : "Nueva pregunta"}>
        {form && (
          <div className="space-y-4">
            <Campo label="Pregunta"><input className="input" autoFocus maxLength={200} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} /></Campo>
            <div>
              <span className="etiqueta">Opciones (marcá la correcta)</span>
              <div className="space-y-2">
                {form.opciones.map((o, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input type="radio" name="correcta" checked={form.correcta === i} onChange={() => setForm({ ...form, correcta: i })} />
                    <input
                      className="input"
                      maxLength={80}
                      placeholder={i < 2 ? `Opción ${LETRAS[i]}` : `Opción ${LETRAS[i]} (opcional)`}
                      value={o}
                      onChange={(e) => setForm({ ...form, opciones: form.opciones.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                  </label>
                ))}
              </div>
            </div>
            <Campo label="Puntos por acertar">
              <input className="input" type="number" min={0} max={1000} value={form.puntos} onChange={(e) => setForm({ ...form, puntos: Number(e.target.value) })} />
            </Campo>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <button className="btn-primario w-full" onClick={guardar}>Guardar</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
