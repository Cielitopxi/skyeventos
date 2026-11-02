import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso, Logo } from "../../components/ui";
import { supabase } from "../../lib/supabase";

/** Entrada de invitados por código de evento. */
export default function Ingresar() {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const nav = useNavigate();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (c.length < 4) return;
    setBuscando(true);
    setError("");
    const { data } = await supabase.rpc("evento_por_codigo", { p_codigo: c });
    setBuscando(false);
    if (!data?.length) setError("No encontramos un evento activo con ese código.");
    else nav(`/e/${c}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-white">
      <Logo claro />
      <form onSubmit={entrar} className="mt-8 w-full max-w-xs space-y-4 text-center">
        <h1 className="text-xl font-bold">Ingresá el código del evento</h1>
        <input
          className="w-full rounded-2xl border-0 bg-white/10 px-4 py-4 text-center text-3xl font-bold uppercase tracking-[.3em] text-white outline-none ring-2 ring-white/20 placeholder:text-white/30 focus:ring-sky-400"
          maxLength={8}
          autoFocus
          placeholder="ABC123"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/[^a-z0-9]/gi, ""))}
        />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <button className="w-full rounded-2xl bg-sky-500 py-3.5 font-semibold disabled:opacity-50" disabled={buscando || codigo.length < 4}>
          {buscando ? "Buscando…" : "Entrar"}
        </button>
        <p className="text-xs text-white/50">El código está en el QR de tu mesa o te lo pasaron los anfitriones.</p>
      </form>
    </div>
  );
}
