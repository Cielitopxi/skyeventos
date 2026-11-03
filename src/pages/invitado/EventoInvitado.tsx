import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Cargando, ConTema, Modal } from "../../components/ui";
import { fechaLarga, hora, rankingPorMesa } from "../../lib/formato";
import { asegurarSesion, mensajeError, supabase } from "../../lib/supabase";
import { ColaSubida, type TareaSubida } from "../../lib/subida";
import { estiloTematica, tematica } from "../../lib/tematicas";
import type { CasillaBingo, CategoriaVoto, EventoPublico, FilaRanking, FilaResultado, Foto, Invitado, Mensaje, Mision, Premio } from "../../lib/tipos";
import { useUrls } from "../../lib/urls";

type Pestana = "fotos" | "misiones" | "bingo" | "votar" | "mensajes" | "ranking" | "yo";

export default function EventoInvitado() {
  const { codigo = "" } = useParams();
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [premiosActivos, setPremiosActivos] = useState(true);
  const [invitado, setInvitado] = useState<Invitado | null>(null);
  const [estado, setEstado] = useState<"cargando" | "noexiste" | "unirse" | "listo">("cargando");
  const [error, setError] = useState("");

  const iniciar = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("evento_por_codigo", { p_codigo: codigo });
      const ev = (data as EventoPublico[] | null)?.[0];
      if (!ev) return setEstado("noexiste");
      setEvento(ev);
      const sesion = await asegurarSesion();
      const { data: inv } = await supabase.from("invitados").select("*").eq("evento_id", ev.id).eq("user_id", sesion.user.id).maybeSingle();
      if (inv && !inv.bloqueado) {
        setInvitado(inv as Invitado);
        setPremiosActivos(ev.premios_activos);
        setEstado("listo");
      } else {
        if (inv?.bloqueado) setError("Tu acceso a este evento fue bloqueado por los anfitriones.");
        setEstado("unirse");
      }
    } catch (e) {
      setError(mensajeError(e));
      setEstado("unirse");
    }
  }, [codigo]);

  useEffect(() => {
    iniciar();
  }, [iniciar]);

  const estilo = useMemo(() => estiloTematica(evento?.tematica, evento?.personalizacion), [evento]);

  if (estado === "cargando") return <Cargando />;
  if (estado === "noexiste" || !evento)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">🔍</p>
        <p className="text-lg font-semibold">No encontramos un evento activo con el código {codigo.toUpperCase()}</p>
        <Link to="/e" className="btn-primario">Probar otro código</Link>
      </div>
    );

  return (
    <ConTema estilo={estilo} className="min-h-screen">
      {estado === "unirse" ? (
        <Unirse evento={evento} codigo={codigo} error={error} onListo={iniciar} />
      ) : (
        <App evento={evento} invitado={invitado!} setInvitado={setInvitado} premiosActivos={premiosActivos} />
      )}
    </ConTema>
  );
}

function Encabezado({ evento, compacto = false }: { evento: EventoPublico; compacto?: boolean }) {
  const t = tematica(evento.tematica);
  const p = evento.personalizacion;
  const portada = useUrls([p.portada_path]);
  return (
    <div style={{ background: t.fondoDecorado }} className="relative overflow-hidden">
      {p.portada_path && portada[p.portada_path] && !compacto && (
        <img src={portada[p.portada_path]} alt="" className="h-48 w-full object-cover" />
      )}
      <div className={`px-5 text-center ${compacto ? "py-3" : "py-6"}`}>
        {!compacto && <p className="text-xs uppercase tracking-[.3em] text-tema-suave">{p.subtitulo || fechaLarga(evento.fecha)}</p>}
        <h1 className={`${compacto ? "text-2xl" : "text-4xl"} leading-tight text-tema-acento`} style={{ fontFamily: "var(--t-font-titulo)" }}>
          {p.titulo || evento.nombre}
        </h1>
        {!compacto && <p className="mt-1 text-tema-acento">{t.ornamento}</p>}
      </div>
    </div>
  );
}

