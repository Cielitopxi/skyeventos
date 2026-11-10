import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Aviso, Campo, Icono, Logo } from "../../components/ui";
import { useUsuario } from "../../components/useUsuario";
import { pesos } from "../../lib/formato";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";
import type { Plan, PedidoRegalo } from "../../lib/tipos";

interface MiRegalo extends PedidoRegalo {
  cupones: { para: string | null; mensaje: string | null; usos: number; activo: boolean } | null;
  planes: { nombre: string } | null;
}

/** Link para canjear un código: abre la contratación con el código ya cargado. */
export const linkCanje = (codigo: string) => `${APP_URL}/contratar?cupon=${encodeURIComponent(codigo)}`;

function textoRegalo(r: MiRegalo) {
  const para = r.cupones?.para ? `${r.cupones.para}, ` : "";
  const msj = r.cupones?.mensaje ? `\n\n"${r.cupones.mensaje}"` : "";
  return `${para}¡te regalé SkyEventos ${r.planes?.nombre ?? ""} para tu evento! 🎁 Fotos de los invitados en vivo, juegos y fotolibro.${msj}\n\nTu código: ${r.cupon}\nCanjealo acá: ${linkCanje(r.cupon)}`;
}

/** Tarjeta de regalo: alguien paga un plan y recibe un código para regalar a quien organiza el evento. */
export default function Regalar() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { usuario, cargando } = useUsuario();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState(params.get("plan") || "fiesta");
  const [para, setPara] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mios, setMios] = useState<MiRegalo[]>([]);
  const volviendo = params.get("regalo");
  const estadoMp = params.get("estado");

  useEffect(() => {
    supabase.from("planes").select("*").eq("activo", true).order("orden").then(({ data }) => setPlanes((data as Plan[]) ?? []));
  }, []);

  async function cargarMios() {
    if (!usuario) return;
    const { data } = await supabase
      .from("pedidos_regalo")
      .select("*, cupones(para, mensaje, usos, activo), planes(nombre)")
      .order("created_at", { ascending: false });
    setMios((data as MiRegalo[]) ?? []);
  }
  useEffect(() => {
    cargarMios();
  }, [usuario?.id]);

  // Al volver de Mercado Pago, esperar a que el webhook active el código.
  useEffect(() => {
    if (!volviendo || !usuario || estadoMp === "error") return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const { data } = await supabase.from("pedidos_regalo").select("estado").eq("id", volviendo).maybeSingle();
      if (data?.estado === "aprobado" || n > 40) {
        clearInterval(t);
        cargarMios();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [volviendo, usuario?.id, estadoMp]);

  async function regalar() {
    if (!usuario) {
      nav(`/ingresar?volver=${encodeURIComponent(`/regalar?plan=${planId}`)}`);
      return;
    }
    if (para.trim().length < 2) {
      setError("Escribí para quién es el regalo (por ejemplo, Sofi y Martín).");
      return;
    }
    setError("");
    setProcesando(true);
    try {
      const { data, error } = await supabase.rpc("crear_regalo", { p_plan: planId, p_para: para.trim(), p_mensaje: mensaje.trim() || null });
      if (error) throw error;
      await pagar((data as PedidoRegalo).id);
    } catch (e) {
      setError(mensajeError(e));
      setProcesando(false);
    }
  }

  async function pagar(id: string) {
    setProcesando(true);
    const { data, error } = await supabase.functions.invoke("mp-crear-preferencia", { body: { regalo_id: id } });
    if (error) {
      setProcesando(false);
      setError("No se pudo iniciar el pago con Mercado Pago. Tu regalo quedó guardado: podés pagarlo más abajo.");
      cargarMios();
      return;
    }
    window.location.href = (data as { init_point: string }).init_point;
  }

  const plan = planes.find((p) => p.id === planId);
  const recien = mios.find((r) => r.id === volviendo);

  return (
    <div className="marca min-h-screen bg-marfil">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-marfil/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <Link to="/panel" className="text-sm font-medium text-slate-600">Mis eventos</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        {volviendo && (
          <div className="tarjeta mx-auto max-w-xl text-center">
            {estadoMp === "error" ? (
              <>
                <h1 className="text-2xl">El pago no se completó</h1>
                <p className="mt-1 text-sm text-slate-600">Podés volver a intentarlo desde “Mis regalos”.</p>
              </>
            ) : recien?.estado === "aprobado" ? (
              <>
                <div className="text-5xl">🎁</div>
                <h1 className="mt-2 text-2xl">¡Tu regalo está listo!</h1>
                <p className="mt-1 text-sm text-slate-600">Mandale el código a {recien.cupones?.para || "quien lo recibe"}. Lo canjea al contratar su evento.</p>
                <p className="mono my-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 py-3 text-2xl font-bold tracking-widest text-sky-800">{recien.cupon}</p>
                <Compartir r={recien} />
              </>
            ) : (
              <>
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                <h1 className="mt-4 text-xl">{estadoMp === "pendiente" ? "Pago pendiente" : "Confirmando tu pago…"}</h1>
                <p className="mt-1 text-sm text-slate-600">Cuando se acredite, el código aparece acá y en “Mis regalos”.</p>
              </>
            )}
            <button className="mt-4 text-sm text-slate-500 underline" onClick={() => setParams({})}>Regalar otro</button>
          </div>
        )}

        {!volviendo && (
          <section className="grid gap-8 md:grid-cols-[1fr_340px]">
            <div className="tarjeta space-y-5">
              <p className="rotulo text-sky-600">Tarjeta de regalo</p>
              <h1 className="text-[2rem] leading-tight">Regalá SkyEventos</h1>
              <p className="text-slate-600">
                Ideal para novios, quinceañeras, cumpleañeros o quien esté organizando algo especial. Pagás vos, le llega un código y lo canjea
                cuando arme su evento. Si elige un plan más grande, paga solo la diferencia.
              </p>
              <Campo label="Plan que regalás">
                <div className="space-y-2">
                  {planes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 p-3.5 text-left ${planId === p.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"}`}
                    >
                      <span>
                        <span className="block font-bold">{p.nombre}</span>
                        <span className="text-xs text-slate-600">
                          {p.max_invitados ? `${p.max_invitados} invitados` : "Invitados ilimitados"} · {p.max_fotos ? `${p.max_fotos.toLocaleString("es-AR")} fotos` : "fotos ilimitadas"}
                        </span>
                      </span>
                      <span className="text-lg font-bold">{pesos(p.precio_ars)}</span>
                    </button>
                  ))}
                </div>
              </Campo>
              <Campo label="¿Para quién es?">
                <input className="input" value={para} maxLength={80} onChange={(e) => setPara(e.target.value)} placeholder="Sofi y Martín" />
              </Campo>
              <Campo label="Dedicatoria (opcional)">
                <textarea className="input min-h-[90px]" value={mensaje} maxLength={400} onChange={(e) => setMensaje(e.target.value)} placeholder="¡Para que no se pierdan ni una foto de su gran día!" />
              </Campo>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn-primario btn-luz w-full py-3.5 text-base" onClick={regalar} disabled={procesando || !plan || cargando}>
                {procesando ? "Redirigiendo a Mercado Pago…" : usuario ? `Regalar ${plan ? pesos(plan.precio_ars) : ""}` : "Ingresá para regalar"}
              </button>
              <p className="text-center text-xs text-slate-500">El código se activa cuando se acredita el pago. Es de un solo uso y no vence.</p>
            </div>

            <aside className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-noche p-6 text-[#dbe5ee] shadow-xl">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/30 blur-2xl" />
                <p className="rotulo text-sky-300">SkyEventos · regalo</p>
                <p className="mt-6 font-display text-3xl">{para.trim() || "Para vos"}</p>
                <p className="mt-2 min-h-[3rem] text-sm text-slate-300">{mensaje.trim() || "Fotos de tus invitados en vivo, juegos y un fotolibro de recuerdo."}</p>
                <p className="mono mt-6 rounded-lg border border-white/20 py-2 text-center tracking-widest">REGALO-XXXXXX</p>
                <p className="mt-3 text-right text-xs text-slate-400">Plan {plan?.nombre ?? ""}</p>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {["Llega por WhatsApp, mail o como quieras", "Sirve para cualquier tipo de evento", "Se canjea al contratar, en un paso"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Icono nombre="check" className="h-4 w-4 text-sky-600" /> {t}
                  </li>
                ))}
              </ul>
            </aside>
          </section>
        )}

        {usuario && mios.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl">Mis regalos</h2>
            <div className="space-y-3">
              {mios.map((r) => (
                <div key={r.id} className="tarjeta flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {r.planes?.nombre} para {r.cupones?.para || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {pesos(r.monto)} ·{" "}
                      {r.estado === "aprobado" ? (r.cupones && r.cupones.usos > 0 ? "Ya fue canjeado" : "Listo para canjear") : r.estado === "pendiente" ? "Falta pagar" : r.estado}
                    </p>
                  </div>
                  {r.estado === "aprobado" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono rounded-lg bg-sky-50 px-3 py-1.5 font-bold text-sky-800">{r.cupon}</span>
                      <Compartir r={r} chico />
                    </div>
                  ) : r.estado === "pendiente" ? (
                    <button className="btn-secundario" onClick={() => pagar(r.id)} disabled={procesando}>Pagar</button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Compartir({ r, chico = false }: { r: MiRegalo; chico?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const texto = textoRegalo(r);
  const copiar = async () => {
    await navigator.clipboard.writeText(texto).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  const nativo = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className={`flex flex-wrap justify-center gap-2 ${chico ? "" : "mt-2"}`}>
      <a className="btn-primario bg-[#25d366]" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <a className="btn-secundario" href={`mailto:?subject=${encodeURIComponent("¡Te regalé SkyEventos!")}&body=${encodeURIComponent(texto)}`}>Email</a>
      <button className="btn-secundario" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar"}</button>
      {nativo && !chico && (
        <button className="btn-secundario" onClick={() => navigator.share({ title: "Te regalé SkyEventos", text: texto }).catch(() => {})}>Más…</button>
      )}
    </div>
  );
}
