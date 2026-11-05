import { useEffect, useState } from "react";

/**
 * PWA de invitados: service worker (abre aunque el wifi del salón falle) y manifest por evento,
 * para que el ícono instalado abra directo la página de ese evento.
 */

export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

/** Cambia el manifest de la página por uno del evento: nombre del evento y arranque en /e/CODIGO. */
export function usarManifestDelEvento(codigo: string, nombre: string | undefined) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link || !codigo || !nombre) return;
    const original = link.href;
    const o = location.origin;
    const manifest = {
      id: `${o}/e/${codigo.toUpperCase()}`,
      name: nombre,
      short_name: nombre.length > 14 ? nombre.slice(0, 14) : nombre,
      start_url: `${o}/e/${codigo.toUpperCase()}`,
      scope: `${o}/`,
      display: "standalone",
      background_color: "#1a242d",
      theme_color: "#1a242d",
      icons: [
        { src: `${o}/icono-192.png`, sizes: "192x192", type: "image/png" },
        { src: `${o}/icono-512.png`, sizes: "512x512", type: "image/png" },
        { src: `${o}/icono-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    link.href = url;
    // En iPhone, "Agregar a inicio" usa el título de esta meta (y la dirección actual, que ya es /e/CODIGO).
    let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "apple-mobile-web-app-title";
      document.head.appendChild(meta);
    }
    const tituloAnterior = document.title;
    meta.content = manifest.short_name;
    document.title = nombre;
    return () => {
      link.href = original;
      URL.revokeObjectURL(url);
      meta!.content = "SkyEventos";
      document.title = tituloAnterior;
    };
  }, [codigo, nombre]);
}

interface PedidoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pedido: PedidoInstalacion | null = null;
const avisar = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pedido = e as PedidoInstalacion;
    avisar.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    pedido = null;
    avisar.forEach((f) => f());
  });
}

/** Si se puede ofrecer "Instalar": Android/Chrome con su diálogo, iPhone con la indicación de Compartir. */
export function useInstalar() {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    avisar.add(f);
    return () => void avisar.delete(f);
  }, []);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    instalada,
    ios: ios && !instalada,
    puede: !!pedido && !instalada,
    instalar: async () => {
      if (!pedido) return;
      await pedido.prompt();
      await pedido.userChoice;
      pedido = null;
      refrescar((n) => n + 1);
    },
  };
}
