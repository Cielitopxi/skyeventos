import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso, Cargando, Icono, Logo } from "../../components/ui";
import { asegurarSesion, mensajeError, supabase } from "../../lib/supabase";

interface InfoDemo {
  codigo: string;
  token_pantalla: string;
  nombre: string;
}

const PASOS = [
  { i: "camara", t: "Subí una foto", d: "Desde el celular de la izquierda, como si fueras un invitado." },
  { i: "pantalla", t: "Mirala en la pantalla", d: "Aparece en segundos en la proyección del salón." },
  { i: "bingo", t: "Jugá al bingo", d: "Completá el cartón de momentos con fotos y mirá cómo cambia el ranking por persona y por mesa." },
];

/** Demo pública: invitado y pantalla del evento DEMO, lado a lado. */
export default function Demo() {
  const [info, setInfo] = useState<InfoDemo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // La sesión se crea acá una sola vez: los dos iframes la comparten (mismo origen).
        await asegurarSesion();
        const { data, error } = await supabase.rpc("evento_demo");
        if (error) throw error;
        const d = (data as InfoDemo[])[0];
        if (!d) throw new Error("La demo no está disponible en este momento.");
        setInfo(d);
      } catch (e) {
        setError(mensajeError(e));
      }
    })();
  }, []);

  const urlInvitado = info ? `/e/${info.codigo}` : "";
  const urlPantalla = info ? `/pantalla/${info.codigo}?k=${info.token_pantalla}` : "";

  return (
    <div className="marca min-h-screen bg-marfil text-noche">
      <section className="cielo relative overflow-hidden text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo claro />
          <Link to="/contratar" className="rounded-full border border-oro/50 px-4 py-2 text-sm font-semibold text-[#dbe5ee] transition hover:border-oro hover:bg-oro/10">
            Crear mi evento
          </Link>
        </header>
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-6 text-center md:pb-16">
          <p className="rotulo justify-center text-oro">Demo en vivo</p>
          <h1 className="mt-4 text-4xl leading-tight md:text-5xl">
            Probalo como <em className="texto-oro">un invitado más.</em>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/65">
            Este es un evento de prueba real. Lo que subas se ve en la pantalla al instante, igual que en tu fiesta.
          </p>
        </div>

        <div className="mx-auto max-w-6xl px-5 pb-20">
          {error ? (
            <div className="mx-auto max-w-md"><Aviso tipo="error">{error}</Aviso></div>
          ) : !info ? (
            <div className="text-white/60"><Cargando texto="Preparando la demo…" /></div>
          ) : (
            <>
              {/* Escritorio: celular + pantalla */}
              <div className="hidden items-center gap-10 lg:flex">
                <figure className="shrink-0">
                  <div className="rounded-[2.6rem] bg-gradient-to-b from-[#3a4650] to-[#1a242d] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10">
                    <iframe title="Invitado" src={urlInvitado} className="h-[640px] w-[330px] rounded-[2.1rem] bg-white" />
                  </div>
                  <figcaption className="mt-4 text-center text-xs uppercase tracking-[.2em] text-white/45">Celular del invitado</figcaption>
                </figure>
                <figure className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-[#10171d] p-2.5 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10">
                    <iframe title="Pantalla en vivo" src={urlPantalla} className="aspect-video w-full rounded-lg bg-black" />
                  </div>
                  <div className="mx-auto h-6 w-24 bg-gradient-to-b from-[#26323c] to-transparent" />
                  <figcaption className="text-center text-xs uppercase tracking-[.2em] text-white/45">Pantalla del salón</figcaption>
                </figure>
              </div>

              {/* Celular: accesos directos */}
              <div className="mx-auto grid max-w-md gap-3 lg:hidden">
                <Link to={urlInvitado} className="flex items-center gap-4 rounded-2xl bg-marfil p-5 text-noche shadow-elevada">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-white"><Icono nombre="camara" className="h-5 w-5" /></span>
                  <span className="flex-1">
                    <span className="block font-semibold">Entrar como invitado</span>
                    <span className="text-sm text-slate-600">Subí fotos, dejá mensajes y jugá misiones</span>
                  </span>
                </Link>
                <a href={urlPantalla} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/[.05] p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-oro/50 text-oro"><Icono nombre="pantalla" className="h-5 w-5" /></span>
                  <span className="flex-1">
                    <span className="block font-semibold">Abrir la pantalla en vivo</span>
                    <span className="text-sm text-white/55">Ideal en una compu o un televisor</span>
                  </span>
                </a>
                <p className="mt-2 text-center text-xs text-white/45">
                  Código del evento: <b className="font-display text-base tracking-[.25em] text-[#dbe5ee]">{info.codigo}</b>
                </p>
              </div>
            </>
          )}
        </div>
        <div className="hilo-oro absolute inset-x-0 bottom-0" />
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 md:grid-cols-3">
          {PASOS.map((p, i) => (
            <div key={p.t} className="border-t border-slate-300 pt-6">
              <span className="flex items-center gap-3 text-sky-500">
                <Icono nombre={p.i} className="h-5 w-5" />
                <span className="font-display text-xl italic">0{i + 1}</span>
              </span>
              <h3 className="mt-3 text-xl">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl bg-noche px-8 py-10 text-white md:flex-row">
          <div>
            <h2 className="text-3xl">¿Te imaginás tu evento así?</h2>
            <p className="mt-2 text-white/60">Elegí la temática, cargá tus misiones y en minutos lo tenés listo.</p>
          </div>
          <Link to="/contratar" className="shrink-0 rounded-full bg-gradient-to-b from-[#dbe5ee] to-[#8fa5b6] px-7 py-3.5 font-semibold text-noche">
            Crear mi evento
          </Link>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          La demo es pública: no subas fotos personales. El contenido se limpia periódicamente.
        </p>
      </section>
    </div>
  );
}
