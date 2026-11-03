import { useCallback, useEffect, useState } from "react";
import { Aviso } from "../../components/ui";
import { IconoDuo } from "../../components/Iconos";
import { hora } from "../../lib/formato";
import { mensajeError, supabase } from "../../lib/supabase";
import type { Foto, Invitado, Mensaje, Mision } from "../../lib/tipos";
import { useUrls } from "../../lib/urls";
import type { PropsTab } from "./EventoPanel";

type Filtro = "pendientes" | "todas" | "misiones" | "ocultas";

export default function TabModerar({ evento }: PropsTab) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [invitados, setInvitados] = useState<Record<string, Invitado>>({});
  const [misiones, setMisiones] = useState<Record<string, Mision>>({});
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [ampliada, setAmpliada] = useState<Foto | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [f, m, i, mi] = await Promise.all([
      supabase.from("fotos").select("*").eq("evento_id", evento.id).order("created_at", { ascending: false }).limit(1000),
      supabase.from("mensajes").select("*").eq("evento_id", evento.id).order("created_at", { ascending: false }),
      supabase.from("invitados").select("*").eq("evento_id", evento.id),
      supabase.from("misiones").select("*").eq("evento_id", evento.id),
    ]);
    setFotos((f.data as Foto[]) ?? []);
    setMensajes((m.data as Mensaje[]) ?? []);
    setInvitados(Object.fromEntries(((i.data as Invitado[]) ?? []).map((x) => [x.id, x])));
    setMisiones(Object.fromEntries(((mi.data as Mision[]) ?? []).map((x) => [x.id, x])));
  }, [evento.id]);

  useEffect(() => {
    cargar();
    const canal = supabase
      .channel(`moderar-${evento.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fotos", filter: `evento_id=eq.${evento.id}` }, (p) =>
        setFotos((xs) => [p.new as Foto, ...xs.filter((x) => x.id !== (p.new as Foto).id)]),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `evento_id=eq.${evento.id}` }, (p) =>
        setMensajes((xs) => [p.new as Mensaje, ...xs]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargar, evento.id]);

  const visibles = fotos.filter((f) =>
    filtro === "pendientes" ? f.estado === "pendiente" || f.mision_estado === "pendiente"
      : filtro === "misiones" ? f.mision_id
      : filtro === "ocultas" ? f.estado === "oculta"
      : true,
  );
  const urls = useUrls(visibles.map((f) => f.thumb_path));
  const urlAmpliada = useUrls([ampliada?.storage_path]);

  async function actFoto(f: Foto, cambios: Partial<Foto>) {
    setFotos((xs) => xs.map((x) => (x.id === f.id ? { ...x, ...cambios } : x)));
    const { error } = await supabase.from("fotos").update(cambios).eq("id", f.id);
    if (error) {
      setError(mensajeError(error));
      cargar();
    }
  }

  async function actMensaje(m: Mensaje, cambios: Partial<Mensaje>) {
    setMensajes((xs) => xs.map((x) => (x.id === m.id ? { ...x, ...cambios } : x)));
    const { error } = await supabase.from("mensajes").update(cambios).eq("id", m.id);
    if (error) setError(mensajeError(error));
  }

  async function aprobarTodas() {
    const ids = fotos.filter((f) => f.estado === "pendiente").map((f) => f.id);
    if (!ids.length) return;
    await supabase.from("fotos").update({ estado: "aprobada" }).in("id", ids);
    cargar();
  }

  const mensajesPend = mensajes.filter((m) => m.estado === "pendiente").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["pendientes", "todas", "misiones", "ocultas"] as Filtro[]).map((x) => (
            <button key={x} onClick={() => setFiltro(x)} className={`btn-chico btn ${filtro === x ? "bg-slate-900 text-white" : "bg-white text-slate-600 border"}`}>
              {x[0].toUpperCase() + x.slice(1)}
              {x === "pendientes" && ` (${fotos.filter((f) => f.estado === "pendiente" || f.mision_estado === "pendiente").length})`}
            </button>
          ))}
          {filtro === "pendientes" && fotos.some((f) => f.estado === "pendiente") && (
            <button className="btn-primario btn-chico ml-auto" onClick={aprobarTodas}>Aprobar todas</button>
          )}
        </div>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!visibles.length && <p className="py-10 text-center text-slate-500">No hay fotos en esta vista.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visibles.map((f) => {
            const mis = f.mision_id ? misiones[f.mision_id] : null;
            return (
              <div key={f.id} className={`overflow-hidden rounded-xl border bg-white ${f.estado === "oculta" ? "opacity-50" : ""}`}>
                <button className="block aspect-square w-full bg-slate-100" onClick={() => setAmpliada(f)}>
                  {urls[f.thumb_path] && <img src={urls[f.thumb_path]} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </button>
                <div className="space-y-1.5 p-2 text-xs">
                  <p className="truncate font-semibold">{invitados[f.invitado_id]?.nombre ?? "—"} <span className="font-normal text-slate-400">{hora(f.created_at)}</span></p>
                  {mis && (
                    <p className="flex items-center gap-1 truncate text-sky-700"><IconoDuo nombre="mision" className="h-3.5 w-3.5 shrink-0" /> {mis.titulo} {f.mision_estado === "pendiente" ? "· a validar" : f.mision_estado === "rechazada" ? "· rechazada" : <IconoDuo nombre="check" className="h-3.5 w-3.5" trazo={2.4} />}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {f.estado !== "aprobada" && <button className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white" onClick={() => actFoto(f, { estado: "aprobada" })}>Aprobar</button>}
                    {f.estado !== "oculta" && <button className="rounded bg-slate-200 px-2 py-1" onClick={() => actFoto(f, { estado: "oculta" })}>Ocultar</button>}
                    <button className={`rounded px-2 py-1 ${f.destacada ? "bg-amber-400" : "bg-slate-100"}`} onClick={() => actFoto(f, { destacada: !f.destacada })} title="Destacar en pantalla y fotolibro"><IconoDuo nombre="chispa" className="h-4 w-4" /></button>
                    {f.mision_estado === "pendiente" && (
                      <>
                        <button className="rounded bg-sky-600 px-2 py-1 text-white" onClick={() => actFoto(f, { mision_estado: "aprobada" })}>Misión ✓</button>
                        <button className="rounded bg-rose-100 px-2 py-1 text-rose-700" onClick={() => actFoto(f, { mision_estado: "rechazada" })}>Misión ✗</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tarjeta h-fit space-y-3 p-4">
        <h2 className="font-bold">Mensajes {mensajesPend > 0 && <span className="chip bg-amber-100 text-amber-800">{mensajesPend} por aprobar</span>}</h2>
        {!mensajes.length && <p className="text-sm text-slate-500">Todavía no hay mensajes.</p>}
        <div className="max-h-[70vh] space-y-2 overflow-y-auto">
          {mensajes.map((m) => (
            <div key={m.id} className={`rounded-xl border p-3 text-sm ${m.estado === "oculta" ? "opacity-50" : ""}`}>
              <p className="whitespace-pre-wrap">{m.texto}</p>
              <p className="mt-1 text-xs text-slate-500">
                {invitados[m.invitado_id]?.nombre} · {hora(m.created_at)} {m.tipo === "dedicatoria" && "· dedicatoria"}
              </p>
              <div className="mt-2 flex gap-1 text-xs">
                {m.estado !== "aprobada" && <button className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white" onClick={() => actMensaje(m, { estado: "aprobada" })}>Aprobar</button>}
                {m.estado !== "oculta" && <button className="rounded bg-slate-200 px-2 py-1" onClick={() => actMensaje(m, { estado: "oculta" })}>Ocultar</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ampliada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setAmpliada(null)}>
          {urlAmpliada[ampliada.storage_path] && <img src={urlAmpliada[ampliada.storage_path]} alt="" className="max-h-full max-w-full rounded-lg" />}
        </div>
      )}
    </div>
  );
}
