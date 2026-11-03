import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Cargando } from "../../components/ui";
import { IconoDuo, Medalla } from "../../components/Iconos";
import { MarcaClip } from "../../components/MarcaClip";
import { giro, Instantanea, PROPORCION_MARCO } from "../../components/Instantanea";
import { fuentePortada } from "../../components/Portada";
import { APP_URL, asegurarSesion, mensajeError, supabase } from "../../lib/supabase";
import { estiloTematica, tematica } from "../../lib/tematicas";
import type { Anuncio, CategoriaVoto, EventoPublico, FilaRanking, FilaResultado, Foto, Mensaje, PreguntaTrivia, ResumenTrivia } from "../../lib/tipos";
import { rankingPorMesa } from "../../lib/formato";
import { urlsFirmadas } from "../../lib/urls";

type Escena =
  | { tipo: "foto"; foto: Foto; nueva: boolean }
  | { tipo: "muro"; fotos: Foto[] }
  | { tipo: "mensajes"; mensajes: Mensaje[] }
  | { tipo: "ranking" }
  | { tipo: "premio"; titulo: string; filas: FilaResultado[] }
  | { tipo: "trivia"; pregunta: PreguntaTrivia; correcta: number; conteo: number[] };

const DUR = { foto: 7000, muro: 12000, mensajes: 12000, ranking: 12000, premio: 16000, trivia: 14000 };

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
  // Sonido de videos y audios: apagado por defecto (activarlo es un clic, que el navegador exige).
  const [sonido, setSonido] = useState(() => {
    try {
      return localStorage.getItem("pantalla-sonido") === "1";
    } catch {
      return false;
    }
  });
  const alternarSonido = () =>
    setSonido((s) => {
      try {
        localStorage.setItem("pantalla-sonido", s ? "0" : "1");
      } catch {
        /* sin almacenamiento: queda solo en esta sesión */
      }
      return !s;
    });

  const nuevas = useRef<Foto[]>([]);
  const nuevosMensajes = useRef<Mensaje[]>([]);
  const nuevosPremios = useRef<{ titulo: string; filas: FilaResultado[] }[]>([]);
  const nuevasTrivias = useRef<{ pregunta: PreguntaTrivia; correcta: number; conteo: number[] }[]>([]);
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
        if (c.estado !== "revelada" || evento.personalizacion.juegos?.votacion === false) return;
        const { data } = await supabase.rpc("resultados_votacion", { p_evento: id });
        const filas = ((data as FilaResultado[]) ?? []).filter((r) => r.categoria_id === c.id);
        if (filas.length) nuevosPremios.current.push({ titulo: c.titulo, filas });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trivia_preguntas", filter: `evento_id=eq.${id}` }, async (p) => {
        // Al cerrar una pregunta se revela la respuesta con cuántos eligieron cada opción.
        const q = p.new as PreguntaTrivia;
        if (q.estado !== "cerrada" || evento.personalizacion.juegos?.trivia === false) return;
        const [k, r] = await Promise.all([
          supabase.from("trivia_claves").select("correcta").eq("pregunta_id", q.id).maybeSingle(),
          supabase.rpc("trivia_resumen", { p_evento: id }),
        ]);
        if (!k.data) return;
        const filas = ((r.data as ResumenTrivia[]) ?? []).filter((x) => x.pregunta_id === q.id);
        const conteo = q.opciones.map((_, i) => Number(filas.find((x) => x.opcion === i)?.respuestas ?? 0));
        nuevasTrivias.current.push({ pregunta: q, correcta: k.data.correcta, conteo });
        cargarRanking();
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
      if (nuevasTrivias.current.length) {
        e = { tipo: "trivia", ...nuevasTrivias.current.shift()! };
      } else if (nuevosPremios.current.length) {
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
      // Los clips se muestran completos (más un respiro al final).
      const dur = e?.tipo === "foto" && e.foto.medio !== "foto" ? Math.max(DUR.foto, (e.foto.duracion ?? 10) * 1000 + 1500) : e ? DUR[e.tipo] : 3000;
      timer = setTimeout(siguiente, dur);
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
  const titulo = p.portada ? fuentePortada(p.portada.fuente) : "var(--t-font-titulo)";

  return (
    <div
      style={{ ...estilo, background: t.fondoDecorado, color: "rgb(var(--t-texto))", fontFamily: "var(--t-font-cuerpo)", cursor: cursor ? "default" : "none" }}
      className="relative flex h-screen w-screen overflow-hidden"
      onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
    >
      <div className="relative flex-1">
        {!escena && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[1.3vw] font-medium uppercase tracking-[.5em] text-tema-suave">Bienvenidos</p>
            <p className="mt-[2vh] text-[7vw] leading-[.95] text-tema-acento" style={{ fontFamily: titulo }}>{p.titulo || evento.nombre}</p>
            <span className="mt-[4vh] h-px w-[8vw] bg-tema-acento/50" />
            <p className="mt-[4vh] text-[1.8vw] font-light tracking-wide text-tema-suave">Escaneá el QR y compartí tus fotos</p>
          </div>
        )}

        {escena?.tipo === "foto" && (
          <div key={escena.foto.id} className="entrar absolute inset-0 flex items-center justify-center p-[3vh]">
            {urls[escena.foto.thumb_path] && escena.foto.medio !== "foto" && (
              <img src={urls[escena.foto.thumb_path]} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
            )}
            {urls[escena.foto.storage_path] && escena.foto.medio === "video" && (
              <video src={urls[escena.foto.storage_path]} autoPlay muted={!sonido} playsInline className="relative max-h-full max-w-full rounded-2xl shadow-2xl" />
            )}
            {urls[escena.foto.storage_path] && escena.foto.medio === "audio" && (
              <div className="relative flex flex-col items-center">
                {urls[escena.foto.thumb_path] && <img src={urls[escena.foto.thumb_path]} alt="" className="h-[60vh] w-[60vh] rounded-[3vh] shadow-2xl" />}
                <span className="absolute -top-[3vh] flex h-[6vh] w-[6vh] items-center justify-center rounded-full bg-tema-acento text-white shadow-xl">
                  <IconoDuo nombre="microfono" className="h-[3vh] w-[3vh]" />
                </span>
                {sonido && <audio src={urls[escena.foto.storage_path]} autoPlay />}
              </div>
            )}
            {urls[escena.foto.storage_path] && escena.foto.medio === "foto" && (
              <>
                <img src={urls[escena.foto.storage_path]} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
                {escena.foto.marco ? (
                  <Instantanea
                    marco={escena.foto.marco}
                    pie={escena.foto.caption || p.titulo || evento.nombre}
                    inclinar={giro(escena.foto.id, 3)}
                    className="relative"
                    style={{ width: `calc(86vh / ${PROPORCION_MARCO})` }}
                  >
                    <img src={urls[escena.foto.storage_path]} alt="" />
                  </Instantanea>
                ) : (
                  <img src={urls[escena.foto.storage_path]} alt="" className="relative max-h-full max-w-full rounded-2xl shadow-2xl" />
                )}
              </>
            )}
            <div className="absolute bottom-[4vh] left-[3vw] max-w-[50vw] rounded-2xl border border-white/10 bg-black/50 px-[1.6vw] py-[1.4vh] text-white shadow-2xl backdrop-blur-md">
              {escena.nueva && <p className="mb-1 text-[.85vw] font-semibold uppercase tracking-[.35em] text-amber-300">Recién llegada</p>}
              <p className="flex items-center gap-[.7vw] text-[2vw] font-medium leading-tight tracking-tight">
                <IconoDuo nombre={escena.foto.medio === "video" ? "video" : escena.foto.medio === "audio" ? "microfono" : "camara"} className="h-[2vw] w-[2vw] shrink-0 opacity-80" />
                {escena.foto.medio === "audio" ? `Mensaje de voz de ${nombres[escena.foto.invitado_id] ?? "un invitado"}` : nombres[escena.foto.invitado_id] ?? "Invitado"}
              </p>
              {escena.foto.caption && !escena.foto.marco && <p className="mt-1 text-[1.4vw] italic leading-snug text-white/85" style={{ fontFamily: titulo }}>{escena.foto.caption}</p>}
            </div>
          </div>
        )}

        {escena?.tipo === "muro" && (
          <div className="entrar grid h-full grid-cols-4 grid-rows-3 gap-2 p-3">
            {escena.fotos.map((f, i) => (
              <div key={f.id} className="subir relative overflow-hidden rounded-xl" style={{ animationDelay: `${i * 80}ms` }}>
                {urls[f.thumb_path] && <img src={urls[f.thumb_path]} alt="" className="h-full w-full object-cover" />}
                <MarcaClip foto={f} className="bottom-2 right-2 text-[.8vw]" />
              </div>
            ))}
          </div>
        )}

        {escena?.tipo === "mensajes" && (
          <div className="flex h-full flex-col items-center justify-center gap-[3vh] px-[6vw]">
            {escena.mensajes.map((m, i) => (
              <div key={m.id} className="subir relative w-full max-w-[70vw] rounded-3xl bg-tema-superficie/90 px-[3.5vw] py-[3.2vh] shadow-xl" style={{ animationDelay: `${i * 300}ms` }}>
                <span className="absolute -top-[2.2vw] left-[1.6vw] text-[6vw] leading-none text-tema-acento/40" style={{ fontFamily: titulo }}>“</span>
                <p className="text-[2.5vw] leading-snug" style={{ fontFamily: titulo }}>{m.texto}</p>
                <p className="mt-[1.2vh] text-[1.15vw] font-semibold uppercase tracking-[.3em] text-tema-acento">{nombres[m.invitado_id] ?? "Invitado"}</p>
              </div>
            ))}
          </div>
        )}

        {escena?.tipo === "ranking" && (
          <div className="entrar flex h-full flex-col items-center justify-center">
            <p className="text-[1.3vw] font-semibold uppercase tracking-[.4em] text-tema-suave">Tabla de posiciones</p>
            <p className="mb-[4vh] mt-[.5vh] flex items-center gap-[1.2vw] text-[4.4vw] leading-none text-tema-acento" style={{ fontFamily: titulo }}>
              <IconoDuo nombre="ranking" className="h-[3.6vw] w-[3.6vw]" trazo={1.3} /> Ranking
            </p>
            <div className="flex items-start gap-[3vw]">
            <ol className={`${rankingPorMesa(ranking).length > 1 ? "w-[34vw]" : "w-[50vw]"} space-y-[1.5vh]`}>
              {ranking.slice(0, 5).map((r, i) => (
                <li key={r.invitado_id} className="subir flex items-center gap-[2vw] rounded-2xl bg-tema-superficie/90 px-[2vw] py-[1.5vh] text-[2.2vw] shadow" style={{ animationDelay: `${i * 150}ms` }}>
                  <span className="flex w-[3vw] justify-center"><Medalla puesto={i + 1} className="h-[2.8vw] w-[2.8vw]" /></span>
                  <span className="flex-1 truncate font-medium tracking-tight">{r.nombre}</span>
                  <span className="font-bold tabular-nums text-tema-acento">{r.puntos}<span className="ml-1 text-[1vw] font-medium text-tema-suave">pts</span></span>
                </li>
              ))}
            </ol>
            {rankingPorMesa(ranking).length > 1 && (
              <div className="w-[24vw]">
                <p className="mb-[1.5vh] text-center text-[1.3vw] font-semibold uppercase tracking-[.2em] text-tema-suave">Mesas</p>
                <ol className="space-y-[1.2vh]">
                  {rankingPorMesa(ranking).slice(0, 5).map((m, i) => (
                    <li key={m.mesa} className="subir flex items-center gap-[1.5vw] rounded-2xl border border-tema-acento/30 px-[1.5vw] py-[1.2vh] text-[1.8vw]" style={{ animationDelay: `${(i + 5) * 150}ms` }}>
                      <span className="flex w-[2.5vw] justify-center"><Medalla puesto={i + 1} className="h-[2.2vw] w-[2.2vw]" /></span>
                      <span className="flex-1 font-medium">Mesa {m.mesa}</span>
                      <span className="font-bold tabular-nums text-tema-acento">{m.puntos}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            </div>
          </div>
        )}

        {escena?.tipo === "trivia" && (() => {
          const total = escena.conteo.reduce((a, b) => a + b, 0);
          const aciertos = escena.conteo[escena.correcta] ?? 0;
          return (
            <div className="entrar flex h-full flex-col items-center justify-center px-[6vw]">
              <p className="flex items-center gap-[.8vw] text-[1.4vw] font-semibold uppercase tracking-[.4em] text-tema-suave">
                <IconoDuo nombre="trivia" className="h-[2vw] w-[2vw] text-tema-acento" /> Trivia
              </p>
              <p className="mt-[1.5vh] max-w-[60vw] text-center text-[3.4vw] leading-tight" style={{ fontFamily: titulo }}>{escena.pregunta.texto}</p>
              <div className="mt-[5vh] w-[52vw] space-y-[1.6vh]">
                {escena.pregunta.opciones.map((o, i) => {
                  const ok = i === escena.correcta;
                  const pct = total ? (escena.conteo[i] / total) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className={`subir relative overflow-hidden rounded-2xl px-[2vw] py-[1.6vh] text-[2vw] shadow ${ok ? "bg-emerald-500 text-white" : "bg-tema-superficie/90"}`}
                      style={{ animationDelay: `${(ok ? 1200 : 0) + i * 150}ms` }}
                    >
                      <span className={`absolute inset-y-0 left-0 ${ok ? "bg-white/20" : "bg-tema-acento/15"}`} style={{ width: `${pct}%` }} />
                      <span className="relative flex items-center gap-[1.5vw]">
                        <span className="flex w-[2vw] justify-center font-bold">{ok ? <IconoDuo nombre="check" className="h-[2vw] w-[2vw]" trazo={2.4} /> : ["A", "B", "C", "D"][i]}</span>
                        <span className="flex-1 font-semibold">{o}</span>
                        <span className="text-[1.5vw] tabular-nums opacity-80">{escena.conteo[i]}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="subir mt-[4vh] text-[1.8vw] text-tema-suave" style={{ animationDelay: "1800ms" }}>
                {total ? `${aciertos} de ${total} acertaron · +${escena.pregunta.puntos} pts para cada uno` : "Nadie respondió esta pregunta"}
              </p>
            </div>
          );
        })()}

        {escena?.tipo === "premio" && (() => {
          const max = Number(escena.filas[0].votos);
          const ganadores = escena.filas.filter((r) => Number(r.votos) === max);
          const resto = escena.filas.filter((r) => Number(r.votos) < max).slice(0, 2);
          return (
            <div className="entrar flex h-full flex-col items-center justify-center px-[6vw] text-center">
              <p className="text-[1.6vw] font-semibold uppercase tracking-[.3em] text-tema-suave">Premio a</p>
              <p className="mt-[1vh] text-[4.5vw] leading-tight text-tema-acento" style={{ fontFamily: titulo }}>{escena.titulo}</p>
              <span className="subir mt-[5vh] flex h-[11vw] w-[11vw] items-center justify-center rounded-full border border-tema-acento/30 bg-tema-acento/10 text-tema-acento shadow-[0_0_80px_rgb(var(--t-acento)/.35)]" style={{ animationDelay: "900ms" }}>
                <IconoDuo nombre="premio" className="h-[6vw] w-[6vw]" trazo={1.2} />
              </span>
              <p className="subir mt-[3vh] text-[5.5vw] leading-tight" style={{ animationDelay: "1500ms", fontFamily: titulo }}>
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
            <div className="entrar text-center text-white">
              <IconoDuo nombre="rayo" className="mx-auto h-[5vw] w-[5vw] text-amber-300" trazo={1.3} />
              <p className="mt-[3vh] text-[4.6vw] leading-tight" style={{ fontFamily: titulo }}>{anuncio.texto.replace(/^⚡\s*/, "")}</p>
            </div>
          </div>
        )}
      </div>

      <aside className="flex w-[17vw] min-w-[180px] flex-col items-center justify-center gap-[2vh] bg-tema-superficie/85 p-[1.5vw] text-center backdrop-blur">
        <p className="text-[2.1vw] leading-[1.05] text-tema-acento" style={{ fontFamily: titulo }}>{p.titulo || evento.nombre}</p>
        <span className="h-px w-[4vw] bg-tema-acento/40" />
        <p className="flex items-center gap-[.5vw] text-[1vw] font-semibold uppercase tracking-[.2em]"><IconoDuo nombre="camara" className="h-[1.3vw] w-[1.3vw] text-tema-acento" /> Subí tus fotos</p>
        {qr && <img src={qr} alt="QR" className="w-full rounded-xl bg-white p-2" />}
        <div>
          <p className="text-[.9vw] text-tema-suave">{APP_URL.replace(/^https?:\/\//, "")}/e</p>
          <p className="font-mono text-[2vw] font-bold tracking-[.2em]">{codigo.toUpperCase()}</p>
        </div>
        <div className="flex gap-[1.5vw] text-tema-suave">
          <p><span className="block text-[1.8vw] font-semibold tabular-nums text-tema-texto">{fotos.length}</span><span className="text-[.75vw] uppercase tracking-[.2em]">fotos</span></p>
          <p><span className="block text-[1.8vw] font-semibold tabular-nums text-tema-texto">{mensajes.length}</span><span className="text-[.75vw] uppercase tracking-[.2em]">mensajes</span></p>
        </div>
        {(cursor || !sonido) && (
          <button
            onClick={alternarSonido}
            onDoubleClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-[.4vw] rounded-full border px-[.8vw] py-[.4vh] text-[.8vw] font-semibold ${sonido ? "border-tema-acento/40 text-tema-acento" : "border-tema-suave/30 text-tema-suave"}`}
          >
            <IconoDuo nombre="microfono" className="h-[1vw] w-[1vw]" /> Sonido de clips: {sonido ? "sí" : "no"}
          </button>
        )}
        {cursor && <p className="text-[.8vw] text-tema-suave">Doble clic: pantalla completa</p>}
      </aside>
    </div>
  );
}
