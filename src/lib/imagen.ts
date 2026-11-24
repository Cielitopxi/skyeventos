/** Reduce la foto en el teléfono antes de subirla: versión completa + miniatura (JPEG). */
export interface ImagenProcesada {
  completa: Blob;
  miniatura: Blob;
  ancho: number;
  alto: number;
}

async function cargar(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* algunos navegadores no aceptan opciones: se cae al <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Efecto "rollo" de cámara descartable: tono cálido, negros lavados, grano, viñeta
 * y la fecha estampada en naranja abajo a la derecha.
 */
function efectoRollo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const datos = ctx.getImageData(0, 0, w, h);
  const px = datos.data;
  const fuerzaGrano = Math.max(10, Math.min(22, w / 90));
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    const luz = 0.299 * r + 0.587 * g + 0.114 * b;
    // Un poco menos de saturación, tono cálido y negros lavados.
    r = luz + (r - luz) * 0.86; g = luz + (g - luz) * 0.86; b = luz + (b - luz) * 0.86;
    r = r * 1.05 + 10; g = g * 1.0 + 4; b = b * 0.86 + 6;
    r = r * 0.92 + 14; g = g * 0.92 + 12; b = b * 0.92 + 10;
    const grano = (Math.random() + Math.random() - 1) * fuerzaGrano;
    px[i] = r + grano; px[i + 1] = g + grano; px[i + 2] = b + grano;
  }
  ctx.putImageData(datos, 0, 0);
  const vineta = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  vineta.addColorStop(0, "rgba(0,0,0,0)");
  vineta.addColorStop(1, "rgba(20,8,0,0.38)");
  ctx.fillStyle = vineta;
  ctx.fillRect(0, 0, w, h);
  const d = new Date();
  const fecha = `${String(d.getDate()).padStart(2, " ")} ${String(d.getMonth() + 1).padStart(2, " ")} '${String(d.getFullYear()).slice(2)}`;
  const tam = Math.round(Math.min(w, h) * 0.045);
  ctx.font = `bold ${tam}px "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(255,120,20,0.9)";
  ctx.shadowBlur = tam * 0.35;
  ctx.fillStyle = "rgb(255,155,60)";
  ctx.fillText(fecha, w - tam * 1.1, h - tam * 0.9);
  ctx.shadowBlur = 0;
}

function aBlob(fuente: CanvasImageSource, w: number, h: number, maxLado: number, calidad: number, rollo = false): Promise<{ blob: Blob; w: number; h: number }> {
  const escala = Math.min(1, maxLado / Math.max(w, h));
  const cw = Math.round(w * escala);
  const ch = Math.round(h * escala);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, 0, 0, cw, ch);
  if (rollo) efectoRollo(ctx, cw, ch);
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok({ blob: b, w: cw, h: ch }) : mal(new Error("No se pudo procesar la imagen"))), "image/jpeg", calidad),
  );
}

export async function procesarImagen(file: Blob, maxLado = 2048, opciones: { rollo?: boolean } = {}): Promise<ImagenProcesada> {
  const img = await cargar(file);
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const completa = await aBlob(img, w, h, maxLado, 0.85, opciones.rollo);
  const miniatura = await aBlob(img, w, h, 520, 0.75, opciones.rollo);
  if ("close" in img) img.close();
  return { completa: completa.blob, miniatura: miniatura.blob, ancho: completa.w, alto: completa.h };
}
