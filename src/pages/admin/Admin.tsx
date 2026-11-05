import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { IconoDuo } from "../../components/Iconos";
import { Aviso, Cargando } from "../../components/ui";
import { fechaLarga, nombreTipo, pesos } from "../../lib/formato";
import { mensajeError, supabase } from "../../lib/supabase";
import type { CodigoDescuento, Plan } from "../../lib/tipos";
import { BarraPanel, ESTADOS } from "../panel/MisEventos";

interface Resumen {
  eventos_activos: number;
  eventos_pendientes: number;
  eventos_total: number;
  ingresos: number;
  ingresos_mes: number;
  pedidos_pendientes: number;
  invitados: number;
  fotos: number;
  mensajes: number;
  avisos_pendientes: number;
}
interface FilaEvento {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  plan_id: string;
  estado: string;
  fecha: string | null;
  created_at: string;
  expira_at: string | null;
  es_demo: boolean;
  owner_email: string | null;
  invitados: number;
  fotos: number;
  mensajes: number;
  pagado: number;
  capsula_items: number;
}
interface FilaPedido {
  id: string;
  evento_id: string;
  evento: string;
  codigo: string;
  owner_email: string | null;
  plan_id: string;
  monto: number;
  estado: string;
  mp_payment_id: string | null;
  created_at: string;
  pagado_at: string | null;
}
interface FilaUsuario {
  user_id: string;
  email: string;
  es_admin: boolean;
  eventos: number;
  creado_at: string;
  ultimo_ingreso: string | null;
}
interface FilaAviso {
  id: string;
  evento: string;
  codigo: string;
  tipo: string;
  email: string | null;
  programada_at: string;
  enviada_at: string | null;
  intentos: number;
  error: string | null;
}

type Seccion = "resumen" | "eventos" | "pagos" | "cupones" | "usuarios" | "planes" | "avisos";
const SECCIONES: { id: Seccion; t: string; i: string }[] = [
  { id: "resumen", t: "Resumen", i: "ranking" },
  { id: "eventos", t: "Eventos", i: "chispa" },
  { id: "pagos", t: "Pagos", i: "regalo" },
  { id: "cupones", t: "Códigos", i: "rayo" },
  { id: "usuarios", t: "Usuarios", i: "perfil" },
  { id: "planes", t: "Planes", i: "premio" },
  { id: "avisos", t: "Avisos", i: "mensajes" },
];

const n = (x: number | string) => Number(x).toLocaleString("es-AR");
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) : "—");

