import { estiloTematica, tematica } from "../lib/tematicas";
import type { Personalizacion } from "../lib/tipos";
import { IconoDuo } from "./Iconos";
import { Portada } from "./Portada";

/** Mini celular con la página del invitado, para elegir temática. */
export function VistaPrevia({ tematicaId, nombre, p, portadaUrl }: { tematicaId: string; nombre: string; p: Personalizacion; portadaUrl?: string }) {
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-[7px] border-slate-900 bg-slate-900 shadow-xl">
      <div
        style={{ ...estiloTematica(tematicaId, p), background: tematica(tematicaId).fondoDecorado, color: "rgb(var(--t-texto))", fontFamily: "var(--t-font-cuerpo)" }}
        className="overflow-hidden rounded-[1.5rem]"
      >
        <Portada tematicaId={tematicaId} nombre={nombre} p={p} url={portadaUrl} mini />
        <p className="line-clamp-3 px-4 pb-3 pt-1 text-center text-[11px] text-tema-suave">{p.bienvenida || "Compartí tus fotos y dejanos un mensaje."}</p>
        <div className="grid grid-cols-3 gap-1 px-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-square rounded bg-tema-acento/20" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
        <div className="m-3 flex items-center justify-center gap-2 rounded-xl bg-tema-acento py-2.5 text-sm font-semibold text-white"><IconoDuo nombre="camara" className="h-4 w-4" /> Subir fotos</div>
      </div>
    </div>
  );
}
