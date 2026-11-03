import type { CSSProperties, ReactNode } from "react";
import type { MarcoFoto } from "../lib/tipos";

/** Marcos de foto instantánea: cuadro cuadrado, borde parejo y franja ancha abajo para escribir. */
export const MARCOS: { id: MarcoFoto; nombre: string; fondo: string; texto: string }[] = [
  { id: "blanco", nombre: "Blanco", fondo: "#fbfaf6", texto: "#3d3a33" },
  { id: "negro", nombre: "Negro", fondo: "#161616", texto: "#efece4" },
  { id: "crema", nombre: "Crema", fondo: "#efe3c8", texto: "#5a4730" },
];

/** Proporción alto/ancho del marco (como las instantáneas cuadradas). */
export const PROPORCION_MARCO = 1.19;

/** Leve inclinación estable por foto, para que un conjunto parezca apoyado a mano. */
export const giro = (id: string, max = 2.5) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * max;
};

interface Props {
  marco: MarcoFoto;
  children: ReactNode; // la imagen: se recorta al cuadrado
  pie?: string | null; // texto manuscrito de la franja inferior
  mini?: boolean; // miniaturas: sin texto
  inclinar?: number; // grados
  className?: string;
  style?: CSSProperties;
}

/**
 * Foto con marco instantánea. El tamaño lo define quien la usa (ancho, o alto con `h-full`):
 * todo lo interno se mide en unidades del contenedor, así se ve igual en una miniatura o en la pantalla.
 */
export function Instantanea({ marco, children, pie, mini = false, inclinar = 0, className = "", style }: Props) {
  const m = MARCOS.find((x) => x.id === marco) ?? MARCOS[0];
  return (
    <div className={`[container-type:inline-size] ${className}`} style={{ aspectRatio: `1 / ${PROPORCION_MARCO}`, rotate: inclinar ? `${inclinar}deg` : undefined, ...style }}>
      <div
        className="flex h-full w-full flex-col"
        style={{
          background: m.fondo,
          padding: "5.5cqw 5.5cqw 0",
          boxShadow: "0 1.2cqw 3.5cqw rgba(0,0,0,.28), 0 .3cqw .6cqw rgba(0,0,0,.12)",
          borderRadius: ".6cqw",
        }}
      >
        <div className="aspect-square w-full overflow-hidden bg-black/10 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>video]:h-full [&>video]:w-full [&>video]:object-cover">
          {children}
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-[3cqw]">
          {!mini && pie && (
            <p className="truncate text-center leading-none" style={{ color: m.texto, fontFamily: "Caveat, 'Segoe Print', cursive", fontSize: "8.5cqw", fontWeight: 500 }}>
              {pie}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Muestra de un marco para elegirlo (selector al subir y en Personalizar). */
export function MuestraMarco({ marco, activo, onClick, etiqueta }: { marco: MarcoFoto | null; activo: boolean; onClick: () => void; etiqueta: string }) {
  const m = marco ? MARCOS.find((x) => x.id === marco)! : null;
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={`flex h-[58px] w-[49px] flex-col rounded-[3px] p-[4px] pb-0 shadow-md ring-2 ring-offset-2 transition ${activo ? "ring-current" : "ring-transparent"}`}
        style={{ background: m?.fondo ?? "transparent", boxShadow: m ? undefined : "none" }}
      >
        <span className={`block aspect-square w-full rounded-[1px] ${m ? "bg-gradient-to-br from-sky-300 to-amber-200" : "border border-dashed border-current opacity-40"}`} />
      </span>
      <span className={`text-[11px] ${activo ? "font-semibold" : "opacity-70"}`}>{etiqueta}</span>
    </button>
  );
}
