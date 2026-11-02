import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { FilaRanking, Invitado } from "../../lib/tipos";
import type { PropsTab } from "./EventoPanel";

export default function TabInvitados({ evento }: PropsTab) {
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [ranking, setRanking] = useState<Record<string, FilaRanking>>({});
  const [buscar, setBuscar] = useState("");

  const cargar = useCallback(async () => {
    const [i, r] = await Promise.all([
      supabase.from("invitados").select("*").eq("evento_id", evento.id).order("nombre"),
      supabase.rpc("ranking", { p_evento: evento.id }),
    ]);
    setInvitados((i.data as Invitado[]) ?? []);
    setRanking(Object.fromEntries(((r.data as FilaRanking[]) ?? []).map((x) => [x.invitado_id, x])));
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function bloquear(i: Invitado) {
    if (!i.bloqueado && !confirm(`¿Bloquear a ${i.nombre}? No podrá subir más contenido y sus fotos dejan de verse en pantalla.`)) return;
    await supabase.from("invitados").update({ bloqueado: !i.bloqueado }).eq("id", i.id);
    if (!i.bloqueado) await supabase.from("fotos").update({ estado: "oculta" }).eq("invitado_id", i.id);
    cargar();
  }

  const lista = invitados
    .filter((i) => i.nombre.toLowerCase().includes(buscar.toLowerCase()))
    .sort((a, b) => (ranking[b.id]?.puntos ?? 0) - (ranking[a.id]?.puntos ?? 0));

  return (
    <div className="tarjeta p-0">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <h2 className="mr-auto font-bold">{invitados.length} invitados conectados</h2>
        <input className="input max-w-xs" placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Mesa</th>
              <th className="px-4 py-2 text-right">Fotos</th>
              <th className="px-4 py-2 text-right">Misiones</th>
              <th className="px-4 py-2 text-right">Puntos</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.map((i, n) => (
              <tr key={i.id} className={i.bloqueado ? "opacity-50" : ""}>
                <td className="px-4 py-2 text-slate-400">{n + 1}</td>
                <td className="px-4 py-2 font-medium">{i.nombre}</td>
                <td className="px-4 py-2">{i.mesa ?? "—"}</td>
                <td className="px-4 py-2 text-right">{ranking[i.id]?.fotos ?? 0}</td>
                <td className="px-4 py-2 text-right">{ranking[i.id]?.misiones ?? 0}</td>
                <td className="px-4 py-2 text-right font-bold">{ranking[i.id]?.puntos ?? 0}</td>
                <td className="px-4 py-2 text-right">
                  <button className="text-xs font-semibold text-rose-600" onClick={() => bloquear(i)}>{i.bloqueado ? "Desbloquear" : "Bloquear"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <p className="p-8 text-center text-slate-500">Todavía no entró nadie. Compartí el QR o el código.</p>}
      </div>
    </div>
  );
}
