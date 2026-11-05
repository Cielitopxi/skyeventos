import { useState } from "react";
import { mensajeError, supabase } from "../lib/supabase";
import { Aviso } from "./ui";

/** Cambiar la contraseña de la cuenta con la sesión iniciada. */
export function MiContrasena() {
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
    setMsj({ tipo: "ok", t: "Contraseña guardada." });
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
