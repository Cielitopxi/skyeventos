import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Cargando } from "../../components/ui";
import { APP_URL, asegurarSesion, mensajeError, supabase } from "../../lib/supabase";
import { estiloTematica, tematica } from "../../lib/tematicas";
import type { Anuncio, CategoriaVoto, EventoPublico, FilaRanking, FilaResultado, Foto, Mensaje } from "../../lib/tipos";
import { rankingPorMesa } from "../../lib/formato";
import { urlsFirmadas } from "../../lib/urls";

type Escena =
  | { tipo: "foto"; foto: Foto; nueva: boolean }
  | { tipo: "muro"; fotos: Foto[] }
  | { tipo: "mensajes"; mensajes: Mensaje[] }
  | { tipo: "ranking" }
  | { tipo: "premio"; titulo: string; filas: FilaResultado[] };

const DUR = { foto: 7000, muro: 12000, mensajes: 12000, ranking: 12000, premio: 16000 };

/** Pantalla en vivo para TV o proyector: /pantalla/CODIGO?k=TOKEN */
export default function Pantalla() {
  const { codigo = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("k") ?? "";
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [error, setError] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [ranking, setRanking] = useState<FilaRanking[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [escena, setEscena] = useState<Escena | null>(null);
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [qr, setQr] = useState("");
  const [cursor, setCursor] = useState<boolean>(true);

  const nuevas = useRef<Foto[]>([]);
  const nuevosMensajes = useRef<Mensaje[]>([]);
  const nuevosPremios = useRef<{ titulo: string; filas: FilaResultado[] }[]>([]);
  const indice = useRef(0);
  const vuelta = useRef(0);
  const estado = useRef({ fotos, mensajes, ranking });
  estado.current = { fotos, mensajes, ranking };

  // Conexión
  useEffect(() => {
    (async () => {
      try {
        await asegurarSesion();
        const r = await supabase.rpc("unirse_pantalla", { p_codigo: codigo, p_token: token });
        if (r.error) throw r.error;
        const { data } = await supabase.rpc("evento_por_codigo", { p_codigo: codigo });
        const ev = (data as EventoPublico[])[0];
        setEvento(ev);
        setQr(await QRCode.toDataURL(`${APP_URL}/e/${codigo.toUpperCase()}`, { width: 400, margin: 1 }));
      } catch (e) {
        setError(mensajeError(e));
      }
    })();
  }, [codigo, token]);

  // Datos y tiempo real
  useEffect(() => {
    if (!evento) return;
    const id = evento.id;
    const cargarNombres = () =>
      supabase.from("invitados").select("id, nombre").eq("evento_id", id).then(({ data }) =>
        setNombres(Object.fromEntries((data ?? []).map((x: { id: string; nombre: string }) => [x.id, x.nombre]))),
      );
    const cargarRanking = () => supabase.rpc("ranking", { p_evento: id }).then(({ data }) => setRanking((data as FilaRanking[]) ?? []));
    supabase.from("fotos").select("*").eq("evento_id", id).eq("estado", "aprobada").order("created_at", { ascending: false }).limit(400)
      .then(({ data }) => setFotos((data as Foto[]) ?? []));
    supabase.from("mensajes").select("*").eq("evento_id", id).eq("estado", "aprobada").eq("tipo", "nota").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setMensajes((data as Mensaje[]) ?? []));
    cargarNombres();
    cargarRanking();

    const canal = supabase
      .channel(`pantalla-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos", filter: `evento_id=eq.${id}` }, (p) => {
        if (p.eventType === "DELETE") return setFotos((xs) => xs.filter((x) => x.id !== (p.old as Foto).id));
        const f = p.new as Foto;
        if (f.estado !== "aprobada") return setFotos((xs) => xs.filter((x) => x.id !== f.id));
        setFotos((xs) => {
          const existia = xs.some((x) => x.id === f.id);
          if (!existia) {
            nuevas.current.push(f);
            cargarNombres();
          }
          return existia ? xs.map((x) => (x.id === f.id ? f : x)) : [f, ...xs];
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes", filter: `evento_id=eq.${id}` }, (p) => {
        const m = p.new as Mensaje;
        if (p.eventType === "DELETE" || m.estado !== "aprobada" || m.tipo !== "nota") {
          const quitar = (p.old as Mensaje)?.id ?? m?.id;
          return setMensajes((xs) => xs.filter((x) => x.id !== quitar));
        }
        setMensajes((xs) => {
          if (xs.some((x) => x.id === m.id)) return xs;
          nuevosMensajes.current.push(m);
          return [m, ...xs];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anuncios", filter: `evento_id=eq.${id}` }, (p) => setAnuncio(p.new as Anuncio))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "votacion_categorias", filter: `evento_id=eq.${id}` }, async (p) => {
        // Al revelar una categoría, el ganador pasa al frente de la programación.
        const c = p.new as CategoriaVoto;
        if (c.estado !== "revelada") return;
        const { data } = await supabase.rpc("resultados_votacion", { p_evento: id });
        const filas = ((data as FilaResultado[]) ?? []).filter((r) => r.categoria_id === c.id);
        if (filas.length) nuevosPremios.current.push({ titulo: c.titulo, filas });
      })
      .subscribe();
    const t = setInterval(cargarRanking, 30_000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(t);
    };
  }, [evento]);

  // Firmar URLs de las fotos (completas para el slideshow, miniaturas para el muro)
  useEffect(() => {
    const faltan = fotos.flatMap((f) => [f.storage_path, f.thumb_path]).filter((p) => !urls[p]);
    if (faltan.length) urlsFirmadas(faltan).then((r) => setUrls((u) => ({ ...u, ...r })));
  }, [fotos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anuncios: 12 segundos
  useEffect(() => {
    if (!anuncio) return;
    const t = setTimeout(() => setAnuncio(null), 12_000);
    return () => clearTimeout(t);
  }, [anuncio]);

  // Programación de escenas: fotos nuevas primero, después rotación con muro, mensajes y ranking.
  useEffect(() => {
    if (!evento) return;
    let timer: ReturnType<typeof setTimeout>;
    const siguiente = () => {
      const { fotos, mensajes, ranking } = estado.current;
      let e: Escena | null = null;
      vuelta.current++;
      if (nuevosPremios.current.length) {
        e = { tipo: "premio", ...nuevosPremios.current.shift()! };
      } else if (nuevosMensajes.current.length) {
        e = { tipo: "mensajes", mensajes: nuevosMensajes.current.splice(0, 3) };
      } else if (nuevas.current.length) {
        e = { tipo: "foto", foto: nuevas.current.shift()!, nueva: true };
      } else if (vuelta.current % 9 === 0 && fotos.length >= 6) {
        e = { tipo: "muro", fotos: [...fotos].sort(() => Math.random() - 0.5).slice(0, 12) };
      } else if (vuelta.current % 13 === 0 && mensajes.length) {
        e = { tipo: "mensajes", mensajes: [...mensajes].sort(() => Math.random() - 0.5).slice(0, 3) };
      } else if (vuelta.current % 17 === 0 && evento.premios_activos && ranking.some((r) => r.puntos > 0)) {
        e = { tipo: "ranking" };
      } else if (fotos.length) {
        // las destacadas aparecen más seguido
        const pool = fotos.filter((f) => f.destacada);
        const usarDestacada = pool.length && Math.random() < 0.3;
        const lista = usarDestacada ? pool : fotos;
        indice.current = (indice.current + 1) % lista.length;
        e = { tipo: "foto", foto: lista[indice.current], nueva: false };
      }
      setEscena(e);
      timer = setTimeout(siguiente, e ? DUR[e.tipo] : 3000);
    };
    siguiente();
    return () => clearTimeout(timer);
  }, [evento]);

  // Ocultar el cursor
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mover = () => {
      setCursor(true);
      clearTimeout(t);
      t = setTimeout(() => setCursor(false), 3000);
    };
    window.addEventListener("mousemove", mover);
    mover();
    return () => window.removeEventListener("mousemove", mover);
  }, []);

  const estilo = useMemo(() => estiloTematica(evento?.tematica, evento?.personalizacion), [evento]);

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-8 text-center text-xl text-white">
        No se pudo abrir la pantalla: {error}
      </div>
    );
  if (!evento) return <div className="min-h-screen bg-black"><Cargando texto="Conectando pantalla…" /></div>;

  const t = tematica(evento.tematica);
  const p = evento.personalizacion;

  return (
    <div
      style={{ ...estilo, background: t.fondoDecorado, color: "rgb(var(--t-texto))", fontFamily: "var(--t-font-cuerpo)", cursor: cursor ? "default" : "none" }}
      className="relative flex h-screen w-screen overflow-hidden"
      onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
    >
      <div className="relative flex-1">
        {!escena && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[7vw] leading-none text-tema-acento" style={{ fontFamily: "var(--t-font-titulo)" }}>{p.titulo || evento.nombre}</p>
            <p className="mt-6 text-[2vw] text-tema-suave">Escaneá el QR y compartí tus fotos</p>
          </div>
        )}

        {escena?.tipo === "foto" && (
          <div key={escena.foto.id} className="entrar absolute inset-0 flex items-center justify-center p-[3vh]">
            {urls[escena.foto.storage_path] && (
              <>
                <img src={urls[escena.foto.storage_path]} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
                <img src={urls[escena.foto.storage_path]} alt="" className="relative max-h-full max-w-full rounded-2xl shadow-2xl" />
              </>
            )}
            <div className="absolute bottom-[4vh] left-[3vw] rounded-2xl bg-black/55 px-6 py-3 text-white backdrop-blur">
              {escena.nueva && <p className="text-sm font-bold uppercase tracking-widest text-amber-300">¡Nueva!</p>}
              <p className="text-[2.2vw] font-semibold">📷 {nombres[escena.foto.invitado_id] ?? "Invitado"}</p>
              {escena.foto.caption && <p className="text-[1.4vw]">{escena.foto.caption}</p>}
            </div>
          </div>
        )}

        {escena?.tipo === "muro" && (
          <div className="entrar grid h-full grid-cols-4 grid-rows-3 gap-2 p-3">
            {escena.fotos.map((f, i) => (
              <div key={f.id} className="subir overflow-hidden rounded-xl" style={{ animationDelay: `${i * 80}ms` }}>
                {urls[f.thumb_path] && <img src={urls[f.thumb_path]} alt="" className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
        )}

        {escena?.tipo === "mensajes" && (
          <div className="flex h-full flex-col items-center justify-center gap-[3vh] px-[6vw]">
            {escena.mensajes.map((m, i) => (
              <div key={m.id} className="subir w-full max-w-[70vw] rounded-3xl bg-tema-superficie/90 px-[3vw] py-[3vh] shadow-xl" style={{ animationDelay: `${i * 300}ms` }}>
                <p className="text-[2.6vw] leading-snug">“{m.texto}”</p>
                <p className="mt-2 text-[1.5vw] text-tema-acento">— {nombres[m.invitado_id] ?? "Invitado"}</p>
              </div>
            ))}
          </div>
        )}

        {escena?.tipo === "ranking" && (
          <div className="entrar flex h-full flex-col items-center justify-center">
            <p className="mb-[4vh] text-[4vw] text-tema-acento" style={{ fontFamily: "var(--t-font-titulo)" }}>🏆 Ranking</p>
            <div className="flex items-start gap-[3vw]">
            <ol className={`${rankingPorMesa(ranking).length > 1 ? "w-[34vw]" : "w-[50vw]"} space-y-[1.5vh]`}>
              {ranking.slice(0, 5).map((r, i) => (
                <li key={r.invitado_id} className="subir flex items-center gap-[2vw] rounded-2xl bg-tema-superficie/90 px-[2vw] py-[1.5vh] text-[2.2vw] shadow" style={{ animationDelay: `${i * 150}ms` }}>
                  <span className="w-[3vw] text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                  <span className="flex-1 font-semibold">{r.nombre}</span>
                  <span className="font-bold text-tema-acento">{r.puntos}</span>
                </li>
              ))}
            </ol>
            {rankingPorMesa(ranking).length > 1 && (
              <div className="w-[24vw]">
                <p className="mb-[1.5vh] text-center text-[1.3vw] font-semibold uppercase tracking-[.2em] text-tema-suave">Mesas</p>
                <ol className="space-y-[1.2vh]">
                  {rankingPorMesa(ranking).slice(0, 5).map((m, i) => (
                    <li key={m.mesa} className="subir flex items-center gap-[1.5vw] rounded-2xl border border-tema-acento/30 px-[1.5vw] py-[1.2vh] text-[1.8vw]" style={{ animationDelay: `${(i + 5) * 150}ms` }}>
                      <span className="w-[2.5vw] text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                      <span className="flex-1 font-semibold">Mesa {m.mesa}</span>
                      <span className="font-bold text-tema-acento">{m.puntos}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            </div>
          </div>
        )}

        {escena?.tipo === "premio" && (() => {
          const max = Number(escena.filas[0].votos);
          const ganadores = escena.filas.filter((r) => Number(r.votos) === max);
          const resto = escena.filas.filter((r) => Number(r.votos) < max).slice(0, 2);
          return (
            <div className="entrar flex h-full flex-col items-center justify-center px-[6vw] text-center">
              <p className="text-[1.6vw] font-semibold uppercase tracking-[.3em] text-tema-suave">Premio a</p>
              <p className="mt-[1vh] text-[4.5vw] leading-tight text-tema-acento" style={{ fontFamily: "var(--t-font-titulo)" }}>{escena.titulo}</p>
              <p className="subir mt-[5vh] text-[8vw] leading-none" style={{ animationDelay: "900ms" }}>🏆</p>
              <p className="subir mt-[3vh] text-[5.5vw] font-bold leading-tight" style={{ animationDelay: "1500ms", fontFamily: "var(--t-font-titulo)" }}>
                {ganadores.map((g) => g.nombre).join(" y ")}
              </p>
              <p className="subir mt-[1vh] text-[1.8vw] text-tema-suave" style={{ animationDelay: "1800ms" }}>
                {max} {max === 1 ? "voto" : "votos"}{ganadores.length === 1 && ganadores[0].mesa ? ` · mesa ${ganadores[0].mesa}` : ""}
              </p>
              {resto.length > 0 && (
                <div className="subir mt-[5vh] flex gap-[3vw] text-[1.7vw] text-tema-suave" style={{ animationDelay: "2600ms" }}>
                  {resto.map((r) => (
                    <span key={r.candidato_id}>{r.nombre} · {r.votos}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {anuncio && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-[6vw]">
            <p className="entrar text-center text-[5vw] font-bold leading-tight text-white" style={{ fontFamily: "var(--t-font-titulo)" }}>{anuncio.texto}</p>
          </div>
        )}
      </div>

      <aside className="flex w-[17vw] min-w-[180px] flex-col items-center justify-center gap-[2vh] bg-tema-superficie/85 p-[1.5vw] text-center backdrop-blur">
        <p className="text-[2vw] leading-tight text-tema-acento" style={{ fontFamily: "var(--t-font-titulo)" }}>{p.titulo || evento.nombre}</p>
        <p className="text-[1.1vw] font-semibold">¡Subí tus fotos!</p>
        {qr && <img src={qr} alt="QR" className="w-full rounded-xl bg-white p-2" />}
        <div>
          <p className="text-[.9vw] text-tema-suave">{APP_URL.replace(/^https?:\/\//, "")}/e</p>
          <p className="font-mono text-[2vw] font-bold tracking-[.2em]">{codigo.toUpperCase()}</p>
        </div>
        <p className="text-[.9vw] text-tema-suave">{fotos.length} fotos · {mensajes.length} mensajes</p>
        {cursor && <p className="text-[.8vw] text-tema-suave">Doble clic: pantalla completa</p>}
      </aside>
    </div>
  );
}
