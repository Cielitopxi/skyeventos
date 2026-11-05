import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CompartirRedes } from "../../components/CompartirRedes";
import { marcoDe } from "../../components/Instantanea";
import { Cargando, Logo } from "../../components/ui";
import { disenoDe, formatoDe, type DisenoLibro, type FormatoLibro } from "../../lib/libro";
import { APP_URL, mensajeError, supabase } from "../../lib/supabase";
import type { Evento, Foto, Invitado, Mensaje } from "../../lib/tipos";
import { urlsFirmadas } from "../../lib/urls";
import { HojasLibro } from "./Fotolibro";
import type { DatosLibro } from "./PaginasLibro";

/** Fotolibro compartido por link: se ve sin cuenta, solo con lo que el anfitrión aprobó para el libro. */
export default function LibroPublico() {
  const { token } = useParams();
  const [datos, setDatos] = useState<DatosLibro | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [formato, setFormato] = useState<FormatoLibro>("a4h");
  const [diseno, setDiseno] = useState<DisenoLibro>("clasico");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return setError("El link no es válido.");
      const { data, error } = await supabase.rpc("libro_compartido", { p_token: token });
      if (error) throw error;
      if (!data) return setError("Este fotolibro ya no está compartido o el link no existe.");
      const r = data as { evento: Evento; invitados: Invitado[]; fotos: Foto[]; mensajes: Mensaje[] };
      const p = r.evento.personalizacion ?? {};
      const todas = r.fotos.map((f) => ({ ...f, marco: marcoDe(f, p) }));
      const clips = todas.filter((f) => f.medio !== "foto");
      const QRCode = (await import("qrcode")).default;
      const qrs = Object.fromEntries(
        await Promise.all(clips.map(async (c) => [c.id, await QRCode.toDataURL(`${APP_URL}/c/${c.id}`, { width: 300, margin: 0 })] as const)),
      );
      const d: DatosLibro = {
        evento: r.evento,
        invitados: r.invitados,
        fotos: todas.filter((f) => f.medio === "foto"),
        clips,
        qrs,
        mensajes: r.mensajes,
        misiones: [],
        ranking: [],
        premios: [],
      };
      const paths = [...d.fotos.map((f) => f.storage_path), ...d.clips.map((c) => c.thumb_path)].filter(Boolean) as string[];
      if (p.portada_path) paths.push(p.portada_path);
      setUrls(await urlsFirmadas(paths));
      setFormato(formatoDe(p.libro?.formato));
      setDiseno(disenoDe(p.libro?.diseno));
      document.title = `${p.titulo || r.evento.nombre} · Fotolibro`;
      setDatos(d);
    })().catch((e) => setError(mensajeError(e)));
  }, [token]);

  if (error)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche px-4 text-center text-[#dbe5ee]">
        <Logo claro />
        <p>{error}</p>
        <Link to="/" className="btn-primario">Conocé SkyEventos</Link>
      </div>
    );
  if (!datos) return <Cargando texto="Abriendo el fotolibro…" />;

  const nombre = datos.evento.personalizacion?.titulo || datos.evento.nombre;
  const url = `${APP_URL}/libro/${token}`;

  return (
    <HojasLibro
      datos={datos}
      urls={urls}
      formato={formato}
      diseno={diseno}
      ajustarPantalla
      barra={() => (
        <div className="no-imprimir sticky top-0 z-10 border-b border-white/10 bg-noche/95 text-white backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <Logo claro className="text-[1.3rem]" />
            <p className="mr-auto text-sm text-white/70">Fotolibro de <b className="text-white">{nombre}</b></p>
            <Link to="/" className="btn-primario btn-luz text-sm">Quiero uno para mi evento</Link>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-3">
            <CompartirRedes oscuro url={url} titulo={`Fotolibro de ${nombre}`} texto={`Mirá el fotolibro de ${nombre} 📸`} />
          </div>
        </div>
      )}
    />
  );
}
