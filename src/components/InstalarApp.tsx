import { useState } from "react";
import { useInstalar } from "../lib/pwa";
import { Modal } from "./ui";

/** Qué teléfono y navegador es, para dar las instrucciones justas. */
export function plataforma() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  // Navegadores dentro de otras apps (Instagram, Facebook, TikTok…): no dejan instalar.
  const dentroDeApp = /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|; wv\)/i.test(ua);
  const navegador = /CriOS/i.test(ua) ? "chrome" : /FxiOS/i.test(ua) ? "firefox" : /EdgiOS|EdgA/i.test(ua) ? "edge" : /SamsungBrowser/i.test(ua) ? "samsung" : ios ? "safari" : "chrome";
  return { ios, android, dentroDeApp, navegador, movil: ios || android };
}

const IconoCompartir = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Compartir">
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 11v9h14v-9" />
  </svg>
);
const IconoMenu = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px]" fill="currentColor" aria-label="Menú">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);
const IconoMas = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px]" fill="none" stroke="currentColor" strokeWidth={2} aria-label="Agregar">
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tema-acento font-bold text-white">{n}</span>
      <span className="pt-0.5 leading-snug">{children}</span>
    </li>
  );
}

/** Pasos para agregar la app a la pantalla de inicio según el teléfono. */
export function PasosInstalar({ nombre }: { nombre: string }) {
  const p = plataforma();
  const { puede, instalar } = useInstalar();
  const [copiado, setCopiado] = useState(false);

  if (p.dentroDeApp)
    return (
      <div className="space-y-3">
        <p>Estás viendo el evento dentro de otra app (Instagram, Facebook…), que no deja instalarlo.</p>
        <ol className="space-y-3">
          <Paso n={1}>Tocá <IconoMenu /> o <b>···</b> arriba a la derecha.</Paso>
          <Paso n={2}>Elegí <b>Abrir en {p.ios ? "Safari" : "Chrome"}</b> (o “Abrir en el navegador”).</Paso>
          <Paso n={3}>Ahí te mostramos cómo instalarla.</Paso>
        </ol>
        <button
          className="btn-secundario w-full"
          onClick={async () => {
            await navigator.clipboard.writeText(location.href).catch(() => {});
            setCopiado(true);
          }}
        >
          {copiado ? "¡Link copiado! Pegalo en el navegador" : "Copiar el link"}
        </button>
      </div>
    );

  if (p.ios)
    return (
      <ol className="space-y-4">
        {p.navegador === "safari" ? (
          <Paso n={1}>Tocá <IconoCompartir /> <b>Compartir</b> en la barra de abajo (en iPad, arriba).</Paso>
        ) : (
          <Paso n={1}>Tocá <IconoCompartir /> <b>Compartir</b> en la barra de direcciones.</Paso>
        )}
        <Paso n={2}>Deslizá hacia abajo y tocá <IconoMas /> <b>Agregar a inicio</b>.</Paso>
        <Paso n={3}>Tocá <b>Agregar</b>. Vas a ver el ícono de <b>{nombre}</b> en tu pantalla.</Paso>
      </ol>
    );

  if (puede)
    return (
      <div className="space-y-3">
        <p>Se instala en segundos y queda como una app más en tu teléfono.</p>
        <button className="btn-primario w-full py-3.5 text-base" onClick={instalar}>Instalar la app</button>
      </div>
    );

  return (
    <ol className="space-y-4">
      <Paso n={1}>Tocá <IconoMenu /> el menú del navegador {p.navegador === "samsung" ? "(abajo a la derecha)" : "(arriba a la derecha)"}.</Paso>
      <Paso n={2}>Elegí <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</Paso>
      <Paso n={3}>Confirmá. Vas a ver el ícono de <b>{nombre}</b> en tu pantalla.</Paso>
    </ol>
  );
}

/** Ventana con los pasos para instalar. */
export function GuiaInstalar({ abierta, onCerrar, nombre }: { abierta: boolean; onCerrar: () => void; nombre: string }) {
  return (
    <Modal abierto={abierta} onCerrar={onCerrar} titulo="Tené el evento como app">
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3 rounded-2xl bg-tema-superficie p-3">
          <img src="/icono-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div>
            <p className="font-semibold">{nombre}</p>
            <p className="text-xs opacity-70">Abre directo el evento, a pantalla completa, aunque falle el wifi.</p>
          </div>
        </div>
        <PasosInstalar nombre={nombre} />
      </div>
    </Modal>
  );
}

/** Aviso fijo abajo para instalar. Se puede cerrar y vuelve a aparecer al día siguiente. */
export function AvisoInstalar({ nombre }: { nombre: string }) {
  const { instalada, puede, instalar } = useInstalar();
  const p = plataforma();
  const [guia, setGuia] = useState(false);
  const [cerrado, setCerrado] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem("sin-aviso-instalar") || 0) < 24 * 3600e3;
    } catch {
      return false;
    }
  });
  if (instalada || !p.movil) return null;
  const cerrar = () => {
    setCerrado(true);
    try {
      localStorage.setItem("sin-aviso-instalar", String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
  };
  return (
    <>
      {!cerrado && (
        <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-noche/95 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <img src="/icono-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
          <p className="flex-1 text-xs leading-snug text-white/85">
            <b className="text-white">Instalá la app del evento</b>
            <br />
            Volvés con un toque y no se pierde nada.
          </p>
          <button className="btn-primario btn-chico" onClick={() => (puede && !p.ios ? instalar() : setGuia(true))}>Instalar</button>
          <button className="px-1 text-lg leading-none text-white/50 hover:text-white" onClick={cerrar} aria-label="Cerrar">×</button>
        </div>
      )}
      <GuiaInstalar abierta={guia} onCerrar={() => setGuia(false)} nombre={nombre} />
    </>
  );
}

/** Botón para el menú del invitado ("Yo"): siempre a mano, aunque haya cerrado el aviso. */
export function BotonInstalar({ nombre, className = "" }: { nombre: string; className?: string }) {
  const { instalada } = useInstalar();
  const [guia, setGuia] = useState(false);
  if (instalada) return null;
  return (
    <>
      <button className={`btn-secundario w-full ${className}`} onClick={() => setGuia(true)}>📲 Instalar la app del evento</button>
      <GuiaInstalar abierta={guia} onCerrar={() => setGuia(false)} nombre={nombre} />
    </>
  );
}
