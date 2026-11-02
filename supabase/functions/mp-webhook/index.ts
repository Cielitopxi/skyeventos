// Webhook de Mercado Pago: confirma el pago consultando la API y activa el evento.
// Secretos: MP_ACCESS_TOKEN y (recomendado) MP_WEBHOOK_SECRET para validar la firma x-signature.
// Desplegar con verify_jwt = false (Mercado Pago no envía JWT de Supabase).
import { createClient } from "jsr:@supabase/supabase-js@2";

async function hmacHex(secreto: string, texto: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function firmaValida(req: Request, dataId: string) {
  const secreto = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secreto) return true; // sin secreto configurado se confía en la consulta a la API
  const firma = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(firma.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const manifiesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${partes.ts};`;
  return (await hmacHex(secreto, manifiesto)) === partes.v1;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const cuerpo = await req.json().catch(() => ({} as Record<string, unknown>));
  // deno-lint-ignore no-explicit-any
  const b = cuerpo as any;
  const tipo = b.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(b.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (tipo !== "payment" || !dataId) return new Response("ignorado", { status: 200 });
  if (!(await firmaValida(req, dataId))) return new Response("firma inválida", { status: 401 });

  const token = Deno.env.get("MP_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return new Response("pago no encontrado", { status: 200 });
  const pago = await r.json();

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: pedido } = await admin.from("pedidos").select("id, evento_id, monto, estado").eq("id", pago.external_reference).maybeSingle();
  if (!pedido) return new Response("pedido desconocido", { status: 200 });

  if (pago.status === "approved") {
    if (Number(pago.transaction_amount) + 0.01 < Number(pedido.monto)) {
      console.error("Monto menor al esperado", pago.id, pago.transaction_amount, pedido.monto);
      return new Response("monto incorrecto", { status: 200 });
    }
    const { error } = await admin.rpc("activar_evento", { p_evento: pedido.evento_id, p_payment_id: String(pago.id) });
    if (error) {
      console.error(error);
      return new Response("error", { status: 500 }); // MP reintenta
    }
  } else if (["rejected", "cancelled"].includes(pago.status) && pedido.estado === "pendiente") {
    await admin.from("pedidos").update({ mp_payment_id: String(pago.id) }).eq("id", pedido.id);
  }
  return new Response("ok", { status: 200 });
});
