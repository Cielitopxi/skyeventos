import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icono, Isotipo, Logo } from "../../components/ui";
import { useUsuario } from "../../components/useUsuario";
import { pesos } from "../../lib/formato";
import { supabase } from "../../lib/supabase";
import { TEMATICAS } from "../../lib/tematicas";
import type { Plan } from "../../lib/tipos";

const PASOS = [
  { n: "01", t: "Contratá online", d: "Elegí plan y temática, pagá con Mercado Pago y tu evento queda activo al instante." },
  { n: "02", t: "Personalizá", d: "Colores, textos, portada, misiones y premios. Imprimí los QR para cada mesa." },
  { n: "03", t: "Viví la noche", d: "Los invitados suben fotos y mensajes desde el celular y aparecen en la pantalla." },
  { n: "04", t: "Recibí tu fotolibro", d: "Al final, un libro con todas las fotos y dedicatorias, ordenado por invitado." },
];

const FUNCIONES: { i: string; t: string; d: string; pronto?: boolean; premium?: boolean }[] = [
  { i: "qr", t: "Álbum en vivo", d: "Las fotos de los invitados llegan por QR. Vos decidís si se publican directo o con aprobación." },
  { i: "pantalla", t: "Pantalla del evento", d: "Presentación automática de fotos, mensajes y ranking para el televisor o el proyector." },
  { i: "diana", t: "Misiones fotográficas", d: "“Una foto con alguien que conociste hoy”, “El mejor paso de baile”, “Tres generaciones juntas”." },
  { i: "mesas", t: "Competencia por mesas", d: "Cada mesa es un equipo y suma los puntos de sus invitados. Ideal para que todos participen." },
  { i: "mensaje", t: "Muro de dedicatorias", d: "Mensajes en vivo que después quedan en el fotolibro junto a las fotos." },
  { i: "libro", t: "Fotolibro 21 × 21", d: "Con la estética de tu evento, listo para imprimir o compartir." },
  { i: "bingo", t: "Bingo de momentos", d: "Un cartón de 3x3 que se completa con fotos: brindis, abrazo, selfie grupal, baile y torta. Línea y cartón lleno suman puntos." },
  { i: "trivia", t: "Trivia personalizada", d: "Preguntas sobre los protagonistas que se responden desde el celular; la pantalla revela la respuesta y quién acertó." },
  { i: "premio", t: "Premios por votación", d: "“Mejor look”, “Alma de la fiesta”: cada invitado vota en secreto y el ganador se revela en la pantalla." },
  { i: "capsula", t: "Cápsula del tiempo", d: "Mensajes y fotos de los invitados, sellados un año. A los 11 meses les llega el aviso para abrirla.", premium: true },
];

// Tonos cálidos que imitan fotos en la maqueta del celular
const FOTOS_DEMO = [
  "linear-gradient(160deg,#e8c9a8,#8a5a44)",
  "linear-gradient(200deg,#dbe5ee,#6a889e)",
  "linear-gradient(140deg,#c7b6d6,#4a3f6b)",
  "linear-gradient(180deg,#f5d6cf,#a8645a)",
  "linear-gradient(120deg,#d9cbb3,#5c564c)",
  "linear-gradient(220deg,#b9c6d9,#2f3b5c)",
];

