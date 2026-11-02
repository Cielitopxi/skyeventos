import { useEffect, useState } from "react";
import { BUCKET, supabase } from "./supabase";

/** Caché de URLs firmadas del bucket privado. Se firman en lote y duran 2 h. */
const DURACION = 60 * 60 * 2;
const cache = new Map<string, { url: string; vence: number }>();
const pendientes = new Map<string, Promise<void>>();

async function firmar(paths: string[]) {
  const ahora = Date.now();
  const faltan = paths.filter((p) => {
    const c = cache.get(p);
    return (!c || c.vence < ahora + 5 * 60_000) && !pendientes.has(p);
  });
  if (faltan.length) {
    for (let i = 0; i < faltan.length; i += 200) {
      const lote = faltan.slice(i, i + 200);
      const prom = (async () => {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrls(lote, DURACION);
        const vence = Date.now() + DURACION * 1000;
        data?.forEach((d) => {
          if (d.signedUrl && d.path) cache.set(d.path, { url: d.signedUrl, vence });
        });
      })();
      lote.forEach((p) => pendientes.set(p, prom));
      prom.finally(() => lote.forEach((p) => pendientes.delete(p)));
    }
  }
  await Promise.all(paths.map((p) => pendientes.get(p)).filter(Boolean));
}

export async function urlsFirmadas(paths: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(paths.filter(Boolean))];
  await firmar(unicos);
  const r: Record<string, string> = {};
  unicos.forEach((p) => {
    const c = cache.get(p);
    if (c) r[p] = c.url;
  });
  return r;
}

export function useUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const clave = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    const lista = clave ? clave.split("|") : [];
    if (!lista.length) return;
    urlsFirmadas(lista).then((r) => vivo && setUrls((prev) => ({ ...prev, ...r })));
    return () => {
      vivo = false;
    };
  }, [clave]);
  return urls;
}
