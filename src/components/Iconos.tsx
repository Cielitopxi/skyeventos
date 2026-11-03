import type { ReactNode } from "react";

/**
 * Íconos dibujados a dos tonos: una capa de relleno suave y el trazo encima.
 * Toman el color de `currentColor`, así se adaptan a cada temática.
 */
type Dibujo = { relleno?: ReactNode; trazo: ReactNode };

const DIBUJOS: Record<string, Dibujo> = {
  video: {
    relleno: <rect x="2.5" y="6" width="13" height="12" rx="2.5" />,
    trazo: (
      <>
        <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
        <path d="M15.5 10.2l4.6-2.7a.9.9 0 0 1 1.4.8v7.4a.9.9 0 0 1-1.4.8l-4.6-2.7" />
        <circle cx="6.5" cy="10" r="1" />
      </>
    ),
  },
  microfono: {
    relleno: <rect x="8.5" y="3" width="7" height="11.5" rx="3.5" />,
    trazo: (
      <>
        <rect x="8.5" y="3" width="7" height="11.5" rx="3.5" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7M8.5 7.5h2M8.5 10.5h2" />
      </>
    ),
  },
  play: {
    relleno: <path d="M8 5.3v13.4a1 1 0 0 0 1.5.9l10.6-6.7a1 1 0 0 0 0-1.8L9.5 4.4A1 1 0 0 0 8 5.3z" />,
    trazo: <path d="M8 5.3v13.4a1 1 0 0 0 1.5.9l10.6-6.7a1 1 0 0 0 0-1.8L9.5 4.4A1 1 0 0 0 8 5.3z" />,
  },
  fotos: {
    relleno: <rect x="3" y="5" width="15" height="13" rx="2.5" />,
    trazo: (
      <>
        <rect x="3" y="5" width="15" height="13" rx="2.5" />
        <path d="M7 3h12.5A1.5 1.5 0 0 1 21 4.5V15" />
        <circle cx="8" cy="9.5" r="1.4" />
        <path d="M3.5 16l4.2-4.1a1.2 1.2 0 0 1 1.7 0L14 16.5M12 14.5l1.6-1.5a1.2 1.2 0 0 1 1.7 0l2.4 2.3" />
      </>
    ),
  },
  juegos: {
    relleno: <path d="M6.5 8h11a4 4 0 0 1 3.9 4.9l-.9 4a2.6 2.6 0 0 1-4.5 1.1L14 15.5h-4L8 18a2.6 2.6 0 0 1-4.5-1.1l-.9-4A4 4 0 0 1 6.5 8z" />,
    trazo: (
      <>
        <path d="M6.5 8h11a4 4 0 0 1 3.9 4.9l-.9 4a2.6 2.6 0 0 1-4.5 1.1L14 15.5h-4L8 18a2.6 2.6 0 0 1-4.5-1.1l-.9-4A4 4 0 0 1 6.5 8z" />
        <path d="M7.5 10.5v3M6 12h3" />
        <circle cx="15.8" cy="11" r=".9" />
        <circle cx="17.6" cy="13" r=".9" />
        <path d="M12 8V5.5a1.5 1.5 0 0 1 1.5-1.5H15" />
      </>
    ),
  },
  mensajes: {
    relleno: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />,
    trazo: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />
        <path d="M8 8.5h8M8 11.5h5" />
      </>
    ),
  },
  ranking: {
    relleno: <path d="M9 10h6v10H9z" />,
    trazo: (
      <>
        <path d="M9 20V10h6v10M3 20v-6h6M15 20v-8h6v8M2 20h20" />
        <path d="M12 3.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 5.3l2-.3z" />
      </>
    ),
  },
  perfil: {
    relleno: <circle cx="12" cy="12" r="9" />,
    trazo: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="10" r="3.2" />
        <path d="M6.2 18.4a6.5 6.5 0 0 1 11.6 0" />
      </>
    ),
  },
  camara: {
    relleno: <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2l1.6-2.2h5.8l1.6 2.2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
    trazo: (
      <>
        <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2l1.6-2.2h5.8l1.6 2.2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
        <circle cx="12" cy="13" r="3.6" />
        <path d="M17.3 9.3h.01" />
      </>
    ),
  },
  galeria: {
    relleno: <rect x="3" y="3" width="18" height="18" rx="3" />,
    trazo: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="1.8" />
        <path d="M3.5 17l4.6-4.4a1.4 1.4 0 0 1 1.9 0L16 18.5M14 16.5l1.8-1.7a1.4 1.4 0 0 1 1.9 0l2.8 2.6" />
      </>
    ),
  },
  mision: {
    relleno: <circle cx="12" cy="12" r="8.5" />,
    trazo: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.6" />
        <path d="M12 12l6.5-6.5M16 4.5l2.5 1 1 2.5" />
      </>
    ),
  },
  bingo: {
    relleno: <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />,
    trazo: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
        <circle cx="6.35" cy="6.35" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="17.65" cy="17.65" r="1.2" />
      </>
    ),
  },
  trivia: {
    relleno: <path d="M12 3a9 9 0 1 1-6.4 15.4L3 20l1.3-3.3A9 9 0 0 1 12 3z" />,
    trazo: (
      <>
        <path d="M12 3a9 9 0 1 1-6.4 15.4L3 20l1.3-3.3A9 9 0 0 1 12 3z" />
        <path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.3" />
        <path d="M12 16.4v.1" />
      </>
    ),
  },
  votar: {
    relleno: <path d="M3.5 12.5h17v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
    trazo: (
      <>
        <path d="M3.5 12.5h17v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 12.5L6 8.5h2M20.5 12.5L18 8.5h-2" />
        <path d="M8 12.5V4.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8" />
        <path d="M10 8l1.5 1.5L14.5 6.5" />
        <path d="M9.5 16.5h5" />
      </>
    ),
  },
  capsula: {
    relleno: <path d="M7 3.5h10v3.2c0 2.3-2.5 3.6-3.6 5.3 1.1 1.7 3.6 3 3.6 5.3v3.2H7v-3.2c0-2.3 2.5-3.6 3.6-5.3C9.5 10.3 7 9 7 6.7z" />,
    trazo: (
      <>
        <path d="M5.5 3.5h13M5.5 20.5h13" />
        <path d="M7 3.5v3.2c0 2.3 2.5 3.6 3.6 5.3C9.5 13.7 7 15 7 17.3v3.2M17 3.5v3.2c0 2.3-2.5 3.6-3.6 5.3 1.1 1.7 3.6 3 3.6 5.3v3.2" />
        <path d="M9.5 18.5c.8-1.4 4.2-1.4 5 0" />
      </>
    ),
  },
  premio: {
    relleno: <path d="M7.5 3.5h9v5.5a4.5 4.5 0 0 1-9 0z" />,
    trazo: (
      <>
        <path d="M7.5 3.5h9v5.5a4.5 4.5 0 0 1-9 0z" />
        <path d="M7.5 5.5H5a2.5 2.5 0 0 0 2.8 3.6M16.5 5.5H19a2.5 2.5 0 0 1-2.8 3.6" />
        <path d="M12 13.5v3M8.5 20.5h7M9.5 20.5l.6-4h3.8l.6 4" />
      </>
    ),
  },
  rayo: {
    relleno: <path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z" />,
    trazo: <path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z" />,
  },
  check: { trazo: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  cruz: { trazo: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> },
  reloj: {
    relleno: <circle cx="12" cy="12" r="8.5" />,
    trazo: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  candado: {
    relleno: <rect x="5" y="10.5" width="14" height="10" rx="2.2" />,
    trazo: (
      <>
        <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
      </>
    ),
  },
  regalo: {
    relleno: <rect x="4" y="10" width="16" height="10.5" rx="1.5" />,
    trazo: (
      <>
        <rect x="4" y="10" width="16" height="10.5" rx="1.5" />
        <rect x="3" y="7" width="18" height="3.5" rx="1" />
        <path d="M12 7v13.5M12 7c-1.5-3.5-5.5-3.5-5-1 .3 1.3 3 1 5 1zM12 7c1.5-3.5 5.5-3.5 5-1-.3 1.3-3 1-5 1z" />
      </>
    ),
  },
  chispa: {
    relleno: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />,
    trazo: (
      <>
        <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
        <path d="M18.5 16.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
      </>
    ),
  },
  pluma: {
    relleno: <path d="M19.5 4.5c-6 .5-11 5-12.5 11.5L5 19l3-2c6.5-1.5 11-6.5 11.5-12.5z" />,
    trazo: (
      <>
        <path d="M19.5 4.5c-6 .5-11 5-12.5 11.5L5 19l3-2c6.5-1.5 11-6.5 11.5-12.5z" />
        <path d="M15 9l-8 8M4 20.5h16" />
      </>
    ),
  },
  lupa: {
    relleno: <circle cx="10.5" cy="10.5" r="6.5" />,
    trazo: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.3 15.3L20.5 20.5" />
      </>
    ),
  },
  subir: {
    relleno: <path d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2z" />,
    trazo: (
      <>
        <path d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      </>
    ),
  },
  libro: {
    relleno: <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2z" />,
    trazo: (
      <>
        <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2zM12 6.5v13" />
      </>
    ),
  },
};

