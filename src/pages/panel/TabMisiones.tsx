import { useCallback, useEffect, useState } from "react";
import { Aviso, Campo, Modal } from "../../components/ui";
import { mensajeError, supabase } from "../../lib/supabase";
import { bingoSugerido, misionesSugeridas } from "../../lib/tematicas";
import type { CasillaBingo, Evento, Mision, Premio } from "../../lib/tipos";
import type { PropsTab } from "./EventoPanel";

const vacia = { titulo: "", descripcion: "", puntos: 10, validacion: "automatica" as "automatica" | "moderador", relampago: false, minutos: 10 };

export default function TabMisiones({ evento, plan }: PropsTab) {
  const [misiones, setMisiones] = useState<Mision[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [form, setForm] = useState<typeof vacia | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevoPremio, setNuevoPremio] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase.from("misiones").select("*").eq("evento_id", evento.id).order("orden").order("created_at"),
      supabase.from("premios").select("*").eq("evento_id", evento.id).order("puesto"),
    ]);
    setMisiones((m.data as Mision[]) ?? []);
    setPremios((p.data as Premio[]) ?? []);
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (plan && !plan.misiones) {
    return (
      <div className="tarjeta text-center">
        <p className="text-3xl">🎯</p>
        <p className="mt-2 font-semibold">Las misiones y premios están incluidos desde el plan Fiesta.</p>
      </div>
    );
  }

  async function guardar() {
    if (!form || !form.titulo.trim()) return;
    setError("");
    const fila = {
      evento_id: evento.id,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      puntos: form.puntos,
      validacion: form.validacion,
      relampago: form.relampago,
    };
    const r = editando
      ? await supabase.from("misiones").update(fila).eq("id", editando)
      : await supabase.from("misiones").insert({ ...fila, orden: misiones.length });
    if (r.error) return setError(mensajeError(r.error));
    setForm(null);
    setEditando(null);
    cargar();
  }

  async function lanzarRelampago(m: Mision, minutos: number) {
    const inicio = new Date();
    const fin = new Date(inicio.getTime() + minutos * 60_000);
    await supabase.from("misiones").update({ relampago: true, inicio: inicio.toISOString(), fin: fin.toISOString() }).eq("id", m.id);
    await supabase.from("anuncios").insert({ evento_id: evento.id, texto: `⚡ Misión relámpago (${minutos} min, puntos dobles): ${m.titulo}` });
    cargar();
  }

  async function borrar(m: Mision) {
    if (!confirm(`¿Borrar la misión "${m.titulo}"? Las fotos quedan, pero sin puntos de misión.`)) return;
    await supabase.from("misiones").delete().eq("id", m.id);
    cargar();
  }

  async function agregarSugeridas() {
    const existentes = new Set(misiones.map((m) => m.titulo));
    const nuevas = misionesSugeridas(evento.tipo)
      .filter((s) => !existentes.has(s.titulo))
      .map((s, i) => ({ evento_id: evento.id, titulo: s.titulo, descripcion: s.descripcion, puntos: s.puntos, orden: misiones.length + i }));
    if (nuevas.length) await supabase.from("misiones").insert(nuevas);
    cargar();
  }

  async function agregarPremio(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoPremio.trim()) return;
    await supabase.from("premios").insert({ evento_id: evento.id, puesto: premios.length + 1, descripcion: nuevoPremio.trim() });
    setNuevoPremio("");
    cargar();
  }

  const ahora = Date.now();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-bold">Misiones</h2>
          <button className="btn-secundario btn-chico" onClick={agregarSugeridas}>+ Agregar sugeridas</button>
          <button className="btn-primario btn-chico" onClick={() => { setForm({ ...vacia }); setEditando(null); }}>+ Nueva misión</button>
        </div>
        <p className="text-sm text-slate-600">
          Puntos: 1 por foto aprobada, 2 por mensaje, y los de cada misión cumplida (dobles si es relámpago). Validación automática: alcanza con subir la foto.
        </p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!misiones.length && <div className="tarjeta text-center text-slate-500">Sin misiones todavía. Probá “Agregar sugeridas”.</div>}
        {misiones.map((m) => {
          const activaRelampago = m.relampago && m.fin && new Date(m.fin).getTime() > ahora;
          return (
            <div key={m.id} className="tarjeta flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {m.titulo} <span className="chip bg-sky-100 text-sky-700">{m.puntos} pts</span>{" "}
                  {m.validacion === "moderador" && <span className="chip bg-slate-100 text-slate-600">valida moderador</span>}{" "}
                  {activaRelampago && <span className="chip bg-amber-100 text-amber-800">⚡ hasta {new Date(m.fin!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>}
                </p>
                {m.descripcion && <p className="text-sm text-slate-600">{m.descripcion}</p>}
              </div>
              <div className="flex flex-wrap gap-1">
                <button className="btn-secundario btn-chico" disabled={evento.estado !== "activo"} onClick={() => lanzarRelampago(m, 10)} title="10 minutos, puntos dobles, se anuncia en pantalla">
                  ⚡ Relámpago 10′
                </button>
                <button
                  className="btn-secundario btn-chico"
                  onClick={() => {
                    setEditando(m.id);
                    setForm({ titulo: m.titulo, descripcion: m.descripcion ?? "", puntos: m.puntos, validacion: m.validacion, relampago: m.relampago, minutos: 10 });
                  }}
                >
                  Editar
                </button>
                <button className="btn-secundario btn-chico text-rose-600" onClick={() => borrar(m)}>Borrar</button>
              </div>
            </div>
          );
        })}

        <CartonBingo evento={evento} />
      </div>

      <div className="tarjeta h-fit space-y-3">
        <h2 className="font-bold">Premios</h2>
        {!evento.premios_activos && <Aviso>El ranking está oculto para los invitados (lo cambiás en Personalizar).</Aviso>}
        <ol className="space-y-2">
          {premios.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold">{p.puesto}</span>
              <span className="flex-1">{p.descripcion}</span>
              <button className="text-slate-400 hover:text-rose-600" onClick={async () => { await supabase.from("premios").delete().eq("id", p.id); cargar(); }}>×</button>
            </li>
          ))}
        </ol>
        <form onSubmit={agregarPremio} className="flex gap-2">
          <input className="input" placeholder={`Premio al puesto ${premios.length + 1}`} value={nuevoPremio} onChange={(e) => setNuevoPremio(e.target.value)} />
          <button className="btn-primario btn-chico shrink-0">Agregar</button>
        </form>
        <p className="text-xs text-slate-500">Sin premios cargados, el juego es solo por diversión.</p>
      </div>

      <Modal abierto={!!form} onCerrar={() => setForm(null)} titulo={editando ? "Editar misión" : "Nueva misión"}>
        {form && (
          <div className="space-y-4">
            <Campo label="Título"><input className="input" autoFocus value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Campo>
            <Campo label="Descripción"><textarea className="input" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Puntos"><input className="input" type="number" min={0} max={1000} value={form.puntos} onChange={(e) => setForm({ ...form, puntos: Number(e.target.value) })} /></Campo>
              <Campo label="Validación">
                <select className="input" value={form.validacion} onChange={(e) => setForm({ ...form, validacion: e.target.value as "automatica" | "moderador" })}>
                  <option value="automatica">Automática</option>
                  <option value="moderador">La valido yo</option>
                </select>
              </Campo>
            </div>
            <button className="btn-primario w-full" onClick={guardar}>Guardar</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Editor del cartón de Bingo de momentos (3x3). El bingo se activa con las 9 casillas completas. */
function CartonBingo({ evento }: { evento: Evento }) {
  const [textos, setTextos] = useState<string[]>(Array(9).fill(""));
  const [guardado, setGuardado] = useState<string[]>(Array(9).fill(""));
  const [estado, setEstado] = useState<"" | "guardando" | "ok">("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("bingo_casillas").select("*").eq("evento_id", evento.id);
    const t = Array(9).fill("");
    ((data as CasillaBingo[]) ?? []).forEach((c) => (t[c.posicion] = c.texto));
    setTextos(t);
    setGuardado(t);
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setError("");
    setEstado("guardando");
    const limpios = textos.map((t) => t.trim().slice(0, 60));
    const filas = limpios.flatMap((texto, posicion) => (texto ? [{ evento_id: evento.id, posicion, texto }] : []));
    const vacias = limpios.flatMap((t, i) => (t ? [] : [i]));
    const r = filas.length ? await supabase.from("bingo_casillas").upsert(filas, { onConflict: "evento_id,posicion" }) : { error: null };
    const b = vacias.length ? await supabase.from("bingo_casillas").delete().eq("evento_id", evento.id).in("posicion", vacias) : { error: null };
    if (r.error || b.error) {
      setEstado("");
      return setError(mensajeError(r.error ?? b.error));
    }
    await cargar();
    setEstado("ok");
  }

  const completas = textos.filter((t) => t.trim()).length;
  const cambios = textos.some((t, i) => t.trim() !== guardado[i]);

  return (
    <div className="tarjeta mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-bold">Bingo de momentos</h2>
        <button className="btn-secundario btn-chico" onClick={() => setTextos(bingoSugerido(evento.tipo))}>Completar con sugeridas</button>
      </div>
      <p className="text-sm text-slate-600">
        Los invitados fotografían cada momento del cartón: 5 pts por casilla, 15 por línea completa y 50 por cartón lleno. Se activa con las 9 casillas.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {textos.map((t, i) => (
          <textarea
            key={i}
            rows={2}
            maxLength={60}
            className="input resize-none text-center text-sm"
            placeholder={`Casilla ${i + 1}`}
            value={t}
            onChange={(e) => {
              setEstado("");
              setTextos(textos.map((x, j) => (j === i ? e.target.value : x)));
            }}
          />
        ))}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primario btn-chico" disabled={!cambios || estado === "guardando"} onClick={guardar}>
          {estado === "guardando" ? "Guardando…" : "Guardar cartón"}
        </button>
        <span className="text-sm text-slate-500">
          {estado === "ok" && !cambios ? "Guardado. " : ""}
          {completas === 9 ? "El bingo está activo para los invitados." : `${completas} de 9 casillas`}
        </span>
      </div>
    </div>
  );
}
