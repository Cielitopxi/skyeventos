import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "../../components/ui";
import { supabase } from "../../lib/supabase";

/** Retorno desde Mercado Pago. El evento se activa por webhook; acá esperamos a que llegue. */
export default function ResultadoPago() {
  const [params] = useSearchParams();
  const eventoId = params.get("evento");
  const estadoMp = params.get("estado");
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    if (!eventoId || estadoMp === "error") return;
    let intentos = 0;
    const t = setInterval(async () => {
      intentos++;
      const { data } = await supabase.from("eventos").select("estado").eq("id", eventoId).maybeSingle();
      if (data?.estado === "activo") {
        setActivo(true);
        clearInterval(t);
      }
      if (intentos > 40) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [eventoId, estadoMp]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="tarjeta w-full max-w-md text-center">
        <div className="mb-4 flex justify-center"><Logo /></div>
        {estadoMp === "error" ? (
          <>
            <div className="text-5xl">😕</div>
            <h1 className="mt-2 text-xl font-bold">El pago no se completó</h1>
            <p className="mt-1 text-sm text-slate-600">Podés intentarlo de nuevo desde tu panel.</p>
          </>
        ) : activo ? (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="mt-2 text-xl font-bold">¡Tu evento está activo!</h1>
            <p className="mt-1 text-sm text-slate-600">Ya podés personalizarlo e imprimir los QR.</p>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
            <h1 className="mt-4 text-xl font-bold">{estadoMp === "pendiente" ? "Pago pendiente" : "Confirmando tu pago…"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {estadoMp === "pendiente"
                ? "Cuando Mercado Pago acredite el pago, tu evento se activa solo y te avisamos en el panel."
                : "Esto tarda unos segundos."}
            </p>
          </>
        )}
        <Link to={eventoId ? `/panel/${eventoId}` : "/panel"} className="btn-primario mt-6 w-full">Ir a mi evento</Link>
      </div>
    </div>
  );
}
