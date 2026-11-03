import { formatoDuracion } from "../lib/clip";
import type { Foto } from "../lib/tipos";
import { IconoDuo } from "./Iconos";

/** Marca sobre la miniatura de un clip: ícono de video o audio y su duración. */
export function MarcaClip({ foto, className = "" }: { foto: Pick<Foto, "medio" | "duracion">; className?: string }) {
  if (foto.medio === "foto") return null;
  return (
    <span className={`absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/55 py-0.5 pl-1.5 pr-2 text-[10px] font-semibold tabular-nums text-white backdrop-blur ${className}`}>
      <IconoDuo nombre={foto.medio === "video" ? "play" : "microfono"} className="h-3 w-3" trazo={2} />
      {formatoDuracion(foto.duracion)}
    </span>
  );
}
