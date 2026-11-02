import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Aviso, Logo } from "../../components/ui";
import { useUsuario } from "../../components/useUsuario";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";

/** Ingreso de anfitriones con enlace mágico por email. */
export default function Login() {
  const [params] = useSearchParams();
  const volver = params.get("volver") || "/panel";
  const { usuario } = useUsuario();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) nav(volver, { replace: true });
  }, [usuario, volver, nav]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: APP_URL + volver, shouldCreateUser: true },
    });
    setEnviando(false);
    if (error) setError(mensajeError(error));
    else setEnviado(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="tarjeta">
          {enviado ? (
            <div className="text-center">
              <div className="text-4xl">📬</div>
              <h1 className="mt-2 text-lg font-bold">Revisá tu correo</h1>
              <p className="mt-1 text-sm text-slate-600">
                Te enviamos un enlace a <b>{email}</b>. Abrilo desde este dispositivo para ingresar.
              </p>
              <button className="btn-secundario mt-4 w-full" onClick={() => setEnviado(false)}>Usar otro email</button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <h1 className="text-lg font-bold">Ingresá a tu cuenta</h1>
                <p className="text-sm text-slate-600">Para crear y administrar tus eventos. Sin contraseña: te mandamos un enlace.</p>
              </div>
              <input className="input" type="email" required autoFocus placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn-primario w-full" disabled={enviando}>{enviando ? "Enviando…" : "Enviarme el enlace"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
