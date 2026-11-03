import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm tracking-wide text-tema-suave">
      <span className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-tema-acento/80 border-t-transparent" />
      {texto}
    </div>
  );
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "error" | "ok"; children: ReactNode }) {
  const c =
    tipo === "error"
      ? "border-rose-200 bg-rose-50/80 text-rose-900 before:bg-rose-500"
      : tipo === "ok"
        ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 before:bg-emerald-500"
        : "border-sky-200 bg-sky-50 text-slate-800 before:bg-sky-400";
  return (
    <div className={`relative overflow-hidden rounded-xl border py-3 pl-5 pr-4 text-sm before:absolute before:inset-y-0 before:left-0 before:w-1 ${c}`}>
      {children}
    </div>
  );
}

// Hojas del diafragma (la "O" del logo): 6 cuñas con los tonos del logo y un hexágono central.
const TONOS_HOJAS = ["#c5d3e0", "#97a8b4", "#6a889e", "#2f4a5a", "#6a889e", "#97a8b4"];
const punto = (a: number, r: number) => `${(32 + r * Math.cos(a)).toFixed(2)},${(32 + r * Math.sin(a)).toFixed(2)}`;
const HOJAS = TONOS_HOJAS.map((c, i) => {
  const a = (i * Math.PI) / 3 - Math.PI / 2;
  const b = a + Math.PI / 3;
  // cada hoja arranca en un vértice del hexágono central y abre hacia el borde (efecto giro)
  return { c, pts: [punto(a, 6), punto(a + 0.4, 18), punto(b + 0.4, 18), punto(b, 6)].join(" ") };
});
const HEXAGONO = Array.from({ length: 6 }, (_, i) => punto((i * Math.PI) / 3 - Math.PI / 2, 6)).join(" ");

/** Diafragma de cámara del logo SkyEventos (aro de 48 u. de diámetro, visor arriba). */
export function Diafragma({ className = "h-9 w-9", aro = "#4d6170", centro = "#f4f6f8" }: { className?: string; aro?: string; centro?: string }) {
  return (
    <svg viewBox="8 0 48 58" className={className} aria-hidden>
      <path d="M24 1h16l4 7H20z" fill="#97a8b4" />
      <g transform="translate(0 2)">
        <circle cx="32" cy="32" r="18" fill={centro} />
        {HOJAS.map((h) => (
          <polygon key={h.pts} points={h.pts} fill={h.c} />
        ))}
        <polygon points={HEXAGONO} fill={centro} />
        <circle cx="32" cy="32" r="20.5" fill="none" stroke={aro} strokeWidth="7" />
      </g>
    </svg>
  );
}

export function Isotipo({ className = "h-9 w-9", claro = false }: { className?: string; claro?: boolean }) {
  return <Diafragma className={className} aro={claro ? "#dbe5ee" : "#4d6170"} centro={claro ? "#1a242d" : "#f4f6f8"} />;
}

/** Wordmark "skyEVENTOS" con la O como diafragma, igual que el logo. */
export function Logo({ claro = false, className = "text-[1.6rem]" }: { claro?: boolean; className?: string }) {
  const caja = claro ? "text-[#e3eaf0]" : "text-sky-500";
  return (
    <Link to="/" aria-label="SkyEventos" className={`flex items-baseline leading-none ${className}`} style={{ fontFamily: "Archivo, 'Arial Black', sans-serif" }}>
      <span className="font-extrabold tracking-[-0.045em] text-[#97a8b4]">sky</span>
      <span className={`font-black tracking-[-0.02em] ${caja}`}>EVENT</span>
      {/* aro de 0.76em ≈ altura de mayúsculas; el visor sobresale arriba como en el logo */}
      <Isotipo claro={claro} className="mx-[.03em] h-[.92em] w-[.76em] translate-y-[.035em] self-baseline" />
      <span className={`font-black tracking-[-0.02em] ${caja}`}>S</span>
    </Link>
  );
}

export function Campo({ label, children, ayuda }: { label: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="etiqueta">{label}</span>
      {children}
      {ayuda && <span className="mt-1.5 block text-xs leading-relaxed text-tema-suave">{ayuda}</span>}
    </label>
  );
}

export function Modal({ abierto, onCerrar, titulo, children }: { abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10171d]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        className="subir max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-tema-suave/10 bg-tema-superficie p-6 text-tema-texto shadow-elevada sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-tema-suave transition hover:bg-tema-suave/10 hover:text-tema-texto"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Contenedor que aplica la temática del evento (variables CSS). */
export function ConTema({ estilo, className = "", children }: { estilo: CSSProperties; className?: string; children: ReactNode }) {
  return (
    <div style={{ ...estilo, background: "rgb(var(--t-fondo))", color: "rgb(var(--t-texto))", fontFamily: "var(--t-font-cuerpo)" }} className={className}>
      {children}
    </div>
  );
}

const TRAZOS: Record<string, ReactNode> = {
  camara: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  mensaje: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  pantalla: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  diana: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  libro: (
    <>
      <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx=".8" />
      <rect x="14" y="4" width="6" height="6" rx=".8" />
      <rect x="4" y="14" width="6" height="6" rx=".8" />
      <path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  mesas: (
    <>
      <ellipse cx="12" cy="12" rx="5" ry="3" />
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
      <circle cx="4.5" cy="12" r="1.6" />
      <circle cx="19.5" cy="12" r="1.6" />
    </>
  ),
  bingo: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16" />
      <path d="M5.8 5.8l2 2M10.9 11.1l2 2M16.1 16.4l2 2" />
    </>
  ),
  trivia: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" />
      <path d="M12 16.6v.2" />
    </>
  ),
  premio: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4" />
      <path d="M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5z" />
    </>
  ),
  capsula: (
    <>
      <path d="M8 3.5h8M8 20.5h8" />
      <path d="M9 3.5c0 4 6 5 6 8.5s-6 4.5-6 8.5M15 3.5c0 4-6 5-6 8.5s6 4.5 6 8.5" />
    </>
  ),
};

/** Íconos de línea (trazo 1.5) para las páginas de marca. */
export function Icono({ nombre, className = "h-6 w-6" }: { nombre: keyof typeof TRAZOS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TRAZOS[nombre]}
    </svg>
  );
}
