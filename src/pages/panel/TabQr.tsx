import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { APP_URL } from "../../lib/supabase";
import { estiloTematica, tematica } from "../../lib/tematicas";
import type { PropsTab } from "./EventoPanel";

type Formato = "tarjetas" | "cartel";

export default function TabQr({ evento }: PropsTab) {
  const [qr, setQr] = useState("");
  const [formato, setFormato] = useState<Formato>("tarjetas");
  const [texto, setTexto] = useState("¡Compartí tus fotos del evento!");
  const link = `${APP_URL}/e/${evento.codigo}`;
  const t = tematica(evento.tematica);
  const p = evento.personalizacion;

  useEffect(() => {
    QRCode.toDataURL(link, { width: 800, margin: 1, errorCorrectionLevel: "M" }).then(setQr);
  }, [link]);

  const Tarjeta = ({ grande = false }: { grande?: boolean }) => (
    <div
      style={{ ...estiloTematica(evento.tematica, p), background: t.fondoDecorado, color: "rgb(var(--t-texto))", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
      className={`flex flex-col items-center justify-center text-center ${grande ? "h-[270mm] w-[190mm] p-[16mm]" : "h-[85mm] w-[90mm] break-inside-avoid border border-dashed border-slate-300 p-[6mm]"}`}
    >
      <p className={`text-tema-acento ${grande ? "text-6xl" : "text-2xl"}`} style={{ fontFamily: "var(--t-font-titulo)" }}>{p.titulo || evento.nombre}</p>
      <p className={`mt-1 text-tema-suave ${grande ? "text-2xl" : "text-xs"}`}>{texto}</p>
      {qr && <img src={qr} alt="QR" className={grande ? "mt-10 w-[120mm]" : "mt-2 w-[42mm]"} />}
      <p className={`mt-2 text-tema-suave ${grande ? "text-xl" : "text-[9px]"}`}>Escaneá o entrá a <b>{APP_URL.replace(/^https?:\/\//, "")}/e</b> con el código</p>
      <p className={`font-mono font-bold tracking-[.3em] text-tema-texto ${grande ? "mt-2 text-5xl" : "text-lg"}`}>{evento.codigo}</p>
    </div>
  );

  return (
    <div>
      <style>{`@media print { @page { size: A4; margin: ${formato === "tarjetas" ? "10mm" : "10mm"}; } }`}</style>
      <div className="no-imprimir tarjeta mb-6 flex flex-wrap items-end gap-4">
        <label>
          <span className="etiqueta">Formato</span>
          <select className="input" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
            <option value="tarjetas">Tarjetas de mesa (6 por hoja A4)</option>
            <option value="cartel">Cartel A4</option>
          </select>
        </label>
        <label className="min-w-[240px] flex-1">
          <span className="etiqueta">Texto</span>
          <input className="input" value={texto} maxLength={60} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <button className="btn-primario" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        {qr && <a className="btn-secundario" href={qr} download={`qr-${evento.codigo}.png`}>Descargar QR (PNG)</a>}
      </div>
      <div className="flex justify-center overflow-x-auto bg-white p-4 print:p-0">
        {formato === "tarjetas" ? (
          <div className="grid grid-cols-2 gap-0">
            {Array.from({ length: 6 }).map((_, i) => <Tarjeta key={i} />)}
          </div>
        ) : (
          <Tarjeta grande />
        )}
      </div>
    </div>
  );
}
