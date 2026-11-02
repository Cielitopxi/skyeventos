import { estiloTematica, tematica } from "../lib/tematicas";
import type { Personalizacion } from "../lib/tipos";

/** Mini celular con la página del invitado, para elegir temática. */
export function VistaPrevia({ tematicaId, nombre, p, portadaUrl }: { tematicaId: string; nombre: string; p: Personalizacion; portadaUrl?: string }) {
  const t = tematica(tematicaId);
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-[7px] border-slate-900 bg-slate-900 shadow-xl">
      <div
        style={{ ...estiloTematica(tematicaId, p), background: t.fondoDecorado, color: "rgb(var(--t-texto))", fontFamily: "var(--t-font-cuerpo)" }}
        className="overflow-hidden rounded-[1.5rem]"
      >
        {portadaUrl && <img src={portadaUrl} alt="" className="h-28 w-full object-cover" />}
        <div className="px-4 py-5 text-center">
          <p className="text-[10px] uppercase tracking-[.25em] text-tema-suave">{p.subtitulo || "Bienvenidos"}</p>
          <p className="mt-1 text-3xl leading-tight text-tema-acento" style={{ fontFamily: "var(--t-font-titulo)" }}>
            {p.titulo || nombre || "Nuestro evento"}
          </p>
          <p className="mt-1 text-tema-acento">{t.ornamento}</p>
          <p className="mt-2 line-clamp-3 text-[11px] text-tema-suave">{p.bienvenida || "Compartí tus fotos y dejanos un mensaje."}</p>
        </div>
        <div className="grid grid-cols-3 gap-1 px-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-square rounded bg-tema-acento/20" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
        <div className="m-3 rounded-xl bg-tema-acento py-2.5 text-center text-sm font-semibold text-white">📷 Subir fotos</div>
      </div>
    </div>
  );
}