/** Back office: todo el servicio, para los usuarios de la tabla admins. */
export default function Admin() {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [seccion, setSeccion] = useState<Seccion>("resumen");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [eventos, setEventos] = useState<FilaEvento[]>([]);
  const [pedidos, setPedidos] = useState<FilaPedido[]>([]);
  const [usuarios, setUsuarios] = useState<FilaUsuario[]>([]);
  const [avisos, setAvisos] = useState<FilaAviso[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [r, e, p, u, a, pl] = await Promise.all([
      supabase.rpc("admin_resumen"),
      supabase.rpc("admin_eventos"),
      supabase.rpc("admin_pedidos"),
      supabase.rpc("admin_usuarios"),
      supabase.rpc("admin_notificaciones"),
      supabase.from("planes").select("*").order("orden"),
    ]);
    const err = r.error || e.error || p.error || u.error || a.error || pl.error;
    if (err) setError(mensajeError(err));
    setResumen((r.data as Resumen[] | null)?.[0] ?? null);
    setEventos((e.data as FilaEvento[]) ?? []);
    setPedidos((p.data as FilaPedido[]) ?? []);
    setUsuarios((u.data as FilaUsuario[]) ?? []);
    setAvisos((a.data as FilaAviso[]) ?? []);
    setPlanes((pl.data as Plan[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.rpc("es_admin").then(({ data }) => {
      setEsAdmin(Boolean(data));
      if (data) cargar();
    });
  }, [cargar]);

  if (esAdmin === null) return <Cargando />;
  if (!esAdmin) return <Navigate to="/panel" replace />;

  return (
    <div className="min-h-screen bg-slate-50">
      <BarraPanel />
      <div className="bg-noche text-white">
        <div className="mx-auto max-w-6xl px-4 pb-0 pt-8">
          <p className="rotulo text-oro">Administración</p>
          <h1 className="mt-1 font-display text-3xl">Operación del servicio</h1>
          <nav className="mt-6 flex gap-1 overflow-x-auto">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={`flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-medium transition ${seccion === s.id ? "bg-slate-50 text-slate-900" : "text-white/70 hover:text-white"}`}
              >
                <IconoDuo nombre={s.i} className="h-4 w-4" /> {s.t}
                {s.id === "avisos" && !!resumen?.avisos_pendientes && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-noche">{resumen.avisos_pendientes}</span>}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
        {seccion === "resumen" && <SeccionResumen r={resumen} eventos={eventos} pedidos={pedidos} />}
        {seccion === "eventos" && <SeccionEventos eventos={eventos} recargar={cargar} setError={setError} />}
        {seccion === "pagos" && <SeccionPagos pedidos={pedidos} />}
        {seccion === "cupones" && <SeccionCupones planes={planes} />}
        {seccion === "usuarios" && <SeccionUsuarios usuarios={usuarios} recargar={cargar} />}
        {seccion === "planes" && <SeccionPlanes planes={planes} recargar={cargar} />}
        {seccion === "avisos" && <SeccionAvisos avisos={avisos} />}
      </main>
    </div>
  );
}

function Kpi({ t, v, d, i }: { t: string; v: string; d?: string; i: string }) {
  return (
    <div className="tarjeta">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-slate-500">{t}</p>
        <IconoDuo nombre={i} className="h-5 w-5 text-sky-500" />
      </div>
      <p className="mt-2 font-display text-3xl tabular-nums">{v}</p>
      {d && <p className="mt-1 text-xs text-slate-500">{d}</p>}
    </div>
  );
}

function SeccionResumen({ r, eventos, pedidos }: { r: Resumen | null; eventos: FilaEvento[]; pedidos: FilaPedido[] }) {
  if (!r) return <Cargando />;
  const porPlan = eventos.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.plan_id]: (acc[e.plan_id] ?? 0) + 1 }), {});
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi t="Ingresos del mes" v={pesos(Number(r.ingresos_mes))} d={`${pesos(Number(r.ingresos))} en total`} i="regalo" />
        <Kpi t="Eventos activos" v={n(r.eventos_activos)} d={`${n(r.eventos_total)} creados · ${n(r.eventos_pendientes)} sin pagar`} i="chispa" />
        <Kpi t="Pagos pendientes" v={n(r.pedidos_pendientes)} d="Preferencias de Mercado Pago sin acreditar" i="reloj" />
        <Kpi t="Avisos por enviar" v={n(r.avisos_pendientes)} d="Cápsulas listas para abrir" i="capsula" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi t="Invitados" v={n(r.invitados)} i="perfil" />
        <Kpi t="Fotos" v={n(r.fotos)} i="fotos" />
        <Kpi t="Mensajes" v={n(r.mensajes)} i="mensajes" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="tarjeta">
          <p className="font-semibold">Eventos por plan</p>
          <div className="mt-4 space-y-3">
            {Object.entries(porPlan).map(([plan, c]) => (
              <div key={plan}>
                <div className="flex justify-between text-sm"><span className="capitalize">{plan}</span><span className="tabular-nums text-slate-500">{c}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(c / Math.max(1, eventos.length)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="tarjeta">
          <p className="font-semibold">Últimos pagos</p>
          <div className="mt-3 divide-y text-sm">
            {pedidos.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">{p.evento} <span className="text-slate-400">· {p.owner_email}</span></span>
                <EstadoPago e={p.estado} />
                <span className="w-24 text-right tabular-nums">{pesos(Number(p.monto))}</span>
              </div>
            ))}
            {!pedidos.length && <p className="py-4 text-slate-500">Todavía no hay pagos.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function EstadoPago({ e }: { e: string }) {
  const c = e === "aprobado" ? "bg-emerald-100 text-emerald-800" : e === "pendiente" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700";
  return <span className={`chip ${c}`}>{e}</span>;
}

function SeccionEventos({ eventos, recargar, setError }: { eventos: FilaEvento[]; recargar: () => void; setError: (s: string) => void }) {
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("");
  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return eventos.filter(
      (e) => (!estado || e.estado === estado) && (!q || [e.nombre, e.codigo, e.owner_email ?? ""].some((x) => x.toLowerCase().includes(q))),
    );
  }, [eventos, buscar, estado]);

  async function cambiar(e: FilaEvento, nuevo: string) {
    const msj = { activo: `¿Activar "${e.nombre}" sin pago?`, cerrado: `¿Cerrar "${e.nombre}"? Los invitados ya no podrán subir contenido.`, archivado: `¿Archivar "${e.nombre}"?` }[nuevo];
    if (msj && !confirm(msj)) return;
    const { error } = await supabase.rpc("admin_estado_evento", { p_evento: e.id, p_estado: nuevo });
    if (error) setError(mensajeError(error));
    recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Buscar por nombre, código o mail…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <select className="input w-auto" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
        </select>
        <span className="ml-auto self-center text-sm text-slate-500">{lista.length} eventos</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Organizador</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Invitados</th>
              <th className="px-4 py-3 text-right">Fotos</th>
              <th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{e.nombre} {e.es_demo && <span className="chip bg-sky-100 text-sky-700">demo</span>}</p>
                  <p className="text-xs text-slate-500"><span className="font-mono font-bold">{e.codigo}</span> · {nombreTipo(e.tipo)} · {e.fecha ? fechaLarga(e.fecha) : "sin fecha"}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.owner_email ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{e.plan_id}</td>
                <td className="px-4 py-3"><span className={`chip ${ESTADOS[e.estado]?.c ?? ""}`}>{ESTADOS[e.estado]?.t ?? e.estado}</span></td>
                <td className="px-4 py-3 text-right tabular-nums">{n(e.invitados)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{n(e.fotos)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pesos(Number(e.pagado))}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5 whitespace-nowrap">
                    <Link to={`/panel/${e.id}`} className="btn-secundario btn-chico">Abrir</Link>
                    {e.estado === "pendiente_pago" && <button className="btn-secundario btn-chico" onClick={() => cambiar(e, "activo")}>Activar</button>}
                    {e.estado === "activo" && <button className="btn-secundario btn-chico" onClick={() => cambiar(e, "cerrado")}>Cerrar</button>}
                    {e.estado === "cerrado" && <button className="btn-secundario btn-chico" onClick={() => cambiar(e, "archivado")}>Archivar</button>}
                    {(e.estado === "cerrado" || e.estado === "archivado") && <button className="btn-secundario btn-chico" onClick={() => cambiar(e, "activo")}>Reactivar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <p className="p-8 text-center text-slate-500">No hay eventos con ese filtro.</p>}
      </div>
    </div>
  );
}

function SeccionPagos({ pedidos }: { pedidos: FilaPedido[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Evento</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Pago MP</th>
            <th className="px-4 py-3 text-right">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-slate-600">{dia(p.pagado_at ?? p.created_at)}</td>
              <td className="px-4 py-3"><Link to={`/panel/${p.evento_id}`} className="font-medium hover:underline">{p.evento}</Link> <span className="font-mono text-xs text-slate-500">{p.codigo}</span></td>
              <td className="px-4 py-3 text-slate-600">{p.owner_email ?? "—"}</td>
              <td className="px-4 py-3 capitalize">{p.plan_id}</td>
              <td className="px-4 py-3"><EstadoPago e={p.estado} /></td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.mp_payment_id ?? "—"}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">{pesos(Number(p.monto))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!pedidos.length && <p className="p-8 text-center text-slate-500">Todavía no hay pagos registrados.</p>}
    </div>
  );
}

function SeccionUsuarios({ usuarios, recargar }: { usuarios: FilaUsuario[]; recargar: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function setAdmin(mail: string, valor: boolean) {
    setError("");
    setOk("");
    if (!valor && !confirm(`¿Quitarle el acceso de administrador a ${mail}?`)) return;
    const { error } = await supabase.rpc("admin_set_admin", { p_email: mail, p_admin: valor });
    if (error) return setError(mensajeError(error));
    setOk(valor ? `${mail} ahora es administrador.` : `${mail} ya no es administrador.`);
    setEmail("");
    recargar();
  }

  return (
    <div className="space-y-4">
      <form
        className="tarjeta flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) setAdmin(email.trim(), true);
        }}
      >
        <label className="min-w-[240px] flex-1">
          <span className="etiqueta">Sumar administrador</span>
          <input className="input" type="email" placeholder="mail@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn-primario">Dar acceso</button>
        <p className="w-full text-xs text-slate-500">La persona tiene que haber ingresado al panel al menos una vez con ese mail.</p>
        {error && <div className="w-full"><Aviso tipo="error">{error}</Aviso></div>}
        {ok && <div className="w-full"><Aviso tipo="ok">{ok}</Aviso></div>}
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Mail</th>
              <th className="px-4 py-3 text-right">Eventos</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3">Último ingreso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {usuarios.map((u) => (
              <tr key={u.user_id}>
                <td className="px-4 py-3 font-medium">{u.email} {u.es_admin && <span className="chip bg-noche text-white">admin</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.eventos}</td>
                <td className="px-4 py-3 text-slate-600">{dia(u.creado_at)}</td>
                <td className="px-4 py-3 text-slate-600">{dia(u.ultimo_ingreso)}</td>
                <td className="px-4 py-3 text-right">
                  {u.es_admin ? (
                    <button className="text-sm text-rose-600 hover:underline" onClick={() => setAdmin(u.email, false)}>Quitar admin</button>
                  ) : (
                    <button className="text-sm text-sky-700 hover:underline" onClick={() => setAdmin(u.email, true)}>Hacer admin</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MiContrasena />
    </div>
  );
}

/** Define o cambia la contraseña de la cuenta con la que se está usando el admin (para entrar sin enlace por email). */
function MiContrasena() {
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msj, setMsj] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsj(null);
    if (clave.length < 8) return setMsj({ tipo: "error", t: "Usá al menos 8 caracteres." });
    if (clave !== repetir) return setMsj({ tipo: "error", t: "Las contraseñas no coinciden." });
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setGuardando(false);
    if (error) return setMsj({ tipo: "error", t: mensajeError(error) });
    setClave("");
    setRepetir("");
    setMsj({ tipo: "ok", t: "Contraseña guardada. Ya podés entrar con “Tengo contraseña”." });
  }

  return (
    <form className="tarjeta flex flex-wrap items-end gap-3" onSubmit={guardar}>
      <p className="w-full font-medium">Tu contraseña</p>
      <label className="min-w-[200px] flex-1">
        <span className="etiqueta">Nueva contraseña</span>
        <input className="input" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      </label>
      <label className="min-w-[200px] flex-1">
        <span className="etiqueta">Repetila</span>
        <input className="input" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </label>
      <button className="btn-primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
      {msj && <div className="w-full"><Aviso tipo={msj.tipo}>{msj.t}</Aviso></div>}
    </form>
  );
}

function SeccionPlanes({ planes, recargar }: { planes: Plan[]; recargar: () => void }) {
  const [edit, setEdit] = useState<Record<string, Partial<Plan>>>({});
  const [msj, setMsj] = useState("");

  const valor = (p: Plan, k: keyof Plan) => (edit[p.id]?.[k] ?? p[k]) as number | boolean | null;
  const set = (p: Plan, k: keyof Plan, v: number | boolean | null) => setEdit((e) => ({ ...e, [p.id]: { ...e[p.id], [k]: v } }));

  async function guardar(p: Plan) {
    const { error } = await supabase.from("planes").update(edit[p.id]).eq("id", p.id);
    setMsj(error ? mensajeError(error) : `Plan ${p.nombre} actualizado.`);
    setEdit((e) => ({ ...e, [p.id]: {} }));
    recargar();
  }

  const num = (p: Plan, k: keyof Plan, label: string, vacio = false) => (
    <label className="block">
      <span className="etiqueta">{label}</span>
      <input
        className="input tabular-nums"
        type="number"
        min={0}
        placeholder={vacio ? "Sin límite" : undefined}
        value={(valor(p, k) as number | null) ?? ""}
        onChange={(e) => set(p, k, e.target.value === "" ? (vacio ? null : 0) : Number(e.target.value))}
      />
    </label>
  );
  const chk = (p: Plan, k: keyof Plan, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={Boolean(valor(p, k))} onChange={(e) => set(p, k, e.target.checked)} /> {label}
    </label>
  );

  return (
    <div className="space-y-4">
      {msj && <Aviso>{msj}</Aviso>}
      <div className="grid gap-4 lg:grid-cols-3">
        {planes.map((p) => (
          <div key={p.id} className="tarjeta space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-2xl">{p.nombre}</p>
              <span className="font-mono text-xs text-slate-400">{p.id}</span>
            </div>
            {num(p, "precio_ars", "Precio (ARS)")}
            <div className="grid grid-cols-2 gap-3">
              {num(p, "max_invitados", "Invitados", true)}
              {num(p, "max_fotos", "Fotos", true)}
              {num(p, "pantallas", "Pantallas")}
              {num(p, "retencion_dias", "Días de guardado")}
            </div>
            <div className="space-y-1.5 pt-1">
              {chk(p, "misiones", "Juegos y misiones")}
              {chk(p, "clips", "Videos y audios de 10 s")}
              {chk(p, "sin_marca", "Sin marca SkyEventos")}
              {chk(p, "capsula", "Cápsula del tiempo")}
              {chk(p, "portada_personalizada", "Portada personalizada")}
            </div>
            <button className="btn-primario w-full" disabled={!Object.keys(edit[p.id] ?? {}).length} onClick={() => guardar(p)}>Guardar cambios</button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FilaRegalo {
  id: string;
  cupon: string;
  monto: number;
  estado: string;
  created_at: string;
}

/** Códigos de descuento (los crea el admin) y tarjetas de regalo (nacen de una compra). */
function SeccionCupones({ planes }: { planes: Plan[] }) {
  const [cupones, setCupones] = useState<CodigoDescuento[]>([]);
  const [regalos, setRegalos] = useState<Record<string, FilaRegalo>>({});
  const [msj, setMsj] = useState("");
  const [nuevo, setNuevo] = useState({ codigo: "", tipo: "porcentaje", valor: "10", plan_id: "", usos_max: "", vence_at: "", nota: "" });

  const cargar = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from("cupones").select("*").order("created_at", { ascending: false }),
      supabase.from("pedidos_regalo").select("id, cupon, monto, estado, created_at"),
    ]);
    setCupones((c.data as CodigoDescuento[]) ?? []);
    setRegalos(Object.fromEntries(((r.data as FilaRegalo[]) ?? []).map((x) => [x.cupon, x])));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setMsj("");
    const codigo = nuevo.codigo.toUpperCase().replace(/\s/g, "");
    const { error } = await supabase.from("cupones").insert({
      codigo,
      tipo: nuevo.tipo,
      valor: Number(nuevo.valor),
      plan_id: nuevo.plan_id || null,
      usos_max: nuevo.usos_max ? Number(nuevo.usos_max) : null,
      vence_at: nuevo.vence_at ? new Date(nuevo.vence_at + "T23:59:59").toISOString() : null,
      nota: nuevo.nota.trim() || null,
    });
    if (error) return setMsj(error.code === "23505" ? "Ya existe un código con ese nombre." : error.code === "23514" ? "Revisá el código (4 a 24 letras, números o guiones) y el valor." : mensajeError(error));
    setMsj(`Código ${codigo} creado.`);
    setNuevo({ ...nuevo, codigo: "", nota: "" });
    cargar();
  }

  async function alternar(c: CodigoDescuento) {
    const { error } = await supabase.from("cupones").update({ activo: !c.activo }).eq("codigo", c.codigo);
    setMsj(error ? mensajeError(error) : `${c.codigo} ${c.activo ? "desactivado" : "activado"}.`);
    cargar();
  }

  async function marcarPagado(r: FilaRegalo) {
    if (!confirm(`¿Marcar como pagado el regalo ${r.cupon}? Usalo solo si cobraste por fuera de Mercado Pago.`)) return;
    const { error } = await supabase.rpc("activar_regalo", { p_pedido: r.id, p_payment_id: "manual" });
    setMsj(error ? mensajeError(error) : `Regalo ${r.cupon} activado.`);
    cargar();
  }

  const valorTxt = (c: CodigoDescuento) => (c.tipo === "porcentaje" ? `${c.valor}%` : pesos(c.valor));
  const set = (k: keyof typeof nuevo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNuevo({ ...nuevo, [k]: e.target.value });

  return (
    <div className="space-y-5">
      {msj && <Aviso>{msj}</Aviso>}
      <form onSubmit={crear} className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <p className="font-display text-xl sm:col-span-2 lg:col-span-4">Nuevo código de descuento</p>
        <label className="block">
          <span className="etiqueta">Código</span>
          <input className="input font-mono uppercase" required minLength={4} maxLength={24} pattern="[A-Za-z0-9-]+" value={nuevo.codigo} onChange={set("codigo")} placeholder="VERANO25" />
        </label>
        <label className="block">
          <span className="etiqueta">Tipo</span>
          <select className="input" value={nuevo.tipo} onChange={set("tipo")}>
            <option value="porcentaje">Porcentaje</option>
            <option value="monto">Monto fijo (ARS)</option>
          </select>
        </label>
        <label className="block">
          <span className="etiqueta">{nuevo.tipo === "porcentaje" ? "Descuento (%)" : "Descuento (ARS)"}</span>
          <input className="input tabular-nums" type="number" required min={1} max={nuevo.tipo === "porcentaje" ? 100 : undefined} value={nuevo.valor} onChange={set("valor")} />
        </label>
        <label className="block">
          <span className="etiqueta">Plan</span>
          <select className="input" value={nuevo.plan_id} onChange={set("plan_id")}>
            <option value="">Todos</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta">Usos máximos</span>
          <input className="input tabular-nums" type="number" min={1} value={nuevo.usos_max} onChange={set("usos_max")} placeholder="Sin límite" />
        </label>
        <label className="block">
          <span className="etiqueta">Vence</span>
          <input className="input" type="date" value={nuevo.vence_at} onChange={set("vence_at")} />
        </label>
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="etiqueta">Nota interna</span>
          <input className="input" value={nuevo.nota} maxLength={120} onChange={set("nota")} placeholder="Campaña Instagram" />
        </label>
        <div className="flex items-end">
          <button className="btn-primario w-full">Crear código</button>
        </div>
      </form>

      <div className="tarjeta overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {cupones.map((c) => {
              const r = regalos[c.codigo];
              return (
                <tr key={c.codigo} className={c.activo ? "" : "text-slate-400"}>
                  <td className="px-4 py-3 font-mono font-semibold">{c.codigo}</td>
                  <td className="px-4 py-3">{c.tipo === "regalo" ? `Regalo · ${pesos(c.valor)}` : valorTxt(c)}</td>
                  <td className="px-4 py-3 tabular-nums">{c.usos}{c.usos_max ? ` / ${c.usos_max}` : ""}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.tipo === "regalo" ? `Para ${c.para ?? "—"} · ${r ? (r.estado === "pendiente" ? "sin pagar" : r.estado) : ""}` : [c.plan_id && `Solo ${c.plan_id}`, c.vence_at && `Vence ${fechaLarga(c.vence_at)}`, c.nota].filter(Boolean).join(" · ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.tipo === "regalo" && r?.estado === "pendiente" ? (
                      <button className="btn-secundario px-3 py-1.5 text-xs" onClick={() => marcarPagado(r)}>Marcar pagado</button>
                    ) : (
                      <button className="btn-secundario px-3 py-1.5 text-xs" onClick={() => alternar(c)}>{c.activo ? "Desactivar" : "Activar"}</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!cupones.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Todavía no hay códigos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeccionAvisos({ avisos }: { avisos: FilaAviso[] }) {
  return (
    <div className="space-y-4">
      <Aviso>
        Cada día se encolan los avisos de las cápsulas que cumplen 11 meses. El mail sale por la función <code>avisos-capsula</code> cuando está configurada
        la clave de Resend; mientras tanto los organizadores ven el aviso al entrar al panel.
      </Aviso>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Destinatario</th>
              <th className="px-4 py-3">Programado</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {avisos.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium">{a.evento} <span className="font-mono text-xs text-slate-500">{a.codigo}</span></td>
                <td className="px-4 py-3 text-slate-600">{a.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{dia(a.programada_at)}</td>
                <td className="px-4 py-3">
                  {a.enviada_at ? (
                    <span className="chip bg-emerald-100 text-emerald-800">enviado {dia(a.enviada_at)}</span>
                  ) : a.error ? (
                    <span className="chip bg-rose-100 text-rose-700" title={a.error}>error ({a.intentos})</span>
                  ) : (
                    <span className="chip bg-amber-100 text-amber-800">pendiente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!avisos.length && <p className="p-8 text-center text-slate-500">No hay avisos todavía.</p>}
      </div>
    </div>
  );
}
