import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Aviso, Logo } from "../../components/ui";
import { mensajeError, supabase } from "../../lib/supabase";

/** Baja de novedades y promociones (el link va en cada email de publicidad). */
export default function Baja() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  const [error, setError] = useState("");

  async function baja(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("baja_novedades", { p_email: email });
    if (error) {
      setError(mensajeError(error));
      setEstado("error");
    } else setEstado("ok");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marfil px-4">
      <form onSubmit={baja} className="tarjeta w-full max-w-md space-y-4">
        <Logo />
        <h1 className="text-2xl">Dejar de recibir novedades</h1>
        {estado === "ok" ? (
          <Aviso tipo="ok">Listo: no te vamos a mandar más novedades ni promociones a {email.trim().toLowerCase()}.</Aviso>
        ) : (
          <>
            <p className="text-sm text-slate-600">Escribí tu email y no te mandamos más publicidad. Tus fotos y mensajes en los eventos no cambian.</p>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
            {estado === "error" && <Aviso tipo="error">{error}</Aviso>}
            <button className="btn-primario w-full">Darme de baja</button>
          </>
        )}
      </form>
    </div>
  );
}
