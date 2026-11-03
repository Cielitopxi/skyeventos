export type EstadoEvento = "pendiente_pago" | "activo" | "cerrado" | "archivado";
export type EstadoContenido = "pendiente" | "aprobada" | "oculta";

export interface Personalizacion {
  titulo?: string;
  subtitulo?: string;
  bienvenida?: string;
  dedicatoria?: string;
  acento?: string; // hex opcional que pisa el acento de la temática
  portada_path?: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precio_ars: number;
  max_invitados: number | null;
  max_fotos: number | null;
  pantallas: number;
  retencion_dias: number;
  misiones: boolean;
  sin_marca: boolean;
  orden: number;
}

export interface Evento {
  id: string;
  codigo: string;
  owner_id: string;
  plan_id: string;
  tipo: string;
  tematica: string;
  nombre: string;
  fecha: string | null;
  personalizacion: Personalizacion;
  moderacion: "previa" | "posterior";
  estado: EstadoEvento;
  token_pantalla: string;
  premios_activos: boolean;
  cerrado_at: string | null;
  expira_at: string | null;
  created_at: string;
}

export interface EventoPublico {
  id: string;
  nombre: string;
  tipo: string;
  tematica: string;
  fecha: string | null;
  personalizacion: Personalizacion;
  estado: EstadoEvento;
  abierto: boolean;
  premios_activos: boolean;
}

export interface Invitado {
  id: string;
  evento_id: string;
  user_id: string;
  nombre: string;
  mesa: string | null;
  avatar_path: string | null;
  bloqueado: boolean;
  created_at: string;
}

export interface Foto {
  id: string;
  evento_id: string;
  invitado_id: string;
  storage_path: string;
  thumb_path: string;
  ancho: number | null;
  alto: number | null;
  caption: string | null;
  mision_id: string | null;
  bingo_id: string | null;
  estado: EstadoContenido;
  mision_estado: "pendiente" | "aprobada" | "rechazada" | null;
  destacada: boolean;
  en_libro: boolean;
  created_at: string;
}

export interface Mensaje {
  id: string;
  evento_id: string;
  invitado_id: string;
  texto: string;
  tipo: "nota" | "dedicatoria";
  estado: EstadoContenido;
  en_libro: boolean;
  created_at: string;
}

export interface CasillaBingo {
  id: string;
  evento_id: string;
  posicion: number;
  texto: string;
}

export interface Mision {
  id: string;
  evento_id: string;
  titulo: string;
  descripcion: string | null;
  puntos: number;
  validacion: "automatica" | "moderador";
  relampago: boolean;
  inicio: string | null;
  fin: string | null;
  orden: number;
}

export interface Premio {
  id: string;
  evento_id: string;
  puesto: number;
  descripcion: string;
}

export interface FilaRanking {
  invitado_id: string;
  nombre: string;
  mesa: string | null;
  puntos: number;
  fotos: number;
  misiones: number;
}

export interface Anuncio {
  id: string;
  evento_id: string;
  texto: string;
  created_at: string;
}
