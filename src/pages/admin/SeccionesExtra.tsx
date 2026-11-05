import { useEffect, useState } from "react";
import { Aviso, Cargando } from "../../components/ui";
import { nombreTipo } from "../../lib/formato";
import { cargarAjustes, type Ajustes } from "../../lib/horario";
import { mensajeError, supabase } from "../../lib/supabase";

/** Márgenes del horario: cuántas horas antes del inicio y después del fin pueden participar los invitados. */
export function SeccionHorarios() {
  const [a, setA] = useState<Ajustes | null>(null);
  const [msj, setMsj] = useState("");
  useEffect(() => {
    cargarAjustes(true).then(setA);
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!a) return;
    const { error } = await supabase
      .from("ajustes")
      .update({ horas_antes: a.horas_antes, horas_despues: a.horas_despues, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setMsj(error ? mensajeError(error) : "Guardado. Rige para todos los eventos, también los ya contratados.");
    cargarAjustes(true);
  }

  if (!a) return <Cargando />;
  const abre = String((21 - a.horas_antes + 48) % 24).padStart(2, "0");
  return (
    <form onSubmit={guardar} className="tarjeta max-w-xl space-y-4">
      <p className="font-display text-xl">Habilitación de los eventos</p>
      <p className="text-sm text-slate-600">
        Cada evento tiene su horario contratado. Los invitados pueden registrarse e instalar la app en cualquier momento, pero subir fotos, dejar mensajes y
        jugar solo dentro de esta ventana. Los anfitriones pueden probar siempre.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="etiqueta">Horas antes del inicio</span>
          <input className="input tabular-nums" type="number" min={0} max={48} required value={a.horas_antes} onChange={(e) => setA({ ...a, horas_antes: Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="etiqueta">Horas después del fin</span>
          <input className="input tabular-nums" type="number" min={0} max={168} required value={a.horas_despues} onChange={(e) => setA({ ...a, horas_despues: Number(e.target.value) })} />
        </label>
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        Ejemplo: un evento de 21:00 a 05:00 se habilita a las {abre}:00 y cierra {a.horas_despues} h después de las 05:00. Si el anfitrión cierra el evento a
        mano, también quedan {a.horas_despues} h para subir lo que falte.
      </p>
      {msj && <Aviso>{msj}</Aviso>}
      <button className="btn-primario">Guardar</button>
      <p className="text-xs text-slate-500">El horario de cada evento se corrige desde Eventos, tocando la fecha.</p>
    </form>
  );
}

interface FilaContacto {
  email: string;
  nombre: string;
  evento: string;
  tipo: string;
  fecha: string | null;
  acepta_novedades: boolean;
  registrado_at: string;
}

/** Emails de invitados. Para publicidad, usar solo los que aceptaron recibir novedades. */
export function SeccionContactos() {
  const [filas, setFilas] = useState<FilaContacto[] | null>(null);
  const [soloAcepta, setSoloAcepta] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.rpc("admin_contactos").then(({ data, error }) => {
      if (error) setError(mensajeError(error));
      setFilas((data as FilaContacto[]) ?? []);
    });
  }, []);
  if (!filas) return <Cargando />;
  const lista = filas.filter((f) => !soloAcepta || f.acepta_novedades);
  const unicos = new Set(lista.map((f) => f.email)).size;

  function descargar() {
    const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Email", "Nombre", "Evento", "Tipo", "Fecha", "Acepta novedades", "Registrado"],
      ...lista.map((f) => [f.email, f.nombre, f.evento, nombreTipo(f.tipo), f.fecha ?? "", f.acepta_novedades ? "sí" : "no", f.registrado_at.slice(0, 10)]),
    ]
      .map((r) => r.map(esc).join(","))
      .join("\n");
    // Con BOM, Excel abre bien los acentos.
    const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos-skyeventos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloAcepta} onChange={(e) => setSoloAcepta(e.target.checked)} /> Solo quienes aceptaron recibir novedades
        </label>
        <span className="text-sm text-slate-500">{unicos} emails distintos</span>
        <button className="btn-primario ml-auto" onClick={descargar} disabled={!lista.length}>Descargar CSV</button>
      </div>
      <p className="text-xs text-slate-500">
        Para mandar publicidad usá solo los contactos que aceptaron (Ley 25.326). Cada envío tiene que incluir cómo darse de baja:{" "}
        <span className="font-mono">eventos.skystudio.ar/baja</span>.
      </p>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Novedades</th>
              <th className="px-4 py-3">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.slice(0, 300).map((f, i) => (
              <tr key={f.email + i}>
                <td className="px-4 py-2.5 font-medium">{f.email}</td>
                <td className="px-4 py-2.5">{f.nombre}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {f.evento} <span className="text-xs text-slate-400">· {nombreTipo(f.tipo)}</span>
                </td>
                <td className="px-4 py-2.5">
                  {f.acepta_novedades ? <span className="chip bg-emerald-100 text-emerald-800">sí</span> : <span className="chip bg-slate-100 text-slate-500">no</span>}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-slate-500">{new Date(f.registrado_at).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <p className="p-8 text-center text-slate-500">Todavía no hay contactos{soloAcepta ? " que hayan aceptado novedades" : ""}.</p>}
        {lista.length > 300 && <p className="p-3 text-center text-xs text-slate-500">Se muestran 300 de {lista.length}. El CSV tiene todos.</p>}
      </div>
    </div>
  );
}
