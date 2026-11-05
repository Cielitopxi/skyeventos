import { useState } from "react";
import { armarHorario, camposHorario, textoHorario, useAjustes } from "../lib/horario";
import { mensajeError, supabase } from "../lib/supabase";
import { Aviso } from "./ui";

/** Campos de fecha y horario (sin guardar): los usa la contratación. */
export function CamposHorario({ fecha, desde, hasta, onChange }: {
  fecha: string;
  desde: string;
  hasta: string;
  onChange: (v: { fecha: string; desde: string; hasta: string }) => void;
}) {
  const a = useAjustes();
  const h = armarHorario(fecha, desde, hasta);
  const horas = h ? Math.round(((h.fin.getTime() - h.inicio.getTime()) / 3600e3) * 10) / 10 : 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <label className="block">
          <span className="etiqueta">Fecha</span>
          <input className="input" type="date" required value={fecha} onChange={(e) => onChange({ fecha: e.target.value, desde, hasta })} />
        </label>
        <label className="block">
          <span className="etiqueta">Empieza</span>
          <input className="input" type="time" required value={desde} onChange={(e) => onChange({ fecha, desde: e.target.value, hasta })} />
        </label>
        <label className="block">
          <span className="etiqueta">Termina</span>
          <input className="input" type="time" required value={hasta} onChange={(e) => onChange({ fecha, desde, hasta: e.target.value })} />
        </label>
      </div>
      {h && (
        <p className={`text-xs ${horas > 24 ? "text-red-600" : "text-slate-500"}`}>
          {horas > 24
            ? "El evento puede durar hasta 24 horas."
            : `${textoHorario(h.inicio.toISOString(), h.fin.toISOString())} · ${horas} h. Los invitados pueden entrar desde ${a.horas_antes} h antes y subir fotos hasta ${a.horas_despues} h después.`}
        </p>
      )}
    </div>
  );
}

/** Editar y guardar el horario de un evento ya creado (panel del anfitrión y admin). */
export function EditorHorario({ evento, onGuardado, admin = false }: {
  evento: { id: string; inicio_at?: string | null; fin_at?: string | null };
  onGuardado: () => void;
  admin?: boolean;
}) {
  const [v, setV] = useState(() => camposHorario(evento.inicio_at, evento.fin_at));
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const h = armarHorario(v.fecha, v.desde, v.hasta);
    if (!h) return setError("Completá fecha y horario.");
    setGuardando(true);
    setError("");
    const { error } = await supabase.rpc("definir_horario", { p_evento: evento.id, p_inicio: h.inicio.toISOString(), p_fin: h.fin.toISOString() });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    setOk(true);
    setTimeout(() => setOk(false), 2000);
    onGuardado();
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <CamposHorario {...v} onChange={setV} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button className="btn-primario w-full" disabled={guardando}>{ok ? "¡Guardado!" : guardando ? "Guardando…" : "Guardar horario"}</button>
      {!admin && <p className="text-xs text-slate-500">Lo podés cambiar hasta que el evento se habilita para los invitados. Después, escribinos.</p>}
    </form>
  );
}
