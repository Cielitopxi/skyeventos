// Crea la preferencia de Checkout Pro de Mercado Pago para el pedido pendiente de un evento o una compra de regalo.
// Secretos: MP_ACCESS_TOKEN, APP_URL y, solo mientras se prueba, MP_PRUEBA=1. (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY los inyecta Supabase.)
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

  const { evento_id, regalo_id } = await req.json().catch(() => ({}));
  if (!evento_id && !regalo_id) return json({ error: "Falta evento_id o regalo_id" }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // deno-lint-ignore no-explicit-any
  let p: any;
  let titulo: string;
  let referencia: string;
  let volver: (estado: string) => string;
  let tabla: "pedidos" | "pedidos_regalo";

  if (regalo_id) {
    // Tarjeta de regalo: quien regala paga un plan y recibe un código para compartir.
    const { data } = await admin
      .from("pedidos_regalo")
      .select("id, monto, plan_id, owner_id, cupon, planes(nombre), cupones(para)")
      .eq("id", regalo_id)
      .eq("estado", "pendiente")
      .maybeSingle();
    if (!data || data.owner_id !== u.user.id) return json({ error: "No hay un regalo pendiente de pago" }, 404);
    p = data;
    titulo = `Regalo SkyEventos ${p.planes?.nombre ?? ""}${p.cupones?.para ? ` para ${p.cupones.para}` : ""}`;
    referencia = `regalo:${p.id}`;
    volver = (estado) => `${appUrl}/regalar?regalo=${p.id}&estado=${estado}`;
    tabla = "pedidos_regalo";
  } else {
    const { data } = await admin
      .from("pedidos")
      .select("id, monto, plan_id, owner_id, eventos(nombre, codigo), planes(nombre)")
      .eq("evento_id", evento_id)
      .eq("estado", "pendiente")
      .maybeSingle();
    if (!data || data.owner_id !== u.user.id) return json({ error: "No hay un pago pendiente para este evento" }, 404);
    p = data;
    titulo = `SkyEventos ${p.planes?.nombre ?? ""} — ${p.eventos?.nombre ?? ""}`.trim();
    referencia = p.id;
    volver = (estado) => `${appUrl}/pago?estado=${estado}&evento=${evento_id}`;
    tabla = "pedidos";
  }
  if (!(Number(p.monto) > 0)) return json({ error: "Este pedido no tiene nada para pagar" }, 400);

  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    // El monto va en la clave: si se aplica un código de descuento, MP no devuelve la preferencia vieja.
    // Sin "payer": el comprador es quien inicia sesión en Mercado Pago. Mandar el email de la cuenta de SkyEventos
    // mezclaba una cuenta real con credenciales de prueba ("una de las partes es de prueba") y no aporta nada.
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": `${p.id}-${p.monto}-v3` },
    body: JSON.stringify({
      items: [{ id: p.plan_id, title: titulo, quantity: 1, unit_price: Number(p.monto), currency_id: "ARS" }],
      external_reference: referencia,
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

  await admin.from(tabla).update({ mp_preference_id: pref.id }).eq("id", p.id);
  // Con credenciales de prueba hay que abrir el checkout de prueba (sandbox_init_point); si no, MP responde
  // "una de las partes es de prueba". Las credenciales de prueba nuevas empiezan con APP_USR- igual que las reales,
  // así que el modo se indica con el secreto MP_PRUEBA=1 (se borra al pasar a producción).
  const prueba = Deno.env.get("MP_PRUEBA") === "1" || token.startsWith("TEST-");
  const init_point = prueba ? pref.sandbox_init_point : pref.init_point;
  return json({ init_point });
});