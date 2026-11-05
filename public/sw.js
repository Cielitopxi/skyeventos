// Service worker de SkyEventos: hace instalable la app de invitados y permite abrirla
// aunque el wifi del salón falle. Solo guarda archivos propios del sitio; nunca datos de Supabase.
const CACHE = "skyeventos-v1";
const BASICOS = ["/", "/favicon.svg", "/icono-192.png", "/icono-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Páginas: primero la red (siempre la versión nueva); sin conexión, la app guardada.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put("/", copia));
          return r;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Archivos con hash (/assets/*) y estáticos: de la caché si ya están, si no de la red y se guardan.
  if (url.pathname.startsWith("/assets/") || BASICOS.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return r;
          }),
      ),
    );
  }
});
