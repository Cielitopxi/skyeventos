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
    <div className="marca cielo relative flex min-h-screen flex-col items-center justify-center px-5 text-white">
      <div className="hilo-oro absolute inset-x-0 top-0" />
      <Logo claro />
      <form onSubmit={entrar} className="mt-12 w-full max-w-sm space-y-6 text-center">
        <div>
          <p className="rotulo justify-center text-oro">Invitados</p>
          <h1 className="mt-4 text-3xl leading-tight">Ingresá el código <em className="texto-oro">del evento</em></h1>
        </div>
        <input
          className="w-full rounded-2xl border border-oro/30 bg-white/[.06] px-4 py-5 text-center font-display text-4xl uppercase tracking-[.35em] text-[#f3e3bf] outline-none transition placeholder:text-white/20 focus:border-oro focus:bg-white/[.09] focus:ring-4 focus:ring-oro/15"
          maxLength={8}
          autoFocus
          placeholder="ABC123"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/[^a-z0-9]/gi, ""))}
        />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <button
          className="w-full rounded-full bg-gradient-to-b from-[#e9d3a3] to-[#c09a5c] py-4 font-semibold text-noche shadow-[0_10px_30px_-10px_rgba(201,169,110,.8)] transition hover:brightness-105 disabled:opacity-40 disabled:shadow-none"
          disabled={buscando || codigo.length < 4}
        >
          {buscando ? "Buscando…" : "Entrar al evento"}
        </button>
        <p className="text-xs leading-relaxed text-white/45">El código está en el QR de tu mesa o te lo pasaron los anfitriones.</p>
      </form>
    </div>
  );
}
