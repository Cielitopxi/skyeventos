// Borra el contenido de los eventos cuyo plazo de guardado (expira_at) ya pasó.
// La llama pg_cron una vez por día (migración 0015) con el header x-limpieza-clave, que se valida contra Vault.
// Desplegar con verify_jwt = false: la protege esa clave, no un JWT.
//
// Por evento, en este orden (si algo falla, el evento se reintenta al día siguiente):
//   1. Archivos del bucket bajo {evento}/ (fotos, clips, miniaturas, cápsula, portada).
//   2. Invitados; en cascada se van fotos, mensajes, votos, respuestas de trivia, cápsula y emails.
//   3. El evento queda 'archivado' con contenido_borrado_at. Evento y pedido se conservan.
// Nunca toca el evento demo ni los que no se activaron.
//
// Cuerpo opcional: {"simular": true} devuelve qué se borraría sin borrar nada. {"limite": n} (máx. 50).
// Con {"simular": true, "codigo": "ABC123"} inspecciona ese evento aunque no esté vencido (solo lectura).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "fotos";

/** Todos los archivos bajo una carpeta (Storage lista un nivel por vez: las carpetas vienen con id null). */
async function listarArchivos(db: SupabaseClient, carpeta: string): Promise<string[]> {
  const archivos: string[] = [];
  const pendientes = [carpeta];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db.storage.from(BUCKET).list(actual, { limit: 1000, offset: desde });
      if (error) throw error;
      for (const item of data ?? []) {
        const ruta = `${actual}/${item.name}`;
        if (item.id === null) pendientes.push(ruta);
        else archivos.push(ruta);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return archivos;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: claveOk } = await db.rpc("limpieza_clave_ok", { p_clave: req.headers.get("x-limpieza-clave") ?? "" });
  if (!claveOk) return Response.json({ error: "No autorizado" }, { status: 401 });

  const cuerpo = await req.json().catch(() => ({}));
  const simular = cuerpo?.simular === true;
  const limite = Math.min(Math.max(Number(cuerpo?.limite) || 20, 1), 50);

  const inspeccionar = simular && typeof cuerpo?.codigo === "string" ? cuerpo.codigo.toUpperCase() : null;
  const consulta = db.from("eventos").select("id, codigo, nombre, expira_at, personalizacion");
  const { data: eventos, error } = await (inspeccionar
    ? consulta.eq("codigo", inspeccionar)
    : consulta
        .lt("expira_at", new Date().toISOString())
        .is("contenido_borrado_at", null)
        .eq("es_demo", false)
        .neq("estado", "pendiente_pago")
        .order("expira_at")
        .limit(limite));
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const resultado: { codigo: string; archivos: number; invitados: number; ok: boolean; error?: string }[] = [];
  for (const ev of eventos ?? []) {
    try {
      const archivos = await listarArchivos(db, ev.id);
      const { count: invitados } = await db.from("invitados").select("id", { count: "exact", head: true }).eq("evento_id", ev.id);
      if (!simular) {
        for (let i = 0; i < archivos.length; i += 500) {
          const { error: e } = await db.storage.from(BUCKET).remove(archivos.slice(i, i + 500));
          if (e) throw e;
        }
        const { error: e1 } = await db.from("invitados").delete().eq("evento_id", ev.id);
        if (e1) throw e1;
        const { portada_path: _portada, ...personalizacion } = (ev.personalizacion ?? {}) as Record<string, unknown>;
        const { error: e2 } = await db
          .from("eventos")
          .update({ estado: "archivado", contenido_borrado_at: new Date().toISOString(), personalizacion })
          .eq("id", ev.id);
        if (e2) throw e2;
      }
      resultado.push({ codigo: ev.codigo, archivos: archivos.length, invitados: invitados ?? 0, ok: true });
    } catch (e) {
      console.error("limpiar", ev.codigo, e);
      resultado.push({ codigo: ev.codigo, archivos: 0, invitados: 0, ok: false, error: (e as Error).message ?? String(e) });
    }
  }
  return Response.json({ simular, eventos: resultado });
});
