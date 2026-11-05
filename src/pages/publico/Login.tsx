import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Aviso, Campo, Logo } from "../../components/ui";
import { useUsuario } from "../../components/useUsuario";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";

/** El botón de Google aparece cuando el proveedor está activo en Supabase (VITE_LOGIN_GOOGLE=1). */
const CON_GOOGLE = import.meta.env.VITE_LOGIN_GOOGLE === "1";

/**
 * Ingreso de anfitriones con email y contraseña (o Google). No se manda ningún mail: la cuenta se crea
 * ya confirmada desde la función `cuentas`, y si alguien olvida la contraseña, un admin le pone una nueva.
 */
export default function Login() {
  const [params] = useSearchParams();
  // Solo rutas internas: evita que un link armado mande la sesión a otro sitio.
  const pedido = params.get("volver") ?? "";
  const volver = /^\/(?![/\\])/.test(pedido) ? pedido : "/panel";
  const { usuario } = useUsuario();
  const nav = useNavigate();
  const [modo, setModo] = useState<"ingresar" | "crear" | "olvide">(params.get("registro") === "1" ? "crear" : "ingresar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) nav(volver, { replace: true });
  }, [usuario, volver, nav]);

  async function conGoogle() {
    setError("");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: APP_URL + volver } });
    if (error) {
      setEnviando(false);
      setError(mensajeError(error));
    }
  }

  async function ingresar() {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    // La redirección la hace el efecto de arriba cuando aparece la sesión.
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : mensajeError(error));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (modo === "crear") {
      if (clave.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
      if (clave !== repetir) return setError("Las contraseñas no coinciden.");
    }
    setEnviando(true);
    try {
      if (modo === "crear") {
        const { data, error } = await supabase.functions.invoke("cuentas", { body: { accion: "registrar", email: email.trim(), clave } });
        if (error) {
          // El mensaje útil viene en el cuerpo de la respuesta (409: ya existe, 400: datos inválidos).
          const cuerpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
          throw new Error(cuerpo?.error || "No se pudo crear la cuenta");
        }
        if (!(data as { ok?: boolean })?.ok) throw new Error("No se pudo crear la cuenta");
      }
      await ingresar();
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }

  const cambiar = (m: typeof modo) => {
    setModo(m);
    setError("");
  };

  return (
    <div className="marca cielo tech relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="hilo-oro absolute inset-x-0 top-0" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo claro />
        </div>
        <div className="rounded-3xl bg-marfil p-8 shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)] ring-1 ring-oro/30">
          {modo === "olvide" ? (
            <div className="space-y-5">
              <div>
                <p className="rotulo text-sky-500">Contraseña</p>
                <h1 className="mt-3 text-[1.9rem] leading-tight">¿Olvidaste tu contraseña?</h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Escribinos desde{" "}
                  <a href="https://skystudio.ar" target="_blank" rel="noopener" className="font-medium text-noche underline decoration-oro/50 underline-offset-4">
                    skystudio.ar
                  </a>{" "}
                  con el email de tu cuenta y te damos una contraseña nueva. Después la podés cambiar desde tu panel.
                </p>
              </div>
              <button className="btn-secundario w-full" onClick={() => cambiar("ingresar")}>Volver</button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-5">
              <div className="grid grid-cols-2 rounded-full bg-slate-200/70 p-1 text-sm font-semibold">
                {(["ingresar", "crear"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => cambiar(m)}
                    className={`rounded-full py-2 transition ${modo === m ? "bg-white text-noche shadow" : "text-slate-500 hover:text-noche"}`}
                  >
                    {m === "ingresar" ? "Ingresar" : "Crear cuenta"}
                  </button>
                ))}
              </div>
              <div>
                <p className="rotulo text-sky-500">Anfitriones</p>
                <h1 className="mt-3 text-[1.9rem] leading-tight">{modo === "crear" ? "Creá tu cuenta" : "Ingresá a tu cuenta"}</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {modo === "crear" ? "Con tu email y una contraseña. Entrás al instante, sin confirmar nada por mail." : "Para crear y administrar tus eventos."}
                </p>
              </div>
              {CON_GOOGLE && (
                <>
                  <button type="button" className="btn-secundario w-full rounded-full py-3" onClick={conGoogle} disabled={enviando}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
                      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
                      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
                    </svg>
                    Continuar con Google
                  </button>
                  <p className="flex items-center gap-3 text-[11px] uppercase tracking-[.2em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />o con tu email<span className="h-px flex-1 bg-slate-200" /></p>
                </>
              )}
              <Campo label="Email">
                <input className="input" type="email" required autoFocus autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Campo>
              <Campo label="Contraseña" ayuda={modo === "crear" ? "Al menos 8 caracteres." : undefined}>
                <div className="relative">
                  <input
                    className="input pr-16"
                    type={ver ? "text" : "password"}
                    required
                    minLength={modo === "crear" ? 8 : undefined}
                    autoComplete={modo === "crear" ? "new-password" : "current-password"}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                  />
                  <button type="button" className="absolute inset-y-0 right-3 text-xs font-semibold text-slate-500" onClick={() => setVer(!ver)}>
                    {ver ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </Campo>
              {modo === "crear" && (
                <Campo label="Repetí la contraseña">
                  <input className="input" type={ver ? "text" : "password"} required autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
                </Campo>
              )}
              {error && <Aviso tipo="error">{error}</Aviso>}
              <button className="btn w-full rounded-full bg-noche py-3 text-white hover:bg-slate-800" disabled={enviando}>
                {enviando ? (modo === "crear" ? "Creando tu cuenta…" : "Ingresando…") : modo === "crear" ? "Crear cuenta" : "Ingresar"}
              </button>
              {modo === "ingresar" && (
                <button type="button" className="w-full text-center text-sm text-slate-500 hover:text-noche" onClick={() => cambiar("olvide")}>
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
