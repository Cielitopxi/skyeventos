import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso } from "../../components/ui";
import { IconoDuo } from "../../components/Iconos";
import { MarcaClip } from "../../components/MarcaClip";
import { giro, Instantanea } from "../../components/Instantanea";
import { mensajeError, supabase } from "../../lib/supabase";
import type { Foto, Invitado } from "../../lib/tipos";
import { urlsFirmadas, useUrls } from "../../lib/urls";
import type { PropsTab } from "./EventoPanel";

export default function TabFotolibro({ evento, recargar }: PropsTab) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [invitados, setInvitados] = useState<Record<string, Invitado>>({});
  const [zip, setZip] = useState<{ hecho: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [f, i] = await Promise.all([
      supabase.from("fotos").select("*").eq("evento_id", evento.id).eq("estado", "aprobada").order("created_at"),
      supabase.from("invitados").select("*").eq("evento_id", evento.id),
    ]);
    setFotos((f.data as Foto[]) ?? []);
    setInvitados(Object.fromEntries(((i.data as Invitado[]) ?? []).map((x) => [x.id, x])));
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const urls = useUrls(fotos.map((f) => f.thumb_path));

  async function alternar(f: Foto) {
    setFotos((xs) => xs.map((x) => (x.id === f.id ? { ...x, en_libro: !x.en_libro } : x)));
    await supabase.from("fotos").update({ en_libro: !f.en_libro }).eq("id", f.id);
  }

  async function usarDePortada(f: Foto) {
    const { error } = await supabase
      .from("eventos")
      .update({ personalizacion: { ...evento.personalizacion, portada_path: f.storage_path } })
      .eq("id", evento.id);
    if (error) setError(mensajeError(error));
    recargar();
  }

  async function descargarZip() {
    setError("");
    try {
      const { default: JSZip } = await import("jszip");
      const z = new JSZip();
      const todas = fotos;
      setZip({ hecho: 0, total: todas.length });
      const firmadas = await urlsFirmadas(todas.map((f) => f.storage_path));
      let hecho = 0;
      const porNombre: Record<string, number> = {};
      for (const f of todas) {
        const quien = (invitados[f.invitado_id]?.nombre ?? "invitado").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "invitado";
        porNombre[quien] = (porNombre[quien] ?? 0) + 1;
        const r = await fetch(firmadas[f.storage_path]);
        const ext = f.storage_path.split(".").pop() ?? "jpg";
        if (r.ok) z.file(`${quien}/${String(porNombre[quien]).padStart(3, "0")}.${ext}`, await r.blob());
        setZip({ hecho: ++hecho, total: todas.length });
      }
      const blob = await z.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fotos-${evento.codigo}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      setError(mensajeError(e));
    }
    setZip(null);
  }

  const enLibro = fotos.filter((f) => f.en_libro && f.medio === "foto").length;
  const clipsEnLibro = fotos.filter((f) => f.en_libro && f.medio !== "foto").length;

  return (
    <div className="space-y-6">
      <div className="tarjeta flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <h2 className="font-bold">Fotolibro</h2>
          <p className="text-sm text-slate-600">
            {enLibro} de {fotos.filter((f) => f.medio === "foto").length} fotos aprobadas van al libro. Capítulos por invitado, misiones, mensajes y ranking.
            {clipsEnLibro > 0 && ` Los ${clipsEnLibro} videos y audios van con un QR para escucharlos desde la página impresa.`}
            {evento.estado === "activo" && " Te recomendamos generarlo después de cerrar el evento."}
          </p>
        </div>
        <button className="btn-secundario" onClick={descargarZip} disabled={!!zip || !fotos.length}>
          {zip ? `Armando ZIP ${zip.hecho}/${zip.total}…` : "Descargar todas (ZIP)"}
        </button>
        <Link to={`/panel/${evento.id}/libro`} className="btn-primario flex items-center gap-2"><IconoDuo nombre="libro" className="h-5 w-5" /> Ver y descargar PDF</Link>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="text-sm text-slate-600">Tocá una foto para sacarla o volverla a poner en el libro. ★ = destacada (va primero en su capítulo).</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
        {fotos.map((f) => (
          <div key={f.id} className="group relative">
            <button onClick={() => alternar(f)} className={`relative block aspect-square w-full overflow-hidden rounded-lg bg-slate-200 ${f.en_libro ? "" : "opacity-30 grayscale"}`}>
              {f.marco ? (
                    <span className="flex h-full items-center justify-center bg-slate-50 py-[6%]">
                      <Instantanea marco={f.marco} mini inclinar={giro(f.id, 2)} className="h-full">
                        {urls[f.thumb_path] && <img src={urls[f.thumb_path]} alt="" loading="lazy" />}
                      </Instantanea>
                    </span>
                  ) : (
                    urls[f.thumb_path] && <img src={urls[f.thumb_path]} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
              <MarcaClip foto={f} />
            </button>
            {f.destacada && <span className="absolute left-1 top-1 text-amber-400 drop-shadow">★</span>}
            {evento.personalizacion.portada_path === f.storage_path && <span className="absolute bottom-1 left-1 chip bg-sky-500 text-white">Portada</span>}
            {f.medio === "foto" && (
              <button
                onClick={() => usarDePortada(f)}
                className="absolute bottom-1 right-1 hidden rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold group-hover:block"
              >
                Portada
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
