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

function aBlob(fuente: CanvasImageSource, w: number, h: number, maxLado: number, calidad: number): Promise<{ blob: Blob; w: number; h: number }> {
  const escala = Math.min(1, maxLado / Math.max(w, h));
  const cw = Math.round(w * escala);
  const ch = Math.round(h * escala);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, 0, 0, cw, ch);
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok({ blob: b, w: cw, h: ch }) : mal(new Error("No se pudo procesar la imagen"))), "image/jpeg", calidad),
  );
}

export async function procesarImagen(file: Blob, maxLado = 2048): Promise<ImagenProcesada> {
  const img = await cargar(file);
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const completa = await aBlob(img, w, h, maxLado, 0.85);
  const miniatura = await aBlob(img, w, h, 520, 0.75);
  if ("close" in img) img.close();
  return { completa: completa.blob, miniatura: miniatura.blob, ancho: completa.w, alto: completa.h };
}
