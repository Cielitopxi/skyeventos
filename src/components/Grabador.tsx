import { useCallback, useEffect, useRef, useState } from "react";
import { formatoGrabacion, MAX_CLIP, tipoBase, type MedioClip } from "../lib/clip";
import { IconoDuo } from "./Iconos";

interface Props {
  medio: MedioClip;
  titulo?: string;
  onListo: (archivo: File, duracion: number) => void;
  onCerrar: () => void;
}

/** Graba un clip de hasta 10 segundos con la cámara o el micrófono y lo deja revisar antes de enviarlo. */
export function Grabador({ medio, titulo, onListo, onCerrar }: Props) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [frente, setFrente] = useState(medio === "video" ? false : true);
  const [error, setError] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [transcurrido, setTranscurrido] = useState(0);
  const [resultado, setResultado] = useState<{ blob: Blob; url: string; duracion: number } | null>(null);
  const vivo = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const grabador = useRef<MediaRecorder | null>(null);
  const inicio = useRef(0);

  // Cámara / micrófono
  useEffect(() => {
    if (resultado) return;
    let cancelado = false;
    let actual: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia(
        medio === "video"
          ? { video: { facingMode: frente ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
          : { audio: { echoCancellation: true, noiseSuppression: true } },
      )
      .then((s) => {
        if (cancelado) return s.getTracks().forEach((t) => t.stop());
        actual = s;
        setStream(s);
        setError("");
      })
      .catch(() => setError(medio === "video" ? "Permití el acceso a la cámara y al micrófono para grabar." : "Permití el acceso al micrófono para grabar."));
    if (!navigator.mediaDevices) setError("Este navegador no permite grabar. Probá desde Chrome o Safari actualizados.");
    return () => {
      cancelado = true;
      actual?.getTracks().forEach((t) => t.stop());
    };
  }, [medio, frente, resultado]);

  useEffect(() => {
    if (vivo.current && stream) vivo.current.srcObject = stream;
  }, [stream]);

  // Medidor de audio mientras se escucha o graba
  useEffect(() => {
    if (medio !== "audio" || !stream || !lienzo.current) return;
    const ctx = new AudioContext();
    const analizador = ctx.createAnalyser();
    analizador.fftSize = 128;
    ctx.createMediaStreamSource(stream).connect(analizador);
    const datos = new Uint8Array(analizador.frequencyBinCount);
    const c = lienzo.current;
    const g = c.getContext("2d")!;
    let raf = 0;
    const dibujar = () => {
      analizador.getByteFrequencyData(datos);
      g.clearRect(0, 0, c.width, c.height);
      const n = 32;
      const w = c.width / n;
      for (let i = 0; i < n; i++) {
        const v = datos[i + 2] / 255;
        const h = Math.max(6, v * c.height * 0.9);
        g.fillStyle = `rgba(241, 217, 167, ${0.35 + v * 0.65})`;
        g.beginPath();
        g.roundRect(i * w + w * 0.2, (c.height - h) / 2, w * 0.6, h, w * 0.3);
        g.fill();
      }
      raf = requestAnimationFrame(dibujar);
    };
    dibujar();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close();
    };
  }, [medio, stream]);

  const detener = useCallback(() => grabador.current?.state === "recording" && grabador.current.stop(), []);

  function grabar() {
    if (!stream) return;
    const tipo = formatoGrabacion(medio);
    const rec = new MediaRecorder(stream, {
      ...(tipo ? { mimeType: tipo } : {}),
      ...(medio === "video" ? { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 } : { audioBitsPerSecond: 128_000 }),
    });
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    rec.onstop = () => {
      const duracion = Math.min(MAX_CLIP, (performance.now() - inicio.current) / 1000);
      const blob = new Blob(partes, { type: tipoBase(rec.mimeType || tipo || (medio === "video" ? "video/webm" : "audio/webm")) });
      setGrabando(false);
      setResultado({ blob, url: URL.createObjectURL(blob), duracion });
    };
    grabador.current = rec;
    rec.start(250);
    inicio.current = performance.now();
    setTranscurrido(0);
    setGrabando(true);
  }

  // Cuenta regresiva y corte automático a los 10 segundos
  useEffect(() => {
    if (!grabando) return;
    const t = setInterval(() => {
      const s = (performance.now() - inicio.current) / 1000;
      setTranscurrido(s);
      if (s >= MAX_CLIP) detener();
    }, 100);
    return () => clearInterval(t);
  }, [grabando, detener]);

  useEffect(() => () => { if (resultado) URL.revokeObjectURL(resultado.url); }, [resultado]);

  function usar() {
    if (!resultado) return;
    const ext = resultado.blob.type.includes("mp4") ? (medio === "video" ? "mp4" : "m4a") : resultado.blob.type.includes("ogg") ? "ogg" : "webm";
    onListo(new File([resultado.blob], `${medio}.${ext}`, { type: resultado.blob.type }), Math.round(resultado.duracion * 10) / 10);
  }

  const restante = Math.max(0, MAX_CLIP - transcurrido);
  const avance = Math.min(1, transcurrido / MAX_CLIP);
  const R = 38;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onCerrar} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Cerrar">
          <IconoDuo nombre="cruz" className="h-5 w-5" />
        </button>
        <p className="max-w-[60%] truncate text-sm font-medium text-white/80">{titulo ?? (medio === "video" ? "Video de hasta 10 segundos" : "Audio de hasta 10 segundos")}</p>
        {medio === "video" && !resultado ? (
          <button onClick={() => setFrente((f) => !f)} disabled={grabando} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Cambiar cámara">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9a8 8 0 0 1 14.3-3.4M20 15a8 8 0 0 1-14.3 3.4M18.5 2.5v3.2h-3.2M5.5 21.5v-3.2h3.2" />
            </svg>
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <p className="max-w-xs px-6 text-center text-white/80">{error}</p>
        ) : resultado ? (
          medio === "video" ? (
            <video src={resultado.url} className="max-h-full max-w-full" autoPlay loop playsInline controls />
          ) : (
            <div className="flex flex-col items-center gap-6 px-8">
              <IconoDuo nombre="microfono" className="h-16 w-16 text-[#f1d9a7]" trazo={1.3} />
              <audio src={resultado.url} controls autoPlay className="w-72" />
            </div>
          )
        ) : medio === "video" ? (
          <video ref={vivo} autoPlay muted playsInline className={`h-full w-full object-cover ${frente ? "-scale-x-100" : ""}`} />
        ) : (
          <div className="flex w-full flex-col items-center gap-8 px-8">
            <IconoDuo nombre="microfono" className={`h-14 w-14 ${grabando ? "text-rose-400" : "text-[#f1d9a7]"}`} trazo={1.3} />
            <canvas ref={lienzo} width={320} height={120} className="h-[120px] w-full max-w-xs" />
            <p className="text-center text-sm text-white/60">{grabando ? "Grabando… hablá cerca del teléfono" : "Dejá un saludo, un brindis o una dedicatoria"}</p>
          </div>
        )}
        {grabando && (
          <span className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm font-semibold tabular-nums backdrop-blur">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /> {restante.toFixed(1)} s
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        {resultado ? (
          <>
            <button onClick={() => setResultado(null)} className="rounded-full bg-white/10 px-6 py-3.5 font-semibold">Repetir</button>
            <button onClick={usar} className="flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-black">
              <IconoDuo nombre="subir" className="h-5 w-5" /> Compartir ({resultado.duracion.toFixed(0)} s)
            </button>
          </>
        ) : (
          <button
            onClick={grabando ? detener : grabar}
            disabled={!stream}
            className="relative flex h-[88px] w-[88px] items-center justify-center disabled:opacity-40"
            aria-label={grabando ? "Detener" : "Grabar"}
          >
            <svg viewBox="0 0 88 88" className="absolute inset-0 -rotate-90">
              <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="5" />
              <circle cx="44" cy="44" r={R} fill="none" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - avance)} />
            </svg>
            <span className={`bg-rose-500 transition-all ${grabando ? "h-7 w-7 rounded-md" : "h-[62px] w-[62px] rounded-full"}`} />
          </button>
        )}
      </div>
    </div>
  );
}
