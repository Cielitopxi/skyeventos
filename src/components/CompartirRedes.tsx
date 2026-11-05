import { useState } from "react";

/** Botones para compartir un link en redes: WhatsApp, Facebook, X, Telegram, copiar y el menú nativo del celular. */
export function CompartirRedes({ url, texto, titulo, oscuro = false }: { url: string; texto: string; titulo: string; oscuro?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(texto);
  const redes = [
    { n: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, c: "#25d366" },
    { n: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, c: "#1877f2" },
    { n: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, c: "#000000" },
    { n: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, c: "#229ed9" },
  ];
  const nativo = typeof navigator !== "undefined" && "share" in navigator;
  const borde = oscuro ? "border-white/20 text-white hover:bg-white/10" : "border-slate-300 text-slate-700 hover:bg-slate-50";

  async function copiar() {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {redes.map((r) => (
        <a key={r.n} href={r.href} target="_blank" rel="noreferrer" className="efecto rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: r.c }}>
          {r.n}
        </a>
      ))}
      <button className={`efecto rounded-full border px-4 py-2 text-sm font-semibold ${borde}`} onClick={copiar}>
        {copiado ? "¡Link copiado!" : "Copiar link"}
      </button>
      {nativo && (
        <button className={`efecto rounded-full border px-4 py-2 text-sm font-semibold ${borde}`} onClick={() => navigator.share({ title: titulo, text: texto, url }).catch(() => {})}>
          Instagram y más…
        </button>
      )}
    </div>
  );
}
