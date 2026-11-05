import { useEffect, useState } from "react";
import { IconoDuo } from "../../components/Iconos";
import { Aviso, Cargando } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import type { CapsulaItem, EstadoCapsula } from "../../lib/tipos";
import { useUrls } from "../../lib/urls";
import type { PropsTab } from "./EventoPanel";

const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export default function TabCapsula({ evento, plan }: PropsTab) {
  const [estado, setEstado] = useState<EstadoCapsula | null>(null);
  const [items, setItems] = useState<CapsulaItem[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("capsula_estado", { p_evento: evento.id });
      const e = (data as EstadoCapsula[] | null)?.[0] ?? null;
      setEstado(e);
      if (!e?.abierta) return;
      // Recién abierta, la base deja leer el contenido al organizador.
      const [c, i] = await Promise.all([
        supabase.from("capsula_items").select("*").eq("evento_id", evento.id).order("created_at"),
        supabase.from("invitados").select("id, nombre").eq("evento_id", evento.id),
      ]);
      setItems((c.data as CapsulaItem[]) ?? []);
      setNombres(Object.fromEntries((i.data ?? []).map((x: { id: string; nombre: string }) => [x.id, x.nombre])));
    })();
  }, [evento.id]);

  const urls = useUrls(items.map((x) => x.storage_path));

  if (plan && !plan.capsula) {
    return (
      <div className="tarjeta mx-auto max-w-xl text-center">
        <IconoDuo nombre="capsula" className="mx-auto h-12 w-12 text-sky-500" />
        <p className="mt-3 font-semibold">La cápsula del tiempo está incluida en el plan Premium.</p>
        <p className="mt-1 text-sm text-slate-600">Los invitados dejan mensajes y fotos sellados que ustedes abren a los 11 meses del evento.</p>
      </div>
    );
  }
  if (!estado) return <Cargando />;

  const dias = Math.max(0, Math.ceil((new Date(estado.abre_at).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-noche px-8 py-10 text-white">
        <div className="cielo absolute inset-0 opacity-70" />
        <div className="relative flex flex-wrap items-center gap-8">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/5">
            <IconoDuo nombre={estado.abierta ? "regalo" : "capsula"} className="h-10 w-10 text-[#dbe5ee]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="rotulo text-oro">Cápsula del tiempo</p>
            <h2 className="mt-2 font-display text-3xl">
              {estado.abierta ? "¡Su cápsula ya se puede abrir!" : `Se abre el ${fechaLarga(estado.abre_at)}`}
            </h2>
            <p className="mt-2 text-white/65">
              {estado.items} {estado.items === 1 ? "recuerdo" : "recuerdos"} de {estado.invitados} {estado.invitados === 1 ? "invitado" : "invitados"}
              {!estado.abierta && ` · faltan ${dias} días`}
            </p>
          </div>
          {estado.abierta && !abierta && estado.items > 0 && (
            <button className="rounded-full bg-gradient-to-b from-[#dbe5ee] to-[#8fa5b6] px-7 py-3.5 font-semibold text-noche" onClick={() => setAbierta(true)}>
              Abrir la cápsula
            </button>
          )}
        </div>
      </div>

      {!estado.abierta && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { i: "pluma", t: "Los invitados escriben", d: "Desde el celular, durante el evento y hasta 48 h después, dejan un mensaje y una foto para el futuro." },
            { i: "candado", t: "Queda sellada", d: "Nadie, ni ustedes, puede leer el contenido hasta la fecha de apertura." },
            { i: "regalo", t: "A los 11 meses, la abren", d: "Les llega un mail para abrirla antes del primer aniversario. El contenido se guarda un año." },
          ].map((x) => (
            <div key={x.t} className="tarjeta">
              <IconoDuo nombre={x.i} className="h-7 w-7 text-sky-500" />
              <p className="mt-3 font-semibold">{x.t}</p>
              <p className="mt-1 text-sm text-slate-600">{x.d}</p>
            </div>
          ))}
        </div>
      )}

      {!estado.habilitada && <Aviso>La cápsula está apagada: activala en Personalizar → Juegos y desafíos para que los invitados puedan dejar sus mensajes.</Aviso>}

      {abierta && (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {items.map((x, i) => (
            <figure key={x.id} className="subir tarjeta mb-4 break-inside-avoid overflow-hidden p-0" style={{ animationDelay: `${i * 120}ms` }}>
              {x.storage_path && urls[x.storage_path] && <img src={urls[x.storage_path]} alt="" className="w-full object-cover" />}
              <figcaption className="p-5">
                {x.texto && <p className="font-display text-lg leading-snug">“{x.texto}”</p>}
                <p className="mt-3 text-xs uppercase tracking-[.2em] text-slate-500">
                  {nombres[x.invitado_id] ?? "Invitado"} · {new Date(x.created_at).toLocaleDateString("es-AR")}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
