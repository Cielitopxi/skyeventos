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

/** Isotipo: luna creciente y estrella sobre medianoche. */
export function Isotipo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="iso-oro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0dcb0" />
          <stop offset=".55" stopColor="#c9a96e" />
          <stop offset="1" stopColor="#a8854c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#151827" />
      <rect x=".5" y=".5" width="63" height="63" rx="15.5" fill="none" stroke="url(#iso-oro)" strokeOpacity=".45" />
      <path d="M38 14a18 18 0 1 0 12 30A15 15 0 0 1 38 14z" fill="url(#iso-oro)" />
      <path d="M44 18l1.4 3.6L49 23l-3.6 1.4L44 28l-1.4-3.6L39 23l3.6-1.4z" fill="#f3e3bf" />
    </svg>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <Link to="/" className={`group flex items-center gap-2.5 ${claro ? "text-white" : "text-noche"}`}>
      <Isotipo />
      <span className="font-display text-[1.35rem] font-medium leading-none tracking-tight">
        Sky<span className={`italic ${claro ? "texto-oro" : "text-sky-500"}`}>Eventos</span>
      </span>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b0d18]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onCerrar}>
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
};

/** Íconos de línea (trazo 1.5) para las páginas de marca. */
export function Icono({ nombre, className = "h-6 w-6" }: { nombre: keyof typeof TRAZOS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TRAZOS[nombre]}
    </svg>
  );
}
