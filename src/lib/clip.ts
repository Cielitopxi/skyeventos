/** Clips de video y audio de hasta 10 segundos: duración, miniatura y formato para subir. */
export const MAX_CLIP = 10;

export type MedioClip = "video" | "audio";

export interface ClipProcesado {
  archivo: Blob;
  contentType: string;
  extension: string;
  miniatura: Blob;
  ancho: number | null;
  alto: number | null;
  duracion: number;
}

const EXTENSIONES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** "video/webm;codecs=vp9" → "video/webm" (el bucket compara el tipo sin parámetros). */
export const tipoBase = (mime: string) => mime.split(";")[0].trim().toLowerCase();

export const medioDe = (f: Blob): MedioClip | null => (f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : null);

export const formatoDuracion = (s: number | null | undefined) => `0:${String(Math.round(s ?? 0)).padStart(2, "0")}`;

/** Elige el formato que el navegador sabe grabar (Safari: mp4; Chrome/Android: webm). */
export function formatoGrabacion(medio: MedioClip): string {
  const opciones =
    medio === "video"
      ? ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return opciones.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

function elemento(file: Blob, medio: MedioClip): Promise<HTMLVideoElement | HTMLAudioElement> {
  const el = document.createElement(medio === "video" ? "video" : "audio") as HTMLVideoElement;
  el.preload = "metadata";
  el.muted = true;
  if ("playsInline" in el) el.playsInline = true;
  el.src = URL.createObjectURL(file);
  return new Promise((ok, mal) => {
    el.onloadedmetadata = () => ok(el);
    el.onerror = () => mal(new Error("No se pudo leer el archivo"));
  });
}

/** Duración real. Los webm que graba Chrome dicen "Infinity" hasta que se los recorre. */
async function duracionDe(el: HTMLMediaElement): Promise<number> {
  if (Number.isFinite(el.duration)) return el.duration;
  return new Promise((ok) => {
    el.ontimeupdate = () => {
      el.ontimeupdate = null;
      ok(Number.isFinite(el.duration) ? el.duration : 0);
      el.currentTime = 0;
    };
    el.currentTime = 1e101;
  });
}

export async function duracionArchivo(file: Blob): Promise<number> {
  const medio = medioDe(file) ?? "video";
  const el = await elemento(file, medio);
  try {
    return await duracionDe(el);
  } finally {
    URL.revokeObjectURL(el.src);
  }
}

function lienzoABlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo generar la miniatura"))), "image/jpeg", 0.8));
}

async function miniaturaVideo(el: HTMLVideoElement, duracion: number) {
  await new Promise<void>((ok) => {
    el.onseeked = () => ok();
    el.currentTime = Math.min(0.4, duracion / 2);
  });
  const w = el.videoWidth || 720;
  const h = el.videoHeight || 1280;
  const escala = Math.min(1, 520 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * escala);
  c.height = Math.round(h * escala);
  c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
  return { miniatura: await lienzoABlob(c), ancho: w, alto: h };
}

/** Miniatura del audio: la forma de onda real (o una genérica si el navegador no la decodifica). */
async function miniaturaAudio(file: Blob) {
  const N = 42;
  let barras: number[] = [];
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const datos = buf.getChannelData(0);
    const paso = Math.floor(datos.length / N);
    for (let i = 0; i < N; i++) {
      let suma = 0;
      for (let j = 0; j < paso; j++) suma += Math.abs(datos[i * paso + j] ?? 0);
      barras.push(suma / paso);
    }
    ctx.close();
    const max = Math.max(...barras, 0.0001);
    barras = barras.map((b) => Math.max(0.06, b / max));
  } catch {
    barras = Array.from({ length: N }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)));
  }
  const L = 520;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d")!;
  const fondo = g.createLinearGradient(0, 0, L, L);
  fondo.addColorStop(0, "#1d2c3b");
  fondo.addColorStop(1, "#0f1822");
  g.fillStyle = fondo;
  g.fillRect(0, 0, L, L);
  const ancho = (L - 80) / N;
  const oro = g.createLinearGradient(0, L * 0.25, 0, L * 0.75);
  oro.addColorStop(0, "#f1d9a7");
  oro.addColorStop(1, "#b98d4a");
  g.fillStyle = oro;
  barras.forEach((b, i) => {
    const alto = b * L * 0.42;
    const x = 40 + i * ancho + ancho * 0.18;
    g.beginPath();
    g.roundRect(x, L / 2 - alto / 2, ancho * 0.64, alto, ancho * 0.32);
    g.fill();
  });
  return { miniatura: await lienzoABlob(c), ancho: null, alto: null };
}

/**
 * Prepara un clip para subir. `duracionConocida` viene del grabador (más precisa que la
 * metadata de los webm). Rechaza los que pasan los 10 segundos.
 */
export async function procesarClip(file: Blob, duracionConocida?: number): Promise<ClipProcesado> {
  const medio = medioDe(file);
  if (!medio) throw new Error("Formato no admitido");
  const contentType = tipoBase(file.type);
  const extension = EXTENSIONES[contentType];
  if (!extension) throw new Error("Formato de video o audio no admitido");
  const el = await elemento(file, medio);
  try {
    const real = await duracionDe(el);
    const duracion = Math.round(Math.min(duracionConocida || real || 0, MAX_CLIP + 0.5) * 10) / 10;
    if ((duracionConocida ?? real) > MAX_CLIP + 0.5) throw new Error(`Los clips pueden durar hasta ${MAX_CLIP} segundos`);
    if (!duracion) throw new Error("No se pudo leer la duración del clip");
    const mini = medio === "video" ? await miniaturaVideo(el as HTMLVideoElement, real || duracion) : await miniaturaAudio(file);
    return { archivo: file, contentType, extension, duracion, ...mini };
  } finally {
    URL.revokeObjectURL(el.src);
  }
}
