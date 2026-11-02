import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/ui";
import { useUsuario } from "../../components/useUsuario";
import { pesos } from "../../lib/formato";
import { supabase } from "../../lib/supabase";
import { TEMATICAS } from "../../lib/tematicas";
import type { Plan } from "../../lib/tipos";

const PASOS = [
  { n: "1", t: "Contratá online", d: "Elegí plan y temática, pagá con Mercado Pago y tu evento queda activo al instante." },
  { n: "2", t: "Personalizá", d: "Colores, textos, portada, misiones y premios. Imprimí los QR para las mesas." },
  { n: "3", t: "Disfrutá en vivo", d: "Los invitados suben fotos y mensajes desde el celular y aparecen en la pantalla." },
  { n: "4", t: "Recibí tu fotolibro", d: "Al terminar, un PDF con todas las fotos y dedicatorias ordenadas por invitado." },
];

const FUNCIONES = [
  { i: "📷", t: "Fotos por QR", d: "Sin apps ni cuentas: escanean, ponen su nombre y suben." },
  { i: "💬", t: "Mensajes en vivo", d: "Notas y dedicatorias que se proyectan en la pantalla." },
  { i: "📺", t: "Pantalla gigante", d: "Slideshow, muro de fotos, mensajes y ranking en tiempo real." },
  { i: "🎯", t: "Misiones y puntos", d: "Desafíos fotográficos, misiones relámpago y premios." },
  { i: "📖", t: "Fotolibro PDF", d: "Con tu temática, listo para compartir o imprimir." },
  { i: "🛡️", t: "Moderación", d: "Aprobá antes de mostrar o ocultá lo que no va." },
];

export default function Inicio() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const { usuario } = useUsuario();
  useEffect(() => {
    supabase.from("planes").select("*").eq("activo", true).order("orden").then(({ data }) => setPlanes((data as Plan[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/e" className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-slate-100">Tengo un código</Link>
          <Link to={usuario ? "/panel" : "/ingresar?volver=/panel"} className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white">
            {usuario ? "Mis eventos" : "Ingresar"}
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,.25),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(251,191,36,.2),transparent_40%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Bodas · 15 años · Cumpleaños · Corporativos</p>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Todas las fotos de tu fiesta, en vivo y en un fotolibro.
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Tus invitados comparten fotos y mensajes con un QR, se proyectan en pantalla, juegan misiones y al final recibís un fotolibro
              personalizado con todos los recuerdos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/contratar" className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600">
                Crear mi evento
              </Link>
              <a href="#planes" className="rounded-xl border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-50">Ver planes</a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rotate-2 rounded-[2rem] border-8 border-slate-900 bg-slate-900 shadow-2xl">
              <div className="overflow-hidden rounded-[1.4rem]" style={{ background: TEMATICAS[1].fondoDecorado }}>
                <div className="p-6 text-center">
                  <p className="text-4xl text-rose-500" style={{ fontFamily: TEMATICAS[1].fuenteTitulo }}>Ana & Juan</p>
                  <p className="text-xs text-rose-900/60">12 de diciembre</p>
                </div>
                <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                  {["#fda4af", "#fcd34d", "#a5b4fc", "#86efac", "#f9a8d4", "#7dd3fc"].map((c, i) => (
                    <div key={i} className="aspect-square rounded-md" style={{ background: `linear-gradient(135deg, ${c}, #fff)` }} />
                  ))}
                </div>
                <div className="m-3 rounded-xl bg-rose-500 py-3 text-center font-semibold text-white">📷 Subir fotos</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Cómo funciona</h2>
        <div className="grid gap-6 md:grid-cols-4">
          {PASOS.map((p) => (
            <div key={p.n} className="rounded-2xl border border-slate-200 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-white">{p.n}</div>
              <h3 className="font-semibold">{p.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-2 md:grid-cols-3">
          {FUNCIONES.map((f) => (
            <div key={f.t} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-3xl">{f.i}</div>
              <h3 className="mt-2 font-semibold">{f.t}</h3>
              <p className="text-sm text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-2 text-center text-3xl font-bold">Temáticas</h2>
        <p className="mb-8 text-center text-slate-600">La página, la pantalla y el fotolibro usan el mismo estilo.</p>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {TEMATICAS.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex h-28 items-center justify-center" style={{ background: t.fondoDecorado }}>
                <span className="text-3xl" style={{ fontFamily: t.fuenteTitulo, color: `rgb(${t.colores.acento})` }}>
                  {t.ornamento} {t.nombre} {t.ornamento}
                </span>
              </div>
              <p className="p-3 text-sm text-slate-600">{t.descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="planes" className="bg-slate-900 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Planes</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {planes.map((p) => (
              <div key={p.id} className={`rounded-2xl p-6 ${p.id === "fiesta" ? "bg-sky-500 text-white ring-4 ring-sky-300" : "bg-slate-800"}`}>
                {p.id === "fiesta" && <p className="mb-2 text-xs font-bold uppercase tracking-wider">Más elegido</p>}
                <h3 className="text-xl font-bold">{p.nombre}</h3>
                <p className="my-3 text-3xl font-bold">{pesos(p.precio_ars)}</p>
                <ul className="space-y-1.5 text-sm opacity-90">
                  <li>✓ {p.max_invitados ? `Hasta ${p.max_invitados} invitados` : "Invitados ilimitados"}</li>
                  <li>✓ {p.max_fotos ? `${p.max_fotos.toLocaleString("es-AR")} fotos` : "Fotos ilimitadas"}</li>
                  <li>✓ {p.pantallas} pantalla{p.pantallas > 1 ? "s" : ""} en vivo</li>
                  <li>{p.misiones ? "✓ Misiones, puntos y premios" : "— Sin misiones"}</li>
                  <li>✓ Fotolibro PDF</li>
                  <li>✓ Disponible {Math.round(p.retencion_dias / 30)} meses</li>
                  {p.sin_marca && <li>✓ Sin marca SkyEventos</li>}
                </ul>
                <Link
                  to={`/contratar?plan=${p.id}`}
                  className={`mt-6 block rounded-xl py-3 text-center font-semibold ${p.id === "fiesta" ? "bg-white text-sky-600" : "bg-sky-500 text-white"}`}
                >
                  Elegir {p.nombre}
                </Link>
              </div>
            ))}
            {!planes.length && <p className="col-span-3 text-center text-slate-400">Cargando planes…</p>}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} SkyEventos</footer>
    </div>
  );
}
