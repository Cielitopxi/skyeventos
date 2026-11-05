export type EstadoEvento = "pendiente_pago" | "activo" | "cerrado" | "archivado";
export type EstadoContenido = "pendiente" | "aprobada" | "oculta";

export interface Personalizacion {
  titulo?: string;
  subtitulo?: string;
  bienvenida?: string;
  dedicatoria?: string;
  acento?: string; // hex opcional que pisa el acento de la temática
  portada_path?: string;
  portada?: DisenoPortada; // solo planes con portada personalizada
  juegos?: Partial<Record<JuegoId, boolean>>; // ausente = activo
  marco?: MarcoFoto | null; // marco instantánea de todas las fotos del evento, lo elige el anfitrión
  libro?: { formato?: string; diseno?: string }; // fotolibro: ver lib/libro.ts (por defecto A4 horizontal, clásico)
}

export type MarcoFoto = "blanco" | "negro" | "crema" | "dorado" | "rosa" | "celeste" | "kraft";

export type JuegoId = "misiones" | "bingo" | "trivia" | "votacion" | "capsula";

export interface DisenoPortada {
  estilo: "banda" | "completa" | "marco";
  fuente: string; // id de FUENTES_PORTADA
  alineacion: "centro" | "abajo";
  oscurecer: number; // 0 a 80 (% de velo sobre la foto)
  color?: string; // color del título sobre la foto
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
  capsula: boolean;
  portada_personalizada: boolean;
  clips: boolean;
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
  expira_at: string | null; // hasta cuándo se guarda el contenido (fecha + retención del plan)
  contenido_borrado_at?: string | null; // lo marca limpiar-vencidos al borrar el contenido
  libro_token?: string | null; // link público del fotolibro (compartir_libro)
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

export type MedioFoto = "foto" | "video" | "audio";

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
  medio: MedioFoto;
  duracion: number | null;
  marco: MarcoFoto | null;
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

export type EstadoVotacion = "preparada" | "abierta" | "cerrada" | "revelada";

export interface CategoriaVoto {
  id: string;
  evento_id: string;
  titulo: string;
  orden: number;
  estado: EstadoVotacion;
  created_at: string;
}

export interface FilaResultado {
  categoria_id: string;
  candidato_id: string;
  nombre: string;
  mesa: string | null;
  votos: number;
}

export type EstadoTrivia = "preparada" | "abierta" | "cerrada";

export interface PreguntaTrivia {
  id: string;
  evento_id: string;
  texto: string;
  opciones: string[];
  puntos: number;
  orden: number;
  estado: EstadoTrivia;
  created_at: string;
}

export interface ResumenTrivia {
  pregunta_id: string;
  opcion: number;
  respuestas: number;
}

export interface CapsulaItem {
  id: string;
  evento_id: string;
  invitado_id: string;
  texto: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface EstadoCapsula {
  items: number;
  invitados: number;
  abre_at: string;
  abierta: boolean;
  habilitada: boolean;
}

/** Resultado de cupon_evaluar: cuánto descuenta un código para un plan. */
export interface Cupon {
  valido: boolean;
  mensaje: string;
  codigo: string;
  precio: number;
  descuento: number;
  total: number;
}

/** Código de descuento o tarjeta de regalo (tabla cupones). */
export interface CodigoDescuento {
  codigo: string;
  tipo: "porcentaje" | "monto" | "regalo";
  valor: number;
  plan_id: string | null;
  usos_max: number | null;
  usos: number;
  vence_at: string | null;
  activo: boolean;
  nota: string | null;
  comprador_id: string | null;
  para: string | null;
  mensaje: string | null;
  created_at: string;
}

/** Compra de una tarjeta de regalo. */
export interface PedidoRegalo {
  id: string;
  cupon: string;
  owner_id: string;
  plan_id: string;
  monto: number;
  estado: "pendiente" | "aprobado" | "rechazado" | "cancelado";
  created_at: string;
  pagado_at: string | null;
}
