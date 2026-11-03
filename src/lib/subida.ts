import { medioDe, procesarClip } from "./clip";
import { procesarImagen } from "./imagen";
import { BUCKET, supabase } from "./supabase";

export interface TareaSubida {
  id: string;
  archivo: File;
  nombre: string;
  estado: "esperando" | "procesando" | "subiendo" | "listo" | "error";
  error?: string;
  intentos: number;
  misionId?: string | null;
  bingoId?: string | null;
  caption?: string;
  duracion?: number; // la que midió el grabador (clips)
}

type Oyente = (tareas: TareaSubida[]) => void;

/**
 * Cola de subida con reintentos: si se corta el wifi del salón, las fotos quedan
 * esperando y se reintentan solas al volver la conexión.
 */
export class ColaSubida {
  private tareas: TareaSubida[] = [];
  private oyentes = new Set<Oyente>();
  private trabajando = false;

  constructor(private eventoId: string, private invitadoId: string) {
    window.addEventListener("online", () => this.procesar());
  }

  suscribir(fn: Oyente) {
    this.oyentes.add(fn);
    fn(this.tareas);
    return () => {
      this.oyentes.delete(fn);
    };
  }

  private avisar() {
    const copia = this.tareas.map((t) => ({ ...t }));
    this.oyentes.forEach((f) => f(copia));
  }

  agregar(archivos: File[], opciones: { misionId?: string | null; bingoId?: string | null; caption?: string; duracion?: number } = {}) {
    for (const archivo of archivos) {
      this.tareas.push({
        id: crypto.randomUUID(),
        archivo,
        nombre: archivo.name,
        estado: "esperando",
        intentos: 0,
        misionId: opciones.misionId ?? null,
        bingoId: opciones.bingoId ?? null,
        caption: opciones.caption,
        duracion: opciones.duracion,
      });
    }
    this.avisar();
    this.procesar();
  }

  limpiarListas() {
    this.tareas = this.tareas.filter((t) => t.estado !== "listo");
    this.avisar();
  }

  reintentar() {
    this.tareas.forEach((t) => {
      if (t.estado === "error") t.estado = "esperando";
    });
    this.avisar();
    this.procesar();
  }

  private async procesar() {
    if (this.trabajando) return;
    this.trabajando = true;
    try {
      let t: TareaSubida | undefined;
      while ((t = this.tareas.find((x) => x.estado === "esperando"))) {
        if (!navigator.onLine) break;
        await this.subir(t);
      }
    } finally {
      this.trabajando = false;
    }
  }

  private async subir(t: TareaSubida) {
    try {
      t.estado = "procesando";
      this.avisar();
      // Fotos: se reducen en el teléfono. Clips: se suben tal cual, con un cuadro como miniatura.
      const medio = medioDe(t.archivo) ?? "foto";
      const m =
        medio === "foto"
          ? await procesarImagen(t.archivo).then((img) => ({
              archivo: img.completa, contentType: "image/jpeg", extension: "jpg", miniatura: img.miniatura,
              ancho: img.ancho as number | null, alto: img.alto as number | null, duracion: null as number | null,
            }))
          : await procesarClip(t.archivo, t.duracion);
      t.estado = "subiendo";
      this.avisar();
      const base = `${this.eventoId}/${this.invitadoId}/${t.id}`;
      const st = supabase.storage.from(BUCKET);
      const a = await st.upload(`${base}.${m.extension}`, m.archivo, { contentType: m.contentType, upsert: true });
      if (a.error) throw a.error;
      const b = await st.upload(`${base}_t.jpg`, m.miniatura, { contentType: "image/jpeg", upsert: true });
      if (b.error) throw b.error;
      const { error } = await supabase.from("fotos").insert({
        id: t.id,
        evento_id: this.eventoId,
        invitado_id: this.invitadoId,
        storage_path: `${base}.${m.extension}`,
        thumb_path: `${base}_t.jpg`,
        ancho: m.ancho,
        alto: m.alto,
        medio,
        duracion: m.duracion,
        mision_id: t.misionId || null,
        bingo_id: t.bingoId || null,
        caption: t.caption?.trim() || null,
      });
      if (error && error.code !== "23505") throw error; // 23505: ya estaba registrada (reintento)
      t.estado = "listo";
    } catch (e) {
      t.intentos++;
      const msg = (e as { message?: string }).message || "Error al subir";
      const definitivo = /máximo|no está disponible|bloquead|row-level|segundos|plan Fiesta|admitido|duración/i.test(msg) || t.intentos >= 4;
      t.estado = definitivo ? "error" : "esperando";
      t.error = msg;
      if (!definitivo) await new Promise((r) => setTimeout(r, 1500 * 2 ** t.intentos));
    }
    this.avisar();
  }
}