function Unirse({ evento, codigo, error: errorInicial, onListo }: { evento: EventoPublico; codigo: string; error: string; onListo: () => void }) {
  const [nombre, setNombre] = useState("");
  const [mesa, setMesa] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState(errorInicial);
  const [enviando, setEnviando] = useState(false);

  async function unirse(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await asegurarSesion();
      const { error } = await supabase.rpc("unirse_evento", { p_codigo: codigo, p_nombre: nombre, p_mesa: mesa || null });
      if (error) throw error;
      onListo();
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Encabezado evento={evento} />
      <form onSubmit={unirse} className="space-y-4 px-5 pb-10">
        <p className="text-center text-tema-suave">{evento.personalizacion.bienvenida || "¡Bienvenido! Compartí tus fotos y dejá tu mensaje."}</p>
        <div>
          <label className="etiqueta">Tu nombre</label>
          <input className="input text-base" required maxLength={60} autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Como te conocen los anfitriones" />
        </div>
        <div>
          <label className="etiqueta">Mesa (opcional)</label>
          <input className="input text-base" maxLength={20} value={mesa} onChange={(e) => setMesa(e.target.value)} placeholder="Ej: 7" />
        </div>
        <label className="flex gap-2 text-xs text-tema-suave">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" />
          Acepto que mis fotos y mensajes se muestren en la pantalla del evento y se incluyan en el fotolibro de los anfitriones.
        </label>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <button className="btn-primario w-full py-3.5 text-base" disabled={!nombre.trim() || !acepto || enviando || !evento.abierto}>
          {enviando ? "Entrando…" : "Entrar al evento"}
        </button>
        {!evento.abierto && <Aviso>El evento ya finalizó y no admite más contenido.</Aviso>}
      </form>
    </div>
  );
}

