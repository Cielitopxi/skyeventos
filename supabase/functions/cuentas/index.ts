// Cuentas de anfitriones con email y contraseña, sin mails de Supabase de por medio.
//  - accion "registrar": crea la cuenta ya confirmada (no se envía mail de confirmación).
//  - accion "clave": un admin le pone una contraseña nueva a un usuario (reemplaza "olvidé mi contraseña" por mail).
// Desplegar con verify_jwt = false: la clave pública del proyecto no es un JWT. La autorización se valida acá.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const claveValida = (c: string) => c.length >= 8 && c.length <= 72;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // deno-lint-ignore no-explicit-any
  const b: any = await req.json().catch(() => ({}));
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (b.accion === "registrar") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const clave = String(b.clave ?? "");
    if (!EMAIL.test(email) || email.length > 254) return json({ error: "Ingresá un email válido" }, 400);
    if (!claveValida(clave)) return json({ error: "La contraseña tiene que tener entre 8 y 72 caracteres" }, 400);
    const { error } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return json({ error: "Ya hay una cuenta con ese email. Ingresá con tu contraseña." }, 409);
      console.error("registrar", error);
      return json({ error: "No se pudo crear la cuenta" }, 400);
    }
    return json({ ok: true });
  }

  if (b.accion === "clave") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u.user) return json({ error: "No autorizado" }, 401);
    const { data: esAdmin } = await admin.from("admins").select("user_id").eq("user_id", u.user.id).eq("activo", true).maybeSingle();
    if (!esAdmin) return json({ error: "No autorizado" }, 403);
    const clave = String(b.clave ?? "");
    if (!b.user_id || !claveValida(clave)) return json({ error: "La contraseña tiene que tener entre 8 y 72 caracteres" }, 400);
    const { error } = await admin.auth.admin.updateUserById(String(b.user_id), { password: clave });
    if (error) {
      console.error("clave", error);
      return json({ error: "No se pudo cambiar la contraseña" }, 400);
    }
    return json({ ok: true });
  }

  return json({ error: "Acción desconocida" }, 400);
});