export type NombreIcono = keyof typeof DIBUJOS;

export function IconoDuo({ nombre, className = "h-6 w-6", trazo = 1.6 }: { nombre: NombreIcono | string; className?: string; trazo?: number }) {
  const d = DIBUJOS[nombre];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={trazo} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.relleno && (
        <g fill="currentColor" stroke="none" opacity={0.16}>
          {d.relleno}
        </g>
      )}
      {d.trazo}
    </svg>
  );
}

const METALES = [
  { a: "#f6e3a1", b: "#c99a2e", t: "#6b4c0c" },
  { a: "#eef1f4", b: "#9aa5b1", t: "#3d4650" },
  { a: "#f2c9a4", b: "#b06c39", t: "#5a3214" },
];

/** Medalla para los tres primeros puestos (oro, plata, bronce); desde el cuarto, el número. */
export function Medalla({ puesto, className = "h-7 w-7" }: { puesto: number; className?: string }) {
  const m = METALES[puesto - 1];
  if (!m)
    return (
      <span className={`inline-flex items-center justify-center rounded-full border border-current/30 text-[.8em] font-bold tabular-nums opacity-70 ${className}`}>
        {puesto}
      </span>
    );
  const id = `med-${puesto}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label={`Puesto ${puesto}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.a} />
          <stop offset="1" stopColor={m.b} />
        </linearGradient>
      </defs>
      <path d="M9 2h5l3 8h-5zM23 2h-5l-3 8h5z" fill={m.b} opacity=".55" />
      <circle cx="16" cy="19" r="10.5" fill={`url(#${id})`} />
      <circle cx="16" cy="19" r="7.8" fill="none" stroke={m.t} strokeOpacity=".35" strokeWidth="1" />
      <text x="16" y="23.2" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={m.t} fontFamily="Archivo, Manrope, sans-serif">
        {puesto}
      </text>
    </svg>
  );
}
