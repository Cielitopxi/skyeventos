import { useCallback, useEffect, useState } from "react";
import { Aviso } from "../../components/ui";
import { IconoDuo, Medalla } from "../../components/Iconos";
import { mensajeError, supabase } from "../../lib/supabase";
import { CATEGORIAS_SUGERIDAS } from "../../lib/tematicas";
import type { CategoriaVoto, EstadoVotacion, FilaResultado } from "../../lib/tipos";
import type { PropsTab } from "./EventoPanel";

const ESTADO: Record<EstadoVotacion, { t: string; c: string }> = {
  preparada: { t: "Preparada", c: "bg-slate-100 text-slate-600" },
  abierta: { t: "Votación abierta", c: "bg-emerald-100 text-emerald-700" },
  cerrada: { t: "Cerrada", c: "bg-amber-100 text-amber-800" },
  revelada: { t: "Revelada", c: "bg-sky-100 text-sky-700" },
};

export default function TabVotacion({ evento, plan }: PropsTab) {
  const [categorias, setCategorias] = useState<CategoriaVoto[]>([]);
  const [resultados, setResultados] = useState<FilaResultado[]>([]);
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from("votacion_categorias").select("*").eq("evento_id", evento.id).order("orden").order("created_at"),
      supabase.rpc("resultados_votacion", { p_evento: evento.id }),
    ]);
    setCategorias((c.data as CategoriaVoto[]) ?? []);
    setResultados((r.data as FilaResultado[]) ?? []);
  }, [evento.id]);

  // Los votos no se publican por Realtime (son secretos): se refrescan cada 10 s.
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 10_000);
    return () => clearInterval(t);
  }, [cargar]);

  if (plan && !plan.misiones) {
    return (
      <div className="tarjeta text-center">
        <IconoDuo nombre="votar" className="mx-auto h-10 w-10 text-sky-500" />
        <p className="mt-2 font-semibold">Los premios por votación están incluidos desde el plan Fiesta.</p>
      </div>
    );
  }

  async function crear(titulos: string[]) {
    setError("");
    const existentes = new Set(categorias.map((c) => c.titulo.toLowerCase()));
    const filas = titulos
      .map((t) => t.trim())
      .filter((t) => t && !existentes.has(t.toLowerCase()))
      .map((titulo, i) => ({ evento_id: evento.id, titulo, orden: categorias.length + i }));
    if (!filas.length) return;
    const r = await supabase.from("votacion_categorias").insert(filas);
    if (r.error) return setError(mensajeError(r.error));
    setNueva("");
    cargar();
  }

  async function cambiarEstado(c: CategoriaVoto, estado: EstadoVotacion) {
    setError("");
    const r = await supabase.from("votacion_categorias").update({ estado }).eq("id", c.id);
    if (r.error) return setError(mensajeError(r.error));
    if (estado === "abierta") {
      await supabase.from("anuncios").insert({ evento_id: evento.id, texto: `¡Ya podés votar! ${c.titulo}` });
    }
    cargar();
  }

  async function borrar(c: CategoriaVoto) {
    if (!confirm(`¿Borrar la categoría "${c.titulo}" y sus votos?`)) return;
    await supabase.from("votacion_categorias").delete().eq("id", c.id);
    cargar();
  }

  const abierto = evento.estado === "activo" || evento.estado === "cerrado";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-bold">Premios por votación</h2>
          <button className="btn-secundario btn-chico" onClick={() => crear(CATEGORIAS_SUGERIDAS)}>+ Agregar sugeridas</button>
        </div>
        <p className="text-sm text-slate-600">
          Cada invitado vota a otro invitado: un voto por categoría, que puede cambiar mientras la votación está abierta. Los votos son secretos; los resultados los ves
          solo vos hasta que los revelás en la pantalla.
        </p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!categorias.length && <div className="tarjeta text-center text-slate-500">Sin categorías todavía. Probá “Agregar sugeridas”.</div>}
        {categorias.map((c) => {
          const filas = resultados.filter((r) => r.categoria_id === c.id);
          const total = filas.reduce((s, r) => s + Number(r.votos), 0);
          return (
            <div key={c.id} className="tarjeta space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto font-semibold">
                  {c.titulo} <span className={`chip ${ESTADO[c.estado].c}`}>{ESTADO[c.estado].t}</span>
                </p>
                {c.estado === "preparada" && (
                  <button className="btn-primario btn-chico" disabled={!abierto} onClick={() => cambiarEstado(c, "abierta")} title="Se anuncia en la pantalla">
                    Abrir votación
                  </button>
                )}
                {c.estado === "abierta" && <button className="btn-secundario btn-chico" onClick={() => cambiarEstado(c, "cerrada")}>Cerrar votación</button>}
                {c.estado === "cerrada" && (
                  <>
                    <button className="btn-secundario btn-chico" disabled={!abierto} onClick={() => cambiarEstado(c, "abierta")}>Reabrir</button>
                    <button className="btn-primario btn-chico" disabled={!total} onClick={() => cambiarEstado(c, "revelada")} title="Muestra al ganador en la pantalla y a los invitados">
                      <IconoDuo nombre="premio" className="mr-1 inline h-4 w-4 align-[-3px]" />Revelar ganador
                    </button>
                  </>
                )}
                {c.estado === "revelada" && <button className="btn-secundario btn-chico" onClick={() => cambiarEstado(c, "cerrada")}>Ocultar resultado</button>}
                <button className="btn-secundario btn-chico text-rose-600" onClick={() => borrar(c)}>Borrar</button>
              </div>
              {total > 0 ? (
                <ol className="space-y-1.5">
                  {filas.slice(0, 5).map((r, i) => (
                    <li key={r.candidato_id} className="flex items-center gap-3 text-sm">
                      <span className="flex w-6 justify-center"><Medalla puesto={i + 1} className="h-5 w-5" /></span>
                      <span className="w-40 truncate">
                        {r.nombre}
                        {r.mesa && <span className="text-slate-400"> · mesa {r.mesa}</span>}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-sky-400" style={{ width: `${(Number(r.votos) / Number(filas[0].votos)) * 100}%` }} />
                      </span>
                      <span className="w-14 text-right font-semibold">{r.votos} {Number(r.votos) === 1 ? "voto" : "votos"}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">{c.estado === "preparada" ? "Abrila cuando quieras que los invitados empiecen a votar." : "Todavía no hay votos."}</p>
              )}
              {total > 0 && <p className="text-xs text-slate-500">{total} votos en total</p>}
            </div>
          );
        })}
      </div>

      <div className="tarjeta h-fit space-y-3">
        <h2 className="font-bold">Nueva categoría</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crear([nueva]);
          }}
          className="flex gap-2"
        >
          <input className="input" maxLength={60} placeholder="Ej: Mejor look" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <button className="btn-primario btn-chico shrink-0">Agregar</button>
        </form>
        <p className="text-xs leading-relaxed text-slate-500">
          Sugerencia: abrí cada categoría en un momento distinto de la fiesta y revelá a los ganadores juntos al final, para la entrega de premios.
        </p>
      </div>
    </div>
  );
}
