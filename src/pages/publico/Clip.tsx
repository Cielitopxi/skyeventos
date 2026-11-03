import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { IconoDuo } from "../../components/Iconos";
import { Cargando, ConTema } from "../../components/ui";
import { formatoDuracion } from "../../lib/clip";
import { fechaLarga } from "../../lib/formato";
import { asegurarSesion, mensajeError, supabase } from "../../lib/supabase";
import { estiloTematica, tematica } from "../../lib/tematicas";
import { urlsFirmadas } from "../../lib/urls";

interface ClipPublico {
  storage_path: string;
  thumb_path: string;
  medio: "video" | "audio";
  duracion: number;
  caption: string | null;
  invitado: string;
  evento: string;
  titulo: string | null;
  tematica: string;
  fecha: string | null;
}

/** /c/:id — lo abre el QR impreso en el fotolibro: un video o audio de un invitado. */
export default function Clip() {
  const { id = "" } = useParams();
  const [clip, setClip] = useState<ClipPublico | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await asegurarSesion();
        const { data, error } = await supabase.rpc("clip_publico", { p_id: id });
        if (error) throw error;
        const c = (data as ClipPublico[] | null)?.[0];
        if (!c) return setError("Este recuerdo ya no está disponible.");
        setClip(c);
        setUrls(await urlsFirmadas([c.storage_path, c.thumb_path]));
      } catch (e) {
        setError(mensajeError(e));
      }
    })();
  }, [id]);

  if (error)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center">
        <IconoDuo nombre="lupa" className="h-12 w-12 text-slate-400" />
        <p className="text-slate-600">{error}</p>
      </div>
    );
  if (!clip) return <Cargando texto="Abriendo el recuerdo…" />;

  const t = tematica(clip.tematica);
  const src = urls[clip.storage_path];

  return (
    <ConTema estilo={estiloTematica(clip.tematica)} className="min-h-screen">
      <div style={{ background: t.fondoDecorado }} className="flex min-h-screen flex-col items-center px-5 pb-10 pt-10 text-center">
        <p className="text-[11px] uppercase tracking-[.35em] text-tema-suave">{clip.fecha ? fechaLarga(clip.fecha) : "Un recuerdo de"}</p>
        <h1 className="mt-1 text-4xl leading-tight text-tema-acento" style={{ fontFamily: "var(--t-font-titulo)" }}>{clip.titulo || clip.evento}</h1>
        <p className="mt-1 text-tema-acento">{t.ornamento}</p>

        <div className="mt-8 w-full max-w-md overflow-hidden rounded-3xl bg-tema-superficie shadow-xl">
          {!src ? (
            <Cargando texto="" />
          ) : clip.medio === "video" ? (
            <video src={src} poster={urls[clip.thumb_path]} controls autoPlay playsInline className="max-h-[70vh] w-full bg-black" />
          ) : (
            <div className="p-5">
              {urls[clip.thumb_path] && <img src={urls[clip.thumb_path]} alt="" className="w-full rounded-2xl" />}
              <audio src={src} controls autoPlay className="mt-4 w-full" />
            </div>
          )}
          <div className="flex items-center gap-3 px-5 py-4 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tema-acento/15 text-tema-acento">
              <IconoDuo nombre={clip.medio === "video" ? "video" : "microfono"} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{clip.medio === "video" ? "Video" : "Mensaje de voz"} de {clip.invitado}</p>
              <p className="text-sm text-tema-suave">{clip.caption || formatoDuracion(clip.duracion)}</p>
            </div>
          </div>
        </div>
        <p className="mt-auto pt-10 text-xs text-tema-suave">SkyEventos · fotolibro con recuerdos para ver y escuchar</p>
      </div>
    </ConTema>
  );
}
