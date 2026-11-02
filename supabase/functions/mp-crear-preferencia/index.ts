// Crea la preferencia de Checkout Pro de Mercado Pago para el pedido pendiente de un evento.
// Secretos: MP_ACCESS_TOKEN, APP_URL. (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY los inyecta Supabase.)
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const token = Deno.env.get("MP_ACCESS_TOKEN");
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/$/, "");
  if (!token || !appUrl) return json({ error: "Mercado Pago no está configurado" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const usuarioCli = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: u } = await usuarioCli.auth.getUser();
  if (!u.user || u.user.is_anonymous) return json({ error: "No autorizado" }, 401);

  const { evento_id } = await req.json().catch(() => ({}));
  if (!evento_id) return json({ error: "Falta evento_id" }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, monto, plan_id, owner_id, eventos(nombre, codigo), planes(nombre)")
    .eq("evento_id", evento_id)
    .eq("estado", "pendiente")
    .maybeSingle();
  if (!pedido || pedido.owner_id !== u.user.id) return json({ error: "No hay un pago pendiente para este evento" }, 404);

  // deno-lint-ignore no-explicit-any
  const p = pedido as any;
  const volver = (estado: string) => `${appUrl}/pago?estado=${estado}&evento=${evento_id}`;
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": pedido.id },
    body: JSON.stringify({
      items: [
        {
          id: pedido.plan_id,
          title: `SkyEventos ${p.planes?.nombre ?? ""} — ${p.eventos?.nombre ?? ""}`.trim(),
          quantity: 1,
          unit_price: Number(pedido.monto),
          currency_id: "ARS",
        },
      ],
      payer: { email: u.user.email },
      external_reference: pedido.id,
      back_urls: { success: volver("ok"), pending: volver("pendiente"), failure: volver("error") },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: "SKYEVENTOS",
    }),
  });
  const pref = await r.json();
  if (!r.ok) {
    console.error("MP preferencia", r.status, pref);
    return json({ error: "Mercado Pago rechazó la preferencia" }, 502);
  }

  await admin.from("pedidos").update({ mp_preference_id: pref.id }).eq("id", pedido.id);
  // En modo prueba (token TEST-...) se usa sandbox_init_point.
  const init_point = token.startsWith("TEST-") ? pref.sandbox_init_point : pref.init_point;
  return json({ init_point });
});
