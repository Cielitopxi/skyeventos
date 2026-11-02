import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Aviso, Campo, Icono, Logo } from "../../components/ui";
import { VistaPrevia } from "../../components/VistaPrevia";
import { pesos, TIPOS_EVENTO } from "../../lib/formato";
import { mensajeError, supabase } from "../../lib/supabase";
import { TEMATICAS } from "../../lib/tematicas";
import type { Evento, Plan } from "../../lib/tipos";

/** Contratación online: datos → temática → plan → pago con Mercado Pago. */
export default function Contratar() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [paso, setPaso] = useState(1);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [tipo, setTipo] = useState("boda");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [tematicaId, setTematicaId] = useState("elegante");
  const [planId, setPlanId] = useState(params.get("plan") || "fiesta");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [creado, setCreado] = useState<Evento | null>(null);

  useEffect(() => {
    supabase.from("planes").select("*").eq("activo", true).order("orden").then(({ data }) => setPlanes((data as Plan[]) ?? []));
  }, []);

  useEffect(() => {
    // al cambiar el tipo, sugerir la primera temática pensada para ese tipo
    const sugerida = TEMATICAS.find((t) => t.tipos.includes(tipo));
    if (sugerida) setTematicaId(sugerida.id);
  }, [tipo]);

  const plan = planes.find((p) => p.id === planId);

  async function pagar() {
    setError("");
    setProcesando(true);
    try {
      let ev = creado;
      if (!ev) {
        const { data, error } = await supabase.rpc("crear_evento", {
          p_nombre: nombre.trim(),
          p_tipo: tipo,
          p_tematica: tematicaId,
          p_plan: planId,
          p_fecha: fecha || null,
          p_personalizacion: { titulo: nombre.trim() },
        });
        if (error) throw error;
        ev = data as Evento;
        setCreado(ev);
      }
      const { data, error } = await supabase.functions.invoke("mp-crear-preferencia", { body: { evento_id: ev.id } });
      if (error) throw new Error("No se pudo iniciar el pago con Mercado Pago. Tu evento quedó guardado: podés pagarlo desde tu panel.");
      window.location.href = (data as { init_point: string }).init_point;
    } catch (e) {
      setError(mensajeError(e));
      setProcesando(false);
    }
  }

  const puedeSeguir = paso === 1 ? nombre.trim().length >= 2 : true;

  return (
    <div className="marca min-h-screen bg-marfil">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-marfil/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <Link to="/panel" className="text-sm font-medium text-slate-600">Mis eventos</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ol className="mb-10 flex items-center">
          {["Tu evento", "Temática", "Plan", "Pago"].map((t, i) => (
            <li key={t} className="flex flex-1 items-center gap-3 last:flex-none">
              <span className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm transition ${
                    paso > i + 1
                      ? "bg-sky-500 text-white"
                      : paso === i + 1
                        ? "bg-noche text-[#f3e3bf] ring-4 ring-sky-200"
                        : "border border-slate-300 text-slate-400"
                  }`}
                >
                  {paso > i + 1 ? <Icono nombre="check" className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`hidden text-xs font-semibold uppercase tracking-[.14em] sm:inline ${paso >= i + 1 ? "text-noche" : "text-slate-400"}`}>{t}</span>
              </span>
              {i < 3 && <span className={`mx-1 h-px flex-1 ${paso > i + 1 ? "bg-sky-400" : "bg-slate-300"}`} />}
            </li>
          ))}
        </ol>

        <div className="grid gap-8 md:grid-cols-[1fr_280px]">
          <div className="tarjeta space-y-5">
            {paso === 1 && (
              <>
                <h1 className="text-[1.75rem] leading-tight">Contanos de tu evento</h1>
                <Campo label="Tipo de evento">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TIPOS_EVENTO.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTipo(t.id)}
                        className={`rounded-xl border px-2 py-3 text-sm font-medium ${tipo === t.id ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200"}`}
                      >
                        {t.nombre}
                      </button>
                    ))}
                  </div>
                </Campo>
                <Campo label="Nombre del evento" ayuda="Así aparece en la página, la pantalla y el fotolibro. Ej: Ana & Juan, Los 15 de Sofi.">
                  <input className="input" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Ana & Juan" />
                </Campo>
                <Campo label="Fecha">
                  <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </Campo>
              </>
            )}

            {paso === 2 && (
              <>
                <h1 className="text-[1.75rem] leading-tight">Elegí la temática</h1>
                <p className="text-sm text-slate-600">Después podés cambiar colores, textos y portada desde tu panel.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {TEMATICAS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTematicaId(t.id)}
                      className={`overflow-hidden rounded-xl border-2 text-left ${tematicaId === t.id ? "border-sky-500" : "border-transparent"}`}
                    >
                      <div className="flex h-16 items-center justify-center text-xl" style={{ background: t.fondoDecorado, fontFamily: t.fuenteTitulo, color: `rgb(${t.colores.acento})` }}>
                        {t.nombre}
                      </div>
                      <div className="bg-white p-2 text-xs text-slate-600">
                        {t.descripcion}
                        {t.tipos.includes(tipo) && <span className="ml-1 font-semibold text-sky-600">· Sugerida</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {paso === 3 && (
              <>
                <h1 className="text-[1.75rem] leading-tight">Elegí tu plan</h1>
                <div className="space-y-3">
                  {planes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left ${planId === p.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"}`}
                    >
                      <div>
                        <p className="font-bold">{p.nombre}</p>
                        <p className="text-xs text-slate-600">
                          {p.max_invitados ? `${p.max_invitados} invitados` : "Invitados ilimitados"} ·{" "}
                          {p.max_fotos ? `${p.max_fotos.toLocaleString("es-AR")} fotos` : "fotos ilimitadas"} · {p.pantallas} pantalla(s)
                          {p.misiones ? " · misiones y premios" : ""}
                        </p>
                      </div>
                      <p className="text-lg font-bold">{pesos(p.precio_ars)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {paso === 4 && (
              <>
                <h1 className="text-[1.75rem] leading-tight">Confirmá y pagá</h1>
                <dl className="divide-y rounded-xl border text-sm">
                  {[
                    ["Evento", nombre],
                    ["Tipo", TIPOS_EVENTO.find((t) => t.id === tipo)?.nombre],
                    ["Fecha", fecha || "Sin definir"],
                    ["Temática", TEMATICAS.find((t) => t.id === tematicaId)?.nombre],
                    ["Plan", plan?.nombre],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between px-4 py-2.5">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 text-base">
                    <dt className="font-semibold">Total</dt>
                    <dd className="font-bold">{plan ? pesos(plan.precio_ars) : "—"}</dd>
                  </div>
                </dl>
                {error && <Aviso tipo="error">{error}</Aviso>}
                {creado && error && (
                  <button className="btn-secundario w-full" onClick={() => nav(`/panel/${creado.id}`)}>Ir al panel del evento</button>
                )}
                <button className="btn-primario w-full bg-[#009ee3] py-3.5 text-base" onClick={pagar} disabled={procesando || !plan}>
                  {procesando ? "Redirigiendo a Mercado Pago…" : "Pagar con Mercado Pago"}
                </button>
                <p className="text-center text-xs text-slate-500">El evento se activa automáticamente cuando se acredita el pago.</p>
              </>
            )}

            <div className="flex justify-between pt-2">
              <button className="btn-secundario" onClick={() => setPaso((p) => p - 1)} disabled={paso === 1 || procesando}>Atrás</button>
              {paso < 4 && (
                <button className="btn-primario" onClick={() => setPaso((p) => p + 1)} disabled={!puedeSeguir}>Siguiente</button>
              )}
            </div>
          </div>

          <aside className="hidden md:block">
            <p className="etiqueta mb-3 text-center">Vista previa</p>
            <VistaPrevia tematicaId={tematicaId} nombre={nombre} p={{ titulo: nombre }} />
          </aside>
        </div>
      </main>
    </div>
  );
}
