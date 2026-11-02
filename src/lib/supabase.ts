import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && key);

export const supabase = createClient(url || "http://localhost:54321", key || "sin-configurar", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const APP_URL = ((import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin).replace(/\/$/, "");

export const BUCKET = "fotos";

/** Garantiza una sesión (anónima si no hay otra). Invitados y pantallas usan esto. */
export async function asegurarSesion() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const r = await supabase.auth.signInAnonymously();
  if (r.error) throw new Error("No se pudo iniciar la sesión de invitado: " + r.error.message);
  return r.data.session!;
}

export function mensajeError(e: unknown): string {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const m = (e as { message?: string }).message;
  return m || "Error desconocido";
}
