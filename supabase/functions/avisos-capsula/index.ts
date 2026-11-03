// Manda por mail los avisos de "su cápsula del tiempo ya se puede abrir".
// Encola los que falten (encolar_avisos_capsula) y envía los pendientes con Resend.
// Secretos: RESEND_API_KEY, AVISOS_REMITENTE (ej. "SkyEventos <hola@skyeventos.com>") y APP_URL.
// Programarla una vez por día (Supabase → Edge Functions → Schedules o pg_cron + pg_net).
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const clave = Deno.env.get("RESEND_API_KEY");
  if (!clave) return Response.json({ error: "Falta RESEND_API_KEY" }, { status: 500 });
  const remitente = Deno.env.get("AVISOS_REMITENTE") ?? "SkyEventos <onboarding@resend.dev>";
  const app = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  await db.rpc("encolar_avisos_capsula");
  const { data: pendientes, error } = await db
    .from("notificaciones")
    .select("id, email, intentos, evento_id, eventos(nombre, personalizacion)")
    .is("enviada_at", null)
    .lt("intentos", 5)
    .lte("programada_at", new Date().toISOString())
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let enviados = 0;
  for (const n of pendientes ?? []) {
    // deno-lint-ignore no-explicit-any
    const ev = (n as any).eventos;
    const titulo = ev?.personalizacion?.titulo || ev?.nombre || "su evento";
    const link = `${app}/panel/${n.evento_id}?tab=capsula`;
    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;color:#16222e">
        <p style="letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#8a6d3b">Cápsula del tiempo</p>
        <h1 style="font-weight:normal;font-size:28px;margin:8px 0 16px">La cápsula de ${titulo} ya se puede abrir</h1>
        <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#44515e">
          Hace 11 meses sus invitados dejaron mensajes y fotos sellados para ustedes. Ya pueden abrirlos desde el panel,
          antes del primer aniversario. El contenido queda guardado hasta cumplir el año.
        </p>
        <p style="margin:28px 0"><a href="${link}" style="background:#16222e;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Abrir la cápsula</a></p>
      </div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remitente, to: n.email, subject: `Su cápsula del tiempo ya se puede abrir`, html }),
    });
    if (r.ok) {
      await db.from("notificaciones").update({ enviada_at: new Date().toISOString(), error: null, intentos: n.intentos + 1 }).eq("id", n.id);
      enviados++;
    } else {
      await db.from("notificaciones").update({ error: (await r.text()).slice(0, 500), intentos: n.intentos + 1 }).eq("id", n.id);
    }
  }
  return Response.json({ pendientes: pendientes?.length ?? 0, enviados });
});
