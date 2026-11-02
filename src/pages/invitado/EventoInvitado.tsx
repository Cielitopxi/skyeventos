import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Cargando, ConTema, Modal } from "../../components/ui";
import { fechaLarga, hora } from "../../lib/formato";
import { asegurarSesion, mensajeError, supabase } from "../../lib/supabase";
import { ColaSubida, type TareaSubida } from "../../lib/subida";
import { estiloTematica, tematica } from "../../lib/tematicas";
import type { EventoPublico, FilaRanking, Foto, Invitado, Mensaje, Mision, Premio } from "../../lib/tipos";
import { useUrls } from "../../lib/urls";

type Pestana = "fotos" | "misiones" | "mensajes" | "ranking" | "yo";

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
  const [tareas, setTareas] = useState<TareaSubida[]>([]);
  const cola = useMemo(() => new ColaSubida(evento.id, invitado.id), [evento.id, invitado.id]);
  const inputCamara = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);
  const [selector, setSelector] = useState(false);

  useEffect(() => cola.suscribir(setTareas), [cola]);

  function elegir(m: Mision | null) {
    setMisionElegida(m);
    setSelector(true);
  }

  function archivos(fs: FileList | null) {
    setSelector(false);
    if (!fs?.length) return;
    cola.agregar([...fs], { misionId: misionElegida?.id });
    setMisionElegida(null);
  }

  const activas = tareas.filter((t) => t.estado !== "listo");
  const errores = tareas.filter((t) => t.estado === "error");
  const listas = tareas.filter((t) => t.estado === "listo").length;

  const pestanas: { id: Pestana; i: string; t: string }[] = [
    { id: "fotos", i: "🖼️", t: "Fotos" },
    { id: "misiones", i: "🎯", t: "Misiones" },
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

      <Modal abierto={selector} onCerrar={() => { setSelector(false); setMisionElegida(null); }} titulo={misionElegida ? `🎯 ${misionElegida.titulo}` : "Subir fotos"}>
        <div className="space-y-3">
          {misionElegida?.descripcion && <p className="text-sm text-tema-suave">{misionElegida.descripcion}</p>}
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

  const medalla = ["🥇", "🥈", "🥉"];
  const yo = filas.findIndex((f) => f.invitado_id === invitado.id);

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
