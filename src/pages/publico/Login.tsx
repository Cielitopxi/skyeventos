import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Aviso, Campo, Icono, Logo } from "../../components/ui";
import { useUsuario } from "../../components/useUsuario";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";

/**
 * Ingreso de anfitriones. Por defecto con enlace mágico por email.
 * Quien ya definió una contraseña (por ejemplo, el administrador) puede entrar con ella.
 */
export default function Login() {
  const [params] = useSearchParams();
  // Solo rutas internas: evita que un link armado mande el enlace mágico (y la sesión) a otro sitio.
  const pedido = params.get("volver") ?? "";
  const volver = /^\/(?![/\\])/.test(pedido) ? pedido : "/panel";
  // Llega con ?nueva=1 desde el mail de "olvidé mi contraseña": ya tiene sesión y elige una nueva.
  const nueva = params.get("nueva") === "1";
  const { usuario } = useUsuario();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [conClave, setConClave] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario && !nueva) nav(volver, { replace: true });
  }, [usuario, nueva, volver, nav]);

  async function olvide() {
    setError("");
    if (!email.trim()) return setError("Escribí tu email y volvé a tocar “Olvidé mi contraseña”.");
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: APP_URL + "/ingresar?nueva=1" });
    setEnviando(false);
    if (error) setError(mensajeError(error));
    else setEnviado(true);
  }

  async function guardarNueva(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (clave.length < 8) return setError("Usá al menos 8 caracteres.");
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) setError(mensajeError(error));
    else nav("/panel", { replace: true });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    if (conClave) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
      setEnviando(false);
      // La redirección la hace el efecto de arriba cuando aparece la sesión.
      if (error) setError(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : mensajeError(error));
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: APP_URL + volver, shouldCreateUser: true },
    });
    setEnviando(false);
    if (error) setError(mensajeError(error));
    else setEnviado(true);
  }

  return (
    <div className="marca cielo relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="hilo-oro absolute inset-x-0 top-0" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo claro />
        </div>
        <div className="rounded-3xl bg-marfil p-8 shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)] ring-1 ring-oro/30">
          {nueva && usuario ? (
            <form onSubmit={guardarNueva} className="space-y-5">
              <div>
                <p className="rotulo text-sky-500">Contraseña</p>
                <h1 className="mt-3 text-[1.9rem] leading-tight">Elegí tu contraseña</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Para <b className="text-noche">{usuario.email}</b>. Al menos 8 caracteres.</p>
              </div>
              <Campo label="Nueva contraseña">
                <input className="input" type="password" required autoFocus autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
              </Campo>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn w-full rounded-full bg-noche py-3 text-white hover:bg-slate-800" disabled={enviando}>
                {enviando ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          ) : enviado ? (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-sky-300 text-sky-500">
                <Icono nombre="mensaje" className="h-6 w-6" />
              </span>
              <h1 className="mt-5 text-2xl">Revisá tu correo</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Te enviamos un enlace a <b className="text-noche">{email}</b>. Abrilo desde este dispositivo para ingresar.
              </p>
              <button className="btn-secundario mt-6 w-full" onClick={() => setEnviado(false)}>Usar otro email</button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-5">
              <div>
                <p className="rotulo text-sky-500">Anfitriones</p>
                <h1 className="mt-3 text-[1.9rem] leading-tight">Ingresá a tu cuenta</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {conClave ? "Con el email y la contraseña de tu cuenta." : "Para crear y administrar tus eventos. Sin contraseña: te mandamos un enlace."}
                </p>
              </div>
              <Campo label="Email">
                <input className="input" type="email" required autoFocus autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Campo>
              {conClave && (
                <Campo label="Contraseña">
                  <input className="input" type="password" required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
                </Campo>
              )}
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn w-full rounded-full bg-noche py-3 text-white hover:bg-slate-800" disabled={enviando}>
                {enviando ? (conClave ? "Ingresando…" : "Enviando…") : conClave ? "Ingresar" : "Enviarme el enlace"}
              </button>
              <button
                type="button"
                className="w-full text-center text-sm text-slate-500 underline decoration-oro/50 underline-offset-4 hover:text-noche"
                onClick={() => { setConClave(!conClave); setError(""); }}
              >
                {conClave ? "Prefiero recibir un enlace por email" : "Tengo contraseña"}
              </button>
              {conClave && (
                <button type="button" className="w-full text-center text-sm text-slate-500 hover:text-noche" onClick={olvide} disabled={enviando}>
                  Olvidé mi contraseña
                </button>
              )}
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-white/45">
          ¿Sos invitado? <Link to="/e" className="text-[#dbe5ee] underline decoration-oro/50 underline-offset-4">Entrá con el código del evento</Link>
        </p>
      </div>
    </div>
  );
}
