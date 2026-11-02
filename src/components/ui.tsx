import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-tema-suave">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-tema-acento border-t-transparent" />
      {texto}
    </div>
  );
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "error" | "ok"; children: ReactNode }) {
  const c =
    tipo === "error"
      ? "border-rose-300 bg-rose-50 text-rose-800"
      : tipo === "ok"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-sky-300 bg-sky-50 text-sky-900";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold ${claro ? "text-white" : "text-slate-900"}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#0f172a" />
        <path d="M20 40a10 10 0 0 1 2-19.8A14 14 0 0 1 48 26a8 8 0 0 1-2 14z" fill="#38bdf8" />
        <circle cx="44" cy="18" r="4" fill="#fbbf24" />
      </svg>
      <span style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }} className="text-lg">
        Sky<span className="text-sky-500">Eventos</span>
      </span>
    </Link>
  );
}

export function Campo({ label, children, ayuda }: { label: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="etiqueta">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-tema-suave">{ayuda}</span>}
    </label>
  );
}

export function Modal({ abierto, onCerrar, titulo, children }: { abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-tema-superficie p-5 text-tema-texto shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button className="rounded-full p-1 text-2xl leading-none text-tema-suave hover:bg-tema-suave/10" onClick={onCerrar} aria-label="Cerrar">
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
