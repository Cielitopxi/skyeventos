import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Aviso, Cargando } from "../../components/ui";
import { mensajeError, supabase } from "../../lib/supabase";
import type { Evento, Plan } from "../../lib/tipos";
import { BarraPanel, ESTADOS } from "./MisEventos";
import TabResumen from "./TabResumen";
import TabPersonalizar from "./TabPersonalizar";
import TabModerar from "./TabModerar";
import TabMisiones from "./TabMisiones";
import TabVotacion from "./TabVotacion";
import TabTrivia from "./TabTrivia";
import TabCapsula from "./TabCapsula";
import TabInvitados from "./TabInvitados";
import TabQr from "./TabQr";
import TabFotolibro from "./TabFotolibro";

export interface PropsTab {
  evento: Evento;
  plan: Plan | null;
  recargar: () => Promise<void>;
}

const TABS = [
  { id: "resumen", t: "Resumen" },
  { id: "personalizar", t: "Personalizar" },
  { id: "moderar", t: "Moderar" },
  { id: "misiones", t: "Misiones y premios" },
  { id: "trivia", t: "Trivia" },
  { id: "votacion", t: "Votación" },
  { id: "capsula", t: "Cápsula" },
  { id: "invitados", t: "Invitados" },
  { id: "qr", t: "QR para imprimir" },
  { id: "libro", t: "Fotolibro" },
];

export default function EventoPanel() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "resumen";
  const [evento, setEvento] = useState<Evento | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    const { data, error } = await supabase.from("eventos").select("*").eq("id", id!).maybeSingle();
    if (error || !data) {
      setError(error ? mensajeError(error) : "Evento no encontrado o sin permiso.");
      return;
    }
    setEvento(data as Evento);
    const pl = await supabase.from("planes").select("*").eq("id", data.plan_id).maybeSingle();
    setPlan(pl.data as Plan);
  }, [id]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  if (error) return <div className="p-8"><Aviso tipo="error">{error}</Aviso></div>;
  if (!evento) return <Cargando />;
  const est = ESTADOS[evento.estado];
  const props: PropsTab = { evento, plan, recargar };
  // Las pestañas de juegos apagados se esconden; la cápsula solo aparece en planes que la incluyen.
  const juegos = evento.personalizacion.juegos ?? {};
  const visible = (id: string) =>
    id === "trivia" ? juegos.trivia !== false : id === "votacion" ? juegos.votacion !== false : id === "capsula" ? !!plan?.capsula : true;

  return (
    <div className="min-h-screen bg-slate-50">
      <BarraPanel />
      <div className="no-imprimir border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{evento.personalizacion.titulo || evento.nombre}</h1>
            <span className={`chip ${est.c}`}>{est.t}</span>
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-white">{evento.codigo}</span>
          </div>
          <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto">
            {TABS.filter((t) => visible(t.id)).map((t) => (
              <button
                key={t.id}
                onClick={() => setParams({ tab: t.id })}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${tab === t.id ? "border-sky-500 text-sky-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {t.t}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {evento.estado === "pendiente_pago" && (
          <div className="no-imprimir mb-5">
            <Aviso>
              Este evento está <b>pendiente de pago</b>: podés personalizarlo, pero los invitados van a poder entrar cuando se acredite el pago.{" "}
              <Link to="/panel" className="font-semibold underline">Pagar desde Mis eventos</Link>
            </Aviso>
          </div>
        )}
        {tab === "resumen" && <TabResumen {...props} />}
        {tab === "personalizar" && <TabPersonalizar {...props} />}
        {tab === "moderar" && <TabModerar {...props} />}
        {tab === "misiones" && <TabMisiones {...props} />}
        {tab === "trivia" && <TabTrivia {...props} />}
        {tab === "votacion" && <TabVotacion {...props} />}
        {tab === "capsula" && <TabCapsula {...props} />}
        {tab === "invitados" && <TabInvitados {...props} />}
        {tab === "qr" && <TabQr {...props} />}
        {tab === "libro" && <TabFotolibro {...props} />}
      </main>
    </div>
  );
}
