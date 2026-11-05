import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso, Cargando, Logo } from "../../components/ui";
import { IconoDuo } from "../../components/Iconos";
import { useUsuario } from "../../components/useUsuario";
import { fechaLarga, nombreTipo } from "../../lib/formato";
import { mensajeError, supabase } from "../../lib/supabase";
import { tematica } from "../../lib/tematicas";
import { MiContrasena } from "../../components/MiContrasena";
import type { EstadoCapsula, Evento } from "../../lib/tipos";

export const ESTADOS: Record<string, { t: string; c: string }> = {
  pendiente_pago: { t: "Pendiente de pago", c: "bg-amber-100 text-amber-800" },
  activo: { t: "Activo", c: "bg-emerald-100 text-emerald-800" },
  cerrado: { t: "Cerrado", c: "bg-slate-200 text-slate-700" },
  archivado: { t: "Archivado", c: "bg-slate-200 text-slate-500" },
};

export function BarraPanel() {
  const { usuario } = useUsuario();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (usuario) supabase.rpc("es_admin").then(({ data }) => setAdmin(Boolean(data)));
  }, [usuario]);
  return (
    <header className="no-imprimir border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          <Link to="/panel" className="font-medium text-slate-600 hover:text-slate-900">Mis eventos</Link>
          {admin && <Link to="/admin" className="font-medium text-slate-600 hover:text-slate-900">Administración</Link>}
          <span className="hidden text-slate-400 sm:inline">{usuario?.email}</span>
          <button className="text-slate-500 hover:text-slate-900" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
    </header>
  );
}

export default function MisEventos() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [capsulas, setCapsulas] = useState<Evento[]>([]);
  const [error, setError] = useState("");

  async function cargar() {
    const { data, error } = await supabase.from("eventos").select("*").order("created_at", { ascending: false });
    if (error) setError(mensajeError(error));
    const lista = (data as Evento[]) ?? [];
    setEventos(lista);
    // Cápsulas que ya se pueden abrir (a los 11 meses del evento).
    const listas = await Promise.all(
      lista.filter((e) => e.estado !== "pendiente_pago").map(async (e) => {
        const { data } = await supabase.rpc("capsula_estado", { p_evento: e.id });
        const c = (data as EstadoCapsula[] | null)?.[0];
        return c?.abierta && c.items > 0 ? e : null;
      }),
    );
    setCapsulas(listas.filter((e): e is Evento => !!e));
  }

  useEffect(() => {
    cargar();
    supabase.rpc("es_admin").then(({ data }) => setEsAdmin(Boolean(data)));
  }, []);

  async function pagar(id: string) {
    setError("");
    const { data, error } = await supabase.functions.invoke("mp-crear-preferencia", { body: { evento_id: id } });
    if (error) return setError("No se pudo iniciar el pago con Mercado Pago. Revisá la configuración de la función mp-crear-preferencia.");
    window.location.href = (data as { init_point: string }).init_point;
  }

  async function activarManual(id: string) {
    const { error } = await supabase.rpc("activar_evento", { p_evento: id, p_payment_id: "manual" });
    if (error) setError(mensajeError(error));
    cargar();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <BarraPanel />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mis eventos</h1>
          <Link to="/contratar" className="btn-primario">+ Nuevo evento</Link>
        </div>
        {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
        {capsulas.map((e) => (
          <Link key={e.id} to={`/panel/${e.id}?tab=capsula`} className="mb-4 flex items-center gap-4 rounded-2xl bg-noche px-5 py-4 text-white shadow-lg transition hover:brightness-110">
            <IconoDuo nombre="capsula" className="h-9 w-9 shrink-0 text-oro" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg">La cápsula del tiempo de {e.personalizacion.titulo || e.nombre} ya se puede abrir</span>
              <span className="text-sm text-white/65">Sus invitados les dejaron mensajes hace 11 meses. Ábranla antes del aniversario.</span>
            </span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">Abrir</span>
          </Link>
        ))}
        {!eventos ? (
          <Cargando />
        ) : !eventos.length ? (
          <div className="tarjeta text-center">
            <IconoDuo nombre="chispa" className="mx-auto h-12 w-12 text-sky-500" />
            <p className="mt-2 font-semibold">Todavía no tenés eventos</p>
            <Link to="/contratar" className="btn-primario mt-4">Crear mi primer evento</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map((ev) => {
              const t = tematica(ev.tematica);
              const est = ESTADOS[ev.estado];
              return (
                <div key={ev.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <Link to={`/panel/${ev.id}`} className="block">
                    <div className="flex h-24 items-center justify-center px-3 text-center text-2xl" style={{ background: t.fondoDecorado, fontFamily: t.fuenteTitulo, color: `rgb(${t.colores.acento})` }}>
                      {ev.personalizacion.titulo || ev.nombre}
                    </div>
                  </Link>
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className={`chip ${est.c}`}>{est.t}</span>
                      <span className="font-mono text-sm font-bold tracking-widest">{ev.codigo}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {nombreTipo(ev.tipo)} · {ev.fecha ? fechaLarga(ev.fecha) : "Sin fecha"} · plan {ev.plan_id}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link to={`/panel/${ev.id}`} className="btn-secundario btn-chico">Administrar</Link>
                      {ev.estado === "pendiente_pago" && (
                        <button className="btn-primario btn-chico" onClick={() => pagar(ev.id)}>Pagar</button>
                      )}
                      {ev.estado === "pendiente_pago" && esAdmin && (
                        <button className="btn-secundario btn-chico" onClick={() => activarManual(ev.id)}>Activar sin pago (admin)</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-10 max-w-2xl">
          <MiContrasena />
        </div>
      </main>
    </div>
  );
}
