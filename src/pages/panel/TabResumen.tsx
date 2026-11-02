import { useEffect, useState } from "react";
import { Aviso } from "../../components/ui";
import { fechaLarga } from "../../lib/formato";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";
import type { PropsTab } from "./EventoPanel";

function Copiable({ label, valor }: { label: string; valor: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <span className="etiqueta">{label}</span>
      <div className="flex gap-2">
        <input className="input font-mono text-xs" readOnly value={valor} onFocus={(e) => e.target.select()} />
        <button
          className="btn-secundario btn-chico shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(valor);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          }}
        >
          {ok ? "¡Copiado!" : "Copiar"}
        </button>
        <a className="btn-secundario btn-chico shrink-0" href={valor} target="_blank" rel="noreferrer">Abrir</a>
      </div>
    </div>
  );
}

export default function TabResumen({ evento, plan, recargar }: PropsTab) {
  const [stats, setStats] = useState({ invitados: 0, fotos: 0, pendientes: 0, mensajes: 0 });
  const [anuncio, setAnuncio] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  useEffect(() => {
    const c = (tabla: string, f?: (q: any) => any) => {
      let q = supabase.from(tabla).select("id", { count: "exact", head: true }).eq("evento_id", evento.id);
      if (f) q = f(q);
      return q.then((r: { count: number | null }) => r.count ?? 0);
    };
    Promise.all([
      c("invitados"),
      c("fotos"),
      c("fotos", (q) => q.eq("estado", "pendiente")),
      c("mensajes"),
    ]).then(([invitados, fotos, pendientes, mensajes]) => setStats({ invitados, fotos, pendientes, mensajes }));
  }, [evento.id]);

  const linkInvitados = `${APP_URL}/e/${evento.codigo}`;
  const linkPantalla = `${APP_URL}/pantalla/${evento.codigo}?k=${evento.token_pantalla}`;

  async function cambiarEstado(cerrar: boolean) {
    if (cerrar && !confirm("¿Cerrar el evento? Los invitados tendrán 48 h más para subir fotos y después se podrá generar el fotolibro.")) return;
    const { error } = await supabase.rpc("cerrar_evento", { p_evento: evento.id, p_cerrar: cerrar });
    if (error) setMsg({ t: "error", m: mensajeError(error) });
    await recargar();
  }

  async function enviarAnuncio(e: React.FormEvent) {
    e.preventDefault();
    if (!anuncio.trim()) return;
    const { error } = await supabase.from("anuncios").insert({ evento_id: evento.id, texto: anuncio.trim() });
    setMsg(error ? { t: "error", m: mensajeError(error) } : { t: "ok", m: "Anuncio enviado a la pantalla." });
    if (!error) setAnuncio("");
  }

  const tarjetas = [
    { t: "Invitados", v: stats.invitados, max: plan?.max_invitados },
    { t: "Fotos", v: stats.fotos, max: plan?.max_fotos },
    { t: "Por moderar", v: stats.pendientes },
    { t: "Mensajes", v: stats.mensajes },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tarjetas.map((x) => (
            <div key={x.t} className="tarjeta p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{x.t}</p>
              <p className="text-2xl font-bold">{x.v}{x.max ? <span className="text-sm font-normal text-slate-400"> / {x.max}</span> : null}</p>
            </div>
          ))}
        </div>
        <div className="tarjeta space-y-4">
          <h2 className="font-bold">Links del evento</h2>
          <Copiable label="Página de invitados" valor={linkInvitados} />
          <Copiable label="Pantalla en vivo (no lo compartas: es para el TV o proyector)" valor={linkPantalla} />
        </div>
        <form onSubmit={enviarAnuncio} className="tarjeta space-y-3">
          <h2 className="font-bold">Anuncio en pantalla</h2>
          <p className="text-sm text-slate-600">Se muestra grande en la pantalla durante unos segundos. Ej: “¡Misión relámpago: foto con la torta!”</p>
          <div className="flex gap-2">
            <input className="input" maxLength={140} value={anuncio} onChange={(e) => setAnuncio(e.target.value)} placeholder="Escribí el anuncio…" />
            <button className="btn-primario shrink-0" disabled={evento.estado !== "activo"}>Enviar</button>
          </div>
        </form>
        {msg && <Aviso tipo={msg.t}>{msg.m}</Aviso>}
      </div>
      <div className="space-y-6">
        <div className="tarjeta space-y-2 text-sm">
          <h2 className="font-bold">Datos</h2>
          <p><span className="text-slate-500">Fecha:</span> {evento.fecha ? fechaLarga(evento.fecha) : "Sin definir"}</p>
          <p><span className="text-slate-500">Plan:</span> {plan?.nombre}</p>
          <p><span className="text-slate-500">Moderación:</span> {evento.moderacion === "previa" ? "Previa (apruebo antes de mostrar)" : "Posterior (se muestra y puedo ocultar)"}</p>
          {evento.expira_at && <p><span className="text-slate-500">Disponible hasta:</span> {fechaLarga(evento.expira_at)}</p>}
        </div>
        <div className="tarjeta space-y-3">
          <h2 className="font-bold">Estado del evento</h2>
          {evento.estado === "activo" && (
            <>
              <p className="text-sm text-slate-600">Cuando termine la fiesta, cerralo. Los invitados podrán subir fotos 48 h más.</p>
              <button className="btn-peligro w-full" onClick={() => cambiarEstado(true)}>Cerrar evento</button>
            </>
          )}
          {evento.estado === "cerrado" && (
            <>
              <p className="text-sm text-slate-600">Cerrado el {fechaLarga(evento.cerrado_at)}. Ya podés armar el fotolibro.</p>
              <button className="btn-secundario w-full" onClick={() => cambiarEstado(false)}>Reabrir evento</button>
            </>
          )}
          {evento.estado === "pendiente_pago" && <p className="text-sm text-slate-600">Se activa al acreditarse el pago.</p>}
        </div>
      </div>
    </div>
  );
}