function App({ evento, invitado, setInvitado, premiosActivos }: { evento: EventoPublico; invitado: Invitado; setInvitado: (i: Invitado) => void; premiosActivos: boolean }) {
  const [pestana, setPestana] = useState<Pestana>("fotos");
  const [misionElegida, setMisionElegida] = useState<Mision | null>(null);
  const [casillaElegida, setCasillaElegida] = useState<CasillaBingo | null>(null);
  const [carton, setCarton] = useState<CasillaBingo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaVoto[]>([]);
  const [tareas, setTareas] = useState<TareaSubida[]>([]);
  const cola = useMemo(() => new ColaSubida(evento.id, invitado.id), [evento.id, invitado.id]);
  const inputCamara = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);
  const [selector, setSelector] = useState(false);

  useEffect(() => cola.suscribir(setTareas), [cola]);

  // El cartón se carga acá: la pestaña Bingo aparece solo con las 9 casillas.
  useEffect(() => {
    const cargar = () =>
      supabase.from("bingo_casillas").select("*").eq("evento_id", evento.id).order("posicion").then(({ data }) => setCarton((data as CasillaBingo[]) ?? []));
    cargar();
    const canal = supabase
      .channel(`inv-bingo-${evento.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_casillas", filter: `evento_id=eq.${evento.id}` }, cargar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [evento.id]);

  // Categorías de votación: la pestaña aparece cuando el organizador abre la primera.
  useEffect(() => {
    const cargar = () =>
      supabase.from("votacion_categorias").select("*").eq("evento_id", evento.id).neq("estado", "preparada").order("orden").order("created_at")
        .then(({ data }) => setCategorias((data as CategoriaVoto[]) ?? []));
    cargar();
    const canal = supabase
      .channel(`inv-votacion-${evento.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votacion_categorias", filter: `evento_id=eq.${evento.id}` }, cargar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [evento.id]);

  function elegir(m: Mision | null) {
    setMisionElegida(m);
    setCasillaElegida(null);
    setSelector(true);
  }

  function elegirCasilla(c: CasillaBingo) {
    setMisionElegida(null);
    setCasillaElegida(c);
    setSelector(true);
  }

  function archivos(fs: FileList | null) {
    setSelector(false);
    if (!fs?.length) return;
    cola.agregar([...fs], { misionId: misionElegida?.id, bingoId: casillaElegida?.id });
    setMisionElegida(null);
    setCasillaElegida(null);
  }

  const activas = tareas.filter((t) => t.estado !== "listo");
  const errores = tareas.filter((t) => t.estado === "error");
  const listas = tareas.filter((t) => t.estado === "listo").length;

  const pestanas: { id: Pestana; i: string; t: string }[] = [
    { id: "fotos", i: "🖼️", t: "Fotos" },
    { id: "misiones", i: "🎯", t: "Misiones" },
    ...(carton.length === 9 ? [{ id: "bingo" as Pestana, i: "🎲", t: "Bingo" }] : []),
    ...(categorias.length ? [{ id: "votar" as Pestana, i: "🗳️", t: "Votar" }] : []),
    { id: "mensajes", i: "💬", t: "Mensajes" },
    ...(premiosActivos ? [{ id: "ranking" as Pestana, i: "🏆", t: "Ranking" }] : []),
    { id: "yo", i: "🙂", t: "Yo" },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-md pb-36">
      <Encabezado evento={evento} compacto />
      {!evento.abierto && <div className="px-4 pt-3"><Aviso>El evento finalizó: ya no se pueden subir fotos ni mensajes.</Aviso></div>}

      {(activas.length > 0 || listas > 0) && (
        <div className="mx-4 mt-3 rounded-xl bg-tema-superficie p-3 text-sm shadow">
          {activas.length > 0 ? (
            <p>⏳ Subiendo {activas.length - errores.length} foto(s)… {!navigator.onLine && "(sin conexión, se reintenta sola)"}</p>
          ) : (
            <p>✅ {listas} foto(s) subida(s)</p>
          )}
          {errores.length > 0 && (
            <div className="mt-1 text-rose-600">
              {errores.length} con error: {errores[0].error}{" "}
              <button className="font-semibold underline" onClick={() => cola.reintentar()}>Reintentar</button>
            </div>
          )}
          {activas.length === 0 && <button className="mt-1 text-xs text-tema-suave underline" onClick={() => cola.limpiarListas()}>Ocultar</button>}
        </div>
      )}

      <div className="px-4 pt-4">
        {pestana === "fotos" && <Galeria evento={evento} invitado={invitado} />}
        {pestana === "misiones" && <Misiones evento={evento} invitado={invitado} onCumplir={elegir} />}
        {pestana === "bingo" && <Bingo evento={evento} invitado={invitado} carton={carton} onMarcar={elegirCasilla} />}
        {pestana === "votar" && <Votacion evento={evento} invitado={invitado} categorias={categorias} />}
        {pestana === "mensajes" && <Mensajes evento={evento} invitado={invitado} />}
        {pestana === "ranking" && <Ranking evento={evento} invitado={invitado} />}
        {pestana === "yo" && <Yo evento={evento} invitado={invitado} setInvitado={setInvitado} />}
      </div>

      {evento.abierto && (
        <button
          onClick={() => elegir(null)}
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-tema-acento px-7 py-4 text-base font-bold text-white shadow-xl shadow-black/20 active:scale-95"
        >
          📷 Subir fotos
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-tema-suave/20 bg-tema-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {pestanas.map((p) => (
            <button key={p.id} onClick={() => setPestana(p.id)} className={`flex flex-1 flex-col items-center py-2 text-[11px] font-medium ${pestana === p.id ? "text-tema-acento" : "text-tema-suave"}`}>
              <span className="text-xl">{p.i}</span>
              {p.t}
            </button>
          ))}
        </div>
      </nav>

      <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { archivos(e.target.files); e.target.value = ""; }} />
      <input ref={inputGaleria} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { archivos(e.target.files); e.target.value = ""; }} />

      <Modal abierto={selector} onCerrar={() => { setSelector(false); setMisionElegida(null); setCasillaElegida(null); }}
        titulo={misionElegida ? `🎯 ${misionElegida.titulo}` : casillaElegida ? `🎲 ${casillaElegida.texto}` : "Subir fotos"}
      >
        <div className="space-y-3">
          {misionElegida?.descripcion && <p className="text-sm text-tema-suave">{misionElegida.descripcion}</p>}
          {casillaElegida && <p className="text-sm text-tema-suave">Sacale una foto a este momento para marcar la casilla del bingo.</p>}
          <button className="btn-primario w-full py-4 text-base" onClick={() => inputCamara.current?.click()}>📸 Sacar una foto</button>
          <button className="btn-secundario w-full py-4 text-base" onClick={() => inputGaleria.current?.click()}>🖼️ Elegir de la galería</button>
        </div>
      </Modal>
    </div>
  );
}

function useFotosEvento(eventoId: string) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  useEffect(() => {
    supabase
      .from("fotos")
      .select("*")
      .eq("evento_id", eventoId)
      .neq("estado", "oculta")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setFotos((data as Foto[]) ?? []));
    const canal = supabase
      .channel(`inv-fotos-${eventoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos", filter: `evento_id=eq.${eventoId}` }, (p) => {
        if (p.eventType === "DELETE") return setFotos((xs) => xs.filter((x) => x.id !== (p.old as Foto).id));
        const f = p.new as Foto;
        setFotos((xs) => (f.estado === "oculta" ? xs.filter((x) => x.id !== f.id) : [f, ...xs.filter((x) => x.id !== f.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [eventoId]);
  return [fotos, setFotos] as const;
}

function Galeria({ evento, invitado, soloMias = false }: { evento: EventoPublico; invitado: Invitado; soloMias?: boolean }) {
  const [todas, setFotos] = useFotosEvento(evento.id);
  const fotos = soloMias ? todas.filter((f) => f.invitado_id === invitado.id) : todas;
  const [abierta, setAbierta] = useState<Foto | null>(null);
  const urls = useUrls(fotos.map((f) => f.thumb_path));
  const grande = useUrls([abierta?.storage_path]);

  async function borrar(f: Foto) {
    if (!confirm("¿Borrar esta foto?")) return;
    await supabase.from("fotos").delete().eq("id", f.id);
    await supabase.storage.from("fotos").remove([f.storage_path, f.thumb_path]);
    setFotos((xs) => xs.filter((x) => x.id !== f.id));
    setAbierta(null);
  }

  if (!fotos.length)
    return <p className="py-16 text-center text-tema-suave">{soloMias ? "Todavía no subiste fotos." : "¡Sé el primero en subir una foto! 📸"}</p>;

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {fotos.map((f) => (
          <button key={f.id} onClick={() => setAbierta(f)} className="relative aspect-square overflow-hidden rounded-md bg-tema-suave/10">
            {urls[f.thumb_path] && <img src={urls[f.thumb_path]} alt="" className="h-full w-full object-cover" loading="lazy" />}
            {f.estado === "pendiente" && <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] text-white">En revisión</span>}
          </button>
        ))}
      </div>
      {abierta && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setAbierta(null)}>
          <div className="flex flex-1 items-center justify-center p-2">
            {grande[abierta.storage_path] ? <img src={grande[abierta.storage_path]} alt="" className="max-h-full max-w-full" /> : <Cargando texto="" />}
          </div>
          <div className="flex items-center justify-between p-4 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <span>{hora(abierta.created_at)}</span>
            {abierta.invitado_id === invitado.id && <button className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold" onClick={() => borrar(abierta)}>Borrar</button>}
            <button className="rounded-lg bg-white/20 px-3 py-1.5" onClick={() => setAbierta(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}

function Misiones({ evento, invitado, onCumplir }: { evento: EventoPublico; invitado: Invitado; onCumplir: (m: Mision) => void }) {
  const [misiones, setMisiones] = useState<Mision[] | null>(null);
  const [mias, setMias] = useState<Foto[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const cargar = () => {
      supabase.from("misiones").select("*").eq("evento_id", evento.id).order("orden").then(({ data }) => setMisiones((data as Mision[]) ?? []));
      supabase.from("fotos").select("*").eq("evento_id", evento.id).eq("invitado_id", invitado.id).not("mision_id", "is", null).then(({ data }) => setMias((data as Foto[]) ?? []));
    };
    cargar();
    const canal = supabase
      .channel(`inv-mis-${evento.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "misiones", filter: `evento_id=eq.${evento.id}` }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos", filter: `invitado_id=eq.${invitado.id}` }, cargar)
      .subscribe();
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(t);
    };
  }, [evento.id, invitado.id]);

  const ahora = Date.now();
  const estadoDe = (m: Mision) => {
    const fs = mias.filter((f) => f.mision_id === m.id);
    if (fs.some((f) => f.mision_estado === "aprobada")) return "cumplida";
    if (fs.some((f) => f.mision_estado === "pendiente")) return "revision";
    return null;
  };
  const disponible = (m: Mision) => (!m.inicio || new Date(m.inicio).getTime() <= ahora) && (!m.fin || new Date(m.fin).getTime() > ahora);

  if (!misiones) return <Cargando />;
  const visibles = misiones.filter((m) => disponible(m) || estadoDe(m));
  const cumplidas = misiones.filter((m) => estadoDe(m) === "cumplida").length;

  if (!misiones.length) return <p className="py-16 text-center text-tema-suave">Los anfitriones todavía no cargaron misiones.</p>;

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-tema-suave">Cumpliste {cumplidas} de {misiones.length} misiones</p>
      {visibles.map((m) => {
        const est = estadoDe(m);
        const relampago = m.relampago && m.fin && new Date(m.fin).getTime() > ahora;
        return (
          <div key={m.id} className={`rounded-2xl bg-tema-superficie p-4 shadow-sm ${relampago ? "ring-2 ring-amber-400" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {relampago && (
                  <p className="text-xs font-bold text-amber-600">⚡ RELÁMPAGO · puntos dobles · quedan {Math.max(0, Math.ceil((new Date(m.fin!).getTime() - ahora) / 60000))} min</p>
                )}
                <p className="font-semibold">{m.titulo}</p>
                {m.descripcion && <p className="text-sm text-tema-suave">{m.descripcion}</p>}
              </div>
              <span className="chip shrink-0 bg-tema-acento/15 text-tema-acento">{m.puntos * (relampago ? 2 : 1)} pts</span>
            </div>
            <div className="mt-3">
              {est === "cumplida" ? (
                <p className="text-sm font-semibold text-emerald-600">✓ ¡Cumplida!</p>
              ) : est === "revision" ? (
                <p className="text-sm text-tema-suave">⏳ En revisión</p>
              ) : evento.abierto ? (
                <button className="btn-primario btn-chico" onClick={() => onCumplir(m)}>📷 Cumplir misión</button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function Bingo({ evento, invitado, carton, onMarcar }: { evento: EventoPublico; invitado: Invitado; carton: CasillaBingo[]; onMarcar: (c: CasillaBingo) => void }) {
  const [mias, setMias] = useState<Foto[] | null>(null);

  useEffect(() => {
    const cargar = () =>
      supabase
        .from("fotos")
        .select("*")
        .eq("evento_id", evento.id)
        .eq("invitado_id", invitado.id)
        .not("bingo_id", "is", null)
        .neq("estado", "oculta")
        .order("created_at", { ascending: false })
        .then(({ data }) => setMias((data as Foto[]) ?? []));
    cargar();
    const canal = supabase
      .channel(`inv-bingo-fotos-${invitado.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos", filter: `invitado_id=eq.${invitado.id}` }, cargar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [evento.id, invitado.id]);

  // La foto más reciente de cada casilla (la consulta viene ordenada de nueva a vieja).
  const porCasilla = useMemo(() => {
    const m = new Map<string, Foto>();
    (mias ?? []).forEach((f) => !m.has(f.bingo_id!) && m.set(f.bingo_id!, f));
    return m;
  }, [mias]);
  const urls = useUrls([...porCasilla.values()].map((f) => f.thumb_path));

  if (!mias) return <Cargando />;
  const marcadas = new Set(carton.filter((c) => porCasilla.has(c.id)).map((c) => c.posicion));
  const lineas = LINEAS.filter((l) => l.every((p) => marcadas.has(p)));
  const enLinea = new Set(lineas.flat());
  const lleno = marcadas.size === 9;
  const puntos = marcadas.size * 5 + lineas.length * 15 + (lleno ? 50 : 0);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-tema-suave">
          {lleno ? "🎉 ¡Cartón lleno!" : lineas.length ? `¡${lineas.length === 1 ? "Línea" : `${lineas.length} líneas`}!` : "Fotografiá cada momento para marcar tu cartón"}
        </p>
        <p className="mt-1 text-2xl font-bold" style={{ fontFamily: "var(--t-font-titulo)" }}>{puntos} pts</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {carton.map((c) => {
          const f = porCasilla.get(c.id);
          const url = f && urls[f.thumb_path];
          return (
            <button
              key={c.id}
              disabled={!evento.abierto}
              onClick={() => onMarcar(c)}
              className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl p-2 text-center text-[13px] font-semibold leading-tight shadow-sm transition active:scale-95 ${
                f ? "bg-tema-acento text-white" : "border-2 border-dashed border-tema-suave/30 bg-tema-superficie"
              } ${enLinea.has(c.posicion) ? "ring-[3px] ring-amber-400" : ""}`}
            >
              {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              {f && <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />}
              <span className={f ? "relative mt-auto drop-shadow" : ""}>{c.texto}</span>
              {f && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] text-emerald-600">✓</span>}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-tema-suave">5 pts por casilla · 15 por línea · 50 por cartón lleno</p>
    </div>
  );
}

function Votacion({ evento, invitado, categorias }: { evento: EventoPublico; invitado: Invitado; categorias: CategoriaVoto[] }) {
  const [candidatos, setCandidatos] = useState<Pick<Invitado, "id" | "nombre" | "mesa">[] | null>(null);
  const [misVotos, setMisVotos] = useState<Record<string, string>>({});
  const [resultados, setResultados] = useState<FilaResultado[]>([]);
  const [eligiendo, setEligiendo] = useState<CategoriaVoto | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("invitados").select("id, nombre, mesa").eq("evento_id", evento.id).eq("bloqueado", false).neq("id", invitado.id).order("nombre")
      .then(({ data }) => setCandidatos(data ?? []));
    supabase.from("votos").select("categoria_id, candidato_id").eq("evento_id", evento.id)
      .then(({ data }) => setMisVotos(Object.fromEntries((data ?? []).map((v: { categoria_id: string; candidato_id: string }) => [v.categoria_id, v.candidato_id]))));
  }, [evento.id, invitado.id]);

  // Los resultados se piden de nuevo cada vez que cambia el estado de alguna categoría.
  const clave = categorias.map((c) => c.id + c.estado).join();
  useEffect(() => {
    if (!categorias.some((c) => c.estado === "revelada")) return setResultados([]);
    supabase.rpc("resultados_votacion", { p_evento: evento.id }).then(({ data }) => setResultados((data as FilaResultado[]) ?? []));
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  async function votar(candidato: string) {
    if (!eligiendo) return;
    setError("");
    const { error } = await supabase.rpc("votar", { p_categoria: eligiendo.id, p_candidato: candidato });
    if (error) return setError(mensajeError(error));
    setMisVotos((v) => ({ ...v, [eligiendo.id]: candidato }));
    setEligiendo(null);
    setBusqueda("");
  }

  if (!candidatos) return <Cargando />;
  const nombreDe = (id: string) => candidatos.find((c) => c.id === id)?.nombre ?? "—";
  const filtrados = candidatos.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-tema-suave">Un voto por categoría. Es secreto y lo podés cambiar mientras la votación siga abierta.</p>
      {categorias.map((c) => {
        const filas = resultados.filter((r) => r.categoria_id === c.id);
        const max = Math.max(0, ...filas.map((r) => Number(r.votos)));
        const ganadores = filas.filter((r) => Number(r.votos) === max && max > 0);
        const voto = misVotos[c.id];
        return (
          <div key={c.id} className={`rounded-2xl bg-tema-superficie p-4 shadow-sm ${c.estado === "abierta" ? "ring-2 ring-tema-acento/40" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-tema-suave">
              {c.estado === "abierta" ? "Votación abierta" : c.estado === "cerrada" ? "Votación cerrada" : "🏆 Ganador"}
            </p>
            <p className="mt-0.5 text-lg font-semibold" style={{ fontFamily: "var(--t-font-titulo)" }}>{c.titulo}</p>
            {c.estado === "revelada" ? (
              ganadores.length ? (
                <p className="mt-2 text-base font-bold text-tema-acento">
                  {ganadores.map((g) => g.nombre).join(" y ")} <span className="text-sm font-normal text-tema-suave">· {max} {max === 1 ? "voto" : "votos"}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-tema-suave">Sin votos</p>
              )
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <p className="flex-1 text-sm text-tema-suave">
                  {voto ? <>Tu voto: <b className="text-tema-texto">{nombreDe(voto)}</b></> : c.estado === "abierta" ? "Todavía no votaste" : "No votaste"}
                </p>
                {c.estado === "abierta" && evento.abierto && (
                  <button className={voto ? "btn-secundario btn-chico" : "btn-primario btn-chico"} onClick={() => setEligiendo(c)}>{voto ? "Cambiar" : "Votar"}</button>
                )}
              </div>
            )}
            {c.estado === "cerrada" && <p className="mt-2 text-xs text-tema-suave">El resultado se revela pronto en la pantalla 👀</p>}
          </div>
        );
      })}

      <Modal abierto={!!eligiendo} onCerrar={() => { setEligiendo(null); setBusqueda(""); setError(""); }} titulo={eligiendo ? `🗳️ ${eligiendo.titulo}` : ""}>
        <div className="space-y-3">
          <input className="input text-base" placeholder="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {filtrados.map((c) => (
              <button
                key={c.id}
                onClick={() => votar(c.id)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-tema-suave/10 ${eligiendo && misVotos[eligiendo.id] === c.id ? "bg-tema-acento/10 font-semibold" : ""}`}
              >
                <span>{c.nombre}</span>
                {c.mesa && <span className="text-xs text-tema-suave">mesa {c.mesa}</span>}
              </button>
            ))}
            {!filtrados.length && <p className="py-6 text-center text-sm text-tema-suave">{candidatos.length ? "No hay nadie con ese nombre" : "Todavía no hay otros invitados"}</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Mensajes({ evento, invitado }: { evento: EventoPublico; invitado: Invitado }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"nota" | "dedicatoria">("nota");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from("mensajes").select("*").eq("evento_id", evento.id).neq("estado", "oculta").order("created_at", { ascending: false }).limit(200),
      supabase.from("invitados").select("id, nombre").eq("evento_id", evento.id),
    ]);
    setMensajes((m.data as Mensaje[]) ?? []);
    setNombres(Object.fromEntries((i.data ?? []).map((x: { id: string; nombre: string }) => [x.id, x.nombre])));
  }, [evento.id]);

  useEffect(() => {
    cargar();
    const canal = supabase
      .channel(`inv-msg-${evento.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes", filter: `evento_id=eq.${evento.id}` }, cargar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargar, evento.id]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.from("mensajes").insert({ evento_id: evento.id, invitado_id: invitado.id, texto: texto.trim(), tipo });
    if (error) return setError(mensajeError(error));
    setTexto("");
    setOk(tipo === "dedicatoria" ? "¡Gracias! Tu dedicatoria va a estar en el fotolibro." : "¡Mensaje enviado!");
    setTimeout(() => setOk(""), 3000);
    cargar();
  }

  return (
    <div className="space-y-4">
      {evento.abierto && (
        <form onSubmit={enviar} className="space-y-2 rounded-2xl bg-tema-superficie p-4 shadow-sm">
          <div className="flex gap-1 rounded-xl bg-tema-suave/10 p-1 text-sm">
            {(["nota", "dedicatoria"] as const).map((x) => (
              <button key={x} type="button" onClick={() => setTipo(x)} className={`flex-1 rounded-lg py-1.5 font-medium ${tipo === x ? "bg-tema-superficie shadow" : "text-tema-suave"}`}>
                {x === "nota" ? "💬 Mensaje en vivo" : "✍️ Dedicatoria"}
              </button>
            ))}
          </div>
          <textarea
            className="input text-base"
            rows={tipo === "dedicatoria" ? 5 : 3}
            maxLength={tipo === "dedicatoria" ? 600 : 200}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={tipo === "dedicatoria" ? "Unas palabras para los anfitriones (va al fotolibro)" : "¡Se ve en la pantalla!"}
          />
          {error && <Aviso tipo="error">{error}</Aviso>}
          {ok && <Aviso tipo="ok">{ok}</Aviso>}
          <button className="btn-primario w-full" disabled={!texto.trim()}>Enviar</button>
        </form>
      )}
      {mensajes.map((m) => (
        <div key={m.id} className="rounded-2xl bg-tema-superficie p-4 shadow-sm">
          <p className="whitespace-pre-wrap">{m.texto}</p>
          <p className="mt-1 text-xs text-tema-suave">
            — {nombres[m.invitado_id] ?? "Invitado"} · {hora(m.created_at)} {m.estado === "pendiente" && "· en revisión"}
          </p>
        </div>
      ))}
    </div>
  );
}

function Ranking({ evento, invitado }: { evento: EventoPublico; invitado: Invitado }) {
  const [filas, setFilas] = useState<FilaRanking[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  useEffect(() => {
    const cargar = () => supabase.rpc("ranking", { p_evento: evento.id }).then(({ data }) => setFilas((data as FilaRanking[]) ?? []));
    cargar();
    supabase.from("premios").select("*").eq("evento_id", evento.id).order("puesto").then(({ data }) => setPremios((data as Premio[]) ?? []));
    const t = setInterval(cargar, 20_000);
    return () => clearInterval(t);
  }, [evento.id]);

  const [vista, setVista] = useState<"personas" | "mesas">("personas");
  const medalla = ["🥇", "🥈", "🥉"];
  const yo = filas.findIndex((f) => f.invitado_id === invitado.id);
  const mesas = rankingPorMesa(filas);
  const miMesa = invitado.mesa?.trim().toLowerCase();

  return (
    <div className="space-y-4">
      {premios.length > 0 && (
        <div className="rounded-2xl bg-tema-acento/10 p-4">
          <p className="mb-2 font-semibold">🎁 Premios</p>
          {premios.map((p) => (
            <p key={p.id} className="text-sm">{medalla[p.puesto - 1] ?? `${p.puesto}°`} {p.descripcion}</p>
          ))}
        </div>
      )}
      {mesas.length > 1 && (
        <div className="mx-auto flex w-fit rounded-full bg-tema-suave/10 p-1 text-sm font-semibold">
          {(["personas", "mesas"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`rounded-full px-4 py-1.5 transition ${vista === v ? "bg-tema-superficie text-tema-texto shadow-sm" : "text-tema-suave"}`}>
              {v === "personas" ? "Personas" : "Mesas"}
            </button>
          ))}
        </div>
      )}
      {vista === "mesas" && mesas.length > 1 ? (
        <>
          {!miMesa && <p className="text-center text-sm text-tema-suave">Cargá tu mesa en la pestaña <b>Yo</b> para sumar puntos a tu equipo.</p>}
          <ol className="divide-y divide-tema-suave/15 rounded-2xl bg-tema-superficie shadow-sm">
            {mesas.map((m, i) => (
              <li key={m.mesa} className={`flex items-center gap-3 px-4 py-3 ${m.mesa.toLowerCase() === miMesa ? "bg-tema-acento/10" : ""}`}>
                <span className="w-7 text-center text-lg">{medalla[i] ?? i + 1}</span>
                <span className="flex-1 font-medium">Mesa {m.mesa}<span className="text-xs text-tema-suave"> · {m.invitados} {m.invitados === 1 ? "invitado" : "invitados"}</span></span>
                <span className="font-bold">{m.puntos}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
      <>
      {yo >= 0 && <p className="text-center text-sm text-tema-suave">Estás en el puesto <b>{yo + 1}</b> con <b>{filas[yo].puntos}</b> puntos</p>}
      <ol className="divide-y divide-tema-suave/15 rounded-2xl bg-tema-superficie shadow-sm">
        {filas.slice(0, 30).map((f, i) => (
          <li key={f.invitado_id} className={`flex items-center gap-3 px-4 py-3 ${f.invitado_id === invitado.id ? "bg-tema-acento/10" : ""}`}>
            <span className="w-7 text-center text-lg">{medalla[i] ?? i + 1}</span>
            <span className="flex-1 font-medium">{f.nombre}{f.mesa && <span className="text-xs text-tema-suave"> · mesa {f.mesa}</span>}</span>
            <span className="font-bold">{f.puntos}</span>
          </li>
        ))}
      </ol>
      </>
      )}
    </div>
  );
}

function Yo({ evento, invitado, setInvitado }: { evento: EventoPublico; invitado: Invitado; setInvitado: (i: Invitado) => void }) {
  const [nombre, setNombre] = useState(invitado.nombre);
  const [mesa, setMesa] = useState(invitado.mesa ?? "");
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.from("invitados").update({ nombre: nombre.trim(), mesa: mesa.trim() || null }).eq("id", invitado.id).select().single();
    if (data) setInvitado(data as Invitado);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={guardar} className="space-y-3 rounded-2xl bg-tema-superficie p-4 shadow-sm">
        <div>
          <label className="etiqueta">Nombre</label>
          <input className="input text-base" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta">Mesa</label>
          <input className="input text-base" maxLength={20} value={mesa} onChange={(e) => setMesa(e.target.value)} />
        </div>
        <button className="btn-primario w-full" disabled={!nombre.trim()}>{ok ? "¡Guardado!" : "Guardar"}</button>
      </form>
      <h3 className="font-semibold">Mis fotos</h3>
      <Galeria evento={evento} invitado={invitado} soloMias />
    </div>
  );
}