export default function Inicio() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const { usuario } = useUsuario();
  useEffect(() => {
    supabase.from("planes").select("*").eq("activo", true).order("orden").then(({ data }) => setPlanes((data as Plan[]) ?? []));
  }, []);

  return (
    <div className="marca min-h-screen bg-marfil text-noche">
      {/* ───────────── Hero ───────────── */}
      <section className="cielo relative overflow-hidden text-white">
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo claro />
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link to="/demo" className="hidden rounded-full px-3 py-2 font-medium text-white/70 transition hover:text-white sm:block">
              Demo
            </Link>
            <a href="#planes" className="hidden rounded-full px-3 py-2 font-medium text-white/70 transition hover:text-white sm:block">
              Planes
            </a>
            <Link to="/e" className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-white/70 transition hover:text-white">
              <span className="sm:hidden">Código</span>
              <span className="hidden sm:inline">Tengo un código</span>
            </Link>
            <Link
              to={usuario ? "/panel" : "/ingresar?volver=/panel"}
              className="whitespace-nowrap rounded-full border border-oro/50 px-4 py-2 font-semibold text-[#dbe5ee] transition hover:border-oro hover:bg-oro/10"
            >
              {usuario ? "Mis eventos" : "Ingresar"}
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-10 md:grid-cols-[1.15fr_1fr] md:pb-32 md:pt-16">
          <div>
            <p className="rotulo text-oro">Bodas · 15 años · Cumpleaños · Corporativos</p>
            <h1 className="mt-6 text-[2.6rem] leading-[1.05] sm:text-5xl md:text-[4rem]">
              Cada momento de tu fiesta, <em className="texto-oro font-normal">contado por tus invitados.</em>
            </h1>
            <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-white/70">
              Fotos y mensajes que llegan por QR, se proyectan en vivo y terminan en un fotolibro con la estética de tu evento.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/contratar"
                className="rounded-full bg-gradient-to-b from-[#dbe5ee] to-[#8fa5b6] px-7 py-3.5 font-semibold text-noche shadow-[0_10px_30px_-10px_rgba(151,168,180,.8)] transition hover:brightness-105"
              >
                Crear mi evento
              </Link>
              <Link to="/demo" className="group flex items-center gap-2 rounded-full px-6 py-3.5 font-semibold text-white/85 ring-1 ring-white/20 transition hover:bg-white/5 hover:ring-white/40">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-oro opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-oro" /></span>
                Probar la demo
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs tracking-wide text-white/50">
              {["Sin apps para los invitados", "Pago con Mercado Pago", "Listo en minutos"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icono nombre="check" className="h-3.5 w-3.5 text-oro" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Maqueta del celular */}
          <div className="relative mx-auto w-full max-w-[19rem]">
            <div className="absolute -inset-10 rounded-full bg-oro/20 blur-3xl" aria-hidden />
            <div className="relative rounded-[2.6rem] bg-gradient-to-b from-[#3a4650] to-[#1a242d] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10">
              <div className="overflow-hidden rounded-[2.1rem]" style={{ background: "radial-gradient(circle at 20% 10%, rgba(151,168,180,.35), transparent 45%), radial-gradient(circle at 85% 90%, rgba(106,136,158,.25), transparent 40%), #f4f6f8" }}>
                <div className="px-6 pb-4 pt-8 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-[.3em] text-[#6a889e]">12 · 12 · 2026</p>
                  <p className="mt-2 text-[2.4rem] italic leading-none text-[#2f4a5a]" style={{ fontFamily: TEMATICAS[0].fuenteTitulo }}>
                    Ana & Juan
                  </p>
                  <p className="mt-2 text-[#6a889e]">❦</p>
                </div>
                <div className="grid grid-cols-3 gap-1 px-2">
                  {FOTOS_DEMO.map((g, i) => (
                    <div key={i} className="aspect-square rounded-[6px]" style={{ background: g }} />
                  ))}
                </div>
                <div className="m-3 mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#4d6170] py-3 text-sm font-semibold text-white">
                  <Icono nombre="camara" className="h-4 w-4" /> Subir fotos
                </div>
              </div>
            </div>
            {/* Tarjetas flotantes */}
            <div className="absolute -left-14 top-24 hidden w-48 rounded-2xl border border-white/10 bg-white/10 p-3 text-xs text-white shadow-2xl backdrop-blur-md lg:block">
              <p className="text-[10px] uppercase tracking-[.2em] text-oro">Mensaje en vivo</p>
              <p className="mt-1 leading-snug text-white/90">“¡Los queremos! Que esta noche no termine nunca.”</p>
              <p className="mt-1 text-white/50">— Lola, mesa 4</p>
            </div>
            <div className="absolute -right-10 bottom-20 hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 py-2 pl-2 pr-4 text-xs text-white shadow-2xl backdrop-blur-md lg:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b from-[#dbe5ee] to-[#8fa5b6] font-display text-sm text-noche">1</span>
              Pepe · 34 pts
            </div>
          </div>
        </div>
        <div className="hilo-oro absolute inset-x-0 bottom-0" />
      </section>

      {/* ───────────── Cómo funciona ───────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="rotulo text-sky-500">Cómo funciona</p>
          <h2 className="mt-4 text-4xl leading-tight md:text-5xl">
            Del primer brindis al <em className="text-sky-500">último recuerdo.</em>
          </h2>
        </div>
        <div className="mt-14 grid gap-10 md:grid-cols-4 md:gap-8">
          {PASOS.map((p) => (
            <div key={p.n} className="border-t border-slate-300/80 pt-6">
              <p className="font-display text-3xl italic text-sky-500">{p.n}</p>
              <h3 className="mt-3 text-xl">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Funciones ───────────── */}
      <section className="border-y border-slate-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="rotulo text-sky-500">Todo incluido</p>
              <h2 className="mt-4 text-4xl leading-tight md:text-5xl">Pensado para que nadie se pierda nada.</h2>
            </div>
            <Link to="/contratar" className="text-sm font-semibold text-sky-600 underline decoration-sky-300 underline-offset-[6px] hover:decoration-sky-500">
              Empezar ahora →
            </Link>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
            {FUNCIONES.map((f) => (
              <div key={f.t} className={`group p-6 transition hover:bg-slate-50 ${f.pronto ? "bg-slate-50/60" : "bg-white"}`}>
                <span className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-300/70 text-sky-500 transition group-hover:border-sky-500">
                    <Icono nombre={f.i} className="h-5 w-5" />
                  </span>
                  {f.pronto && <span className="chip border border-slate-300 text-slate-500">Próximamente</span>}
                  {f.premium && <span className="chip bg-noche text-oro">Premium</span>}
                </span>
                <h3 className="mt-6 text-xl">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Temáticas ───────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="rotulo justify-center text-sky-500">Temáticas</p>
          <h2 className="mt-4 text-4xl leading-tight md:text-5xl">Una estética, en todas partes.</h2>
          <p className="mt-4 text-slate-600">La página de invitados, la pantalla en vivo y el fotolibro comparten el mismo estilo.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEMATICAS.map((t) => (
            <div key={t.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-suave transition duration-300 hover:-translate-y-1 hover:shadow-elevada">
              <div className="relative flex h-44 flex-col items-center justify-center gap-1" style={{ background: t.fondoDecorado }}>
                <span className="text-sm" style={{ color: `rgb(${t.colores.acento})` }}>{t.ornamento}</span>
                <span className="text-4xl" style={{ fontFamily: t.fuenteTitulo, color: `rgb(${t.colores.texto})` }}>{t.nombre}</span>
                <span className="mt-2 flex gap-1.5">
                  {[t.colores.acento, t.colores.acento2, t.colores.suave].map((c) => (
                    <span key={c} className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5" style={{ background: `rgb(${c})` }} />
                  ))}
                </span>
              </div>
              <p className="px-6 py-5 text-sm text-slate-600">{t.descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Planes ───────────── */}
      <section id="planes" className="cielo relative py-24 text-white">
        <div className="hilo-oro absolute inset-x-0 top-0" />
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="rotulo justify-center text-oro">Planes</p>
            <h2 className="mt-4 text-4xl leading-tight md:text-5xl">Un pago único, <em className="texto-oro">sin sorpresas.</em></h2>
          </div>
          <div className="mt-14 grid items-stretch gap-5 md:grid-cols-3">
            {planes.map((p) => {
              const destacado = p.id === "fiesta";
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-3xl p-8 ${
                    destacado
                      ? "bg-marfil text-noche shadow-[0_30px_80px_-30px_rgba(151,168,180,.6)] ring-1 ring-oro md:-my-4 md:py-12"
                      : "border border-white/10 bg-white/[.04] backdrop-blur-sm"
                  }`}
                >
                  {destacado && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#dbe5ee] to-[#8fa5b6] px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-noche">
                      Más elegido
                    </span>
                  )}
                  <h3 className="text-2xl">{p.nombre}</h3>
                  <p className="mt-4 font-display text-4xl font-light tracking-tight">{pesos(p.precio_ars)}</p>
                  <p className={`text-xs ${destacado ? "text-slate-500" : "text-white/45"}`}>pago único por evento</p>
                  <div className={`my-6 h-px ${destacado ? "bg-slate-200" : "bg-white/10"}`} />
                  <ul className={`flex-1 space-y-3 text-sm ${destacado ? "text-slate-700" : "text-white/75"}`}>
                    {[
                      p.max_invitados ? `Hasta ${p.max_invitados} invitados` : "Invitados ilimitados",
                      p.max_fotos ? `${p.max_fotos.toLocaleString("es-AR")} fotos` : "Fotos ilimitadas",
                      `${p.pantallas} pantalla${p.pantallas > 1 ? "s" : ""} en vivo`,
                      p.misiones ? "Juegos: misiones, bingo, trivia y votación" : null,
                      p.clips ? "Videos y audios de 10 segundos, con QR en el fotolibro" : null,
                      "Fotolibro PDF",
                      `Disponible ${Math.round(p.retencion_dias / 30)} meses`,
                      p.sin_marca ? "Sin marca SkyEventos" : null,
                      p.portada_personalizada ? "Portada con diseño personalizado" : null,
                      p.capsula ? "Cápsula del tiempo (guardada 1 año)" : null,
                    ]
                      .filter(Boolean)
                      .map((t) => (
                        <li key={t} className="flex items-start gap-2.5">
                          <Icono nombre="check" className={`mt-0.5 h-4 w-4 shrink-0 ${destacado ? "text-sky-500" : "text-oro"}`} />
                          {t}
                        </li>
                      ))}
                  </ul>
                  <Link
                    to={`/contratar?plan=${p.id}`}
                    className={`mt-8 block rounded-full py-3.5 text-center text-sm font-semibold transition ${
                      destacado ? "bg-noche text-white hover:bg-slate-800" : "text-white ring-1 ring-white/25 hover:bg-white/5 hover:ring-white/50"
                    }`}
                  >
                    Elegir {p.nombre}
                  </Link>
                </div>
              );
            })}
            {!planes.length && <p className="col-span-3 text-center text-white/40">Cargando planes…</p>}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-slate-500 sm:flex-row">
        <span className="flex items-center gap-2">
          <Isotipo className="h-6 w-6" />
          <span className="font-display text-base text-noche">SkyEventos</span>
        </span>
        <span className="text-center sm:text-right">
          © {new Date().getFullYear()} SkyEventos es un servicio de{" "}
          <a href="https://skystudio.ar" target="_blank" rel="noopener" className="font-medium text-noche underline decoration-oro/50 underline-offset-4 hover:decoration-oro">SkyStudio</a>
          {" "}· Hecho en Argentina
        </span>
      </footer>
    </div>
  );
}
