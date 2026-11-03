# Arquitectura

## Piezas

```
Celular del invitado ─┐                         ┌─ Edge Function mp-crear-preferencia ─► Mercado Pago
Panel del anfitrión ──┼──► Supabase (Postgres + RLS, Auth, Storage, Realtime) ◄─┤
Pantalla (TV) ────────┘                         ├─ Edge Function mp-webhook ◄─ Mercado Pago
                                                └─ Edge Function avisos-capsula ─► Resend (mail)
```

El frontend es una SPA estática (Vite). No hay servidor propio: toda la lógica que tiene que ser confiable vive en Postgres, en políticas RLS, triggers y funciones `security definer`, o en las Edge Functions.

## Quién es quién (Auth)

| Actor | Sesión | Cómo entra |
|---|---|---|
| Anfitrión | Usuario con email | Enlace mágico (`signInWithOtp`) en `/ingresar` |
| Co-organizador | Usuario con email | Fila en `organizadores` |
| Invitado | **Anónima** (`signInAnonymously`) | `registrar_invitado(codigo, nombre, email, mesa)`: el email se guarda como contacto, **sin mail de confirmación** |
| Pantalla | Anónima | `unirse_pantalla(codigo, token)` con el token secreto del link |
| Admin | Usuario con email | Fila en `admins` |

Las funciones `es_organizador`, `es_miembro`, `mi_invitado` y `es_admin` son la base de todas las políticas.

## Ciclo de vida de un evento

1. **`crear_evento`** (anfitrión con email): crea el evento en `pendiente_pago` y un `pedido`.
2. **Pago:** `mp-crear-preferencia` arma el checkout. Mercado Pago llama a `mp-webhook`, que consulta el pago en la API de MP, controla monto y moneda, y ejecuta **`activar_evento`** (solo `service_role` o admin). Esto pasa el evento a `activo` y calcula `expira_at = fecha + retencion_dias del plan`.
3. **`activo`:** los invitados suben contenido.
4. **`cerrar_evento`:** pasa a `cerrado`. Durante 48 h se sigue aceptando contenido (`evento_abierto`).
5. **`archivado`:** lo marca el admin.

## Datos

| Tabla | Qué guarda |
|---|---|
| `planes` | Límites y funciones de cada plan (invitados, fotos, pantallas, retención, misiones, clips, cápsula, portada) |
| `eventos`, `organizadores`, `pedidos` | El evento, quién lo administra y su pago |
| `invitados` | Nombre, mesa y bloqueo. La ven todos los miembros del evento (para votar y para el ranking) |
| `invitados_contacto` | Email del invitado. **Solo** la ven los organizadores y el propio invitado |
| `pantallas` | Sesiones de TV conectadas, con cupo por plan (se recicla la más vieja) |
| `fotos` | Fotos, videos y audios (`medio`, `duracion` ≤ 10 s), con estado de moderación, misión, bingo, destacada y `en_libro` |
| `mensajes` | Mensajes y dedicatorias |
| `misiones`, `premios`, `anuncios` | Juegos con puntos, premios del ranking y avisos en pantalla |
| `bingo_casillas` | Cartón de 3 × 3 |
| `votacion_categorias`, `votos` | Premios por votación, con voto secreto |
| `trivia_preguntas`, `trivia_claves`, `trivia_respuestas` | Trivia. La respuesta correcta va en una tabla aparte que el invitado no puede leer |
| `capsula_items`, `notificaciones` | Cápsula del tiempo (Premium) y mails pendientes |
| `admins` | Administradores |

`eventos.personalizacion` (jsonb) guarda título, bienvenida, colores, portada, juegos activos y `marco`. El marco de foto instantánea lo elige el anfitrión para todo el evento y se dibuja al mostrar la foto (`components/Instantanea.tsx`, `marcoDe`), así que la foto original nunca se modifica.

## Archivos (Storage)

- **Bucket privado `fotos`**, con rutas `{evento}/{invitado}/{id}.{ext}` y la miniatura en `{id}_t.jpg`. La portada va en `{evento}/portada/…`.
- **Políticas:** lee quien es miembro del evento; sube el propio invitado mientras `evento_abierto`, o un organizador; borra el dueño o un organizador.
- **Excepción pública:** el archivo de un clip incluido en el libro se puede leer sin sesión, para el QR del fotolibro (`clip_archivo_publico`).
- **URLs firmadas:** el frontend firma URLs de 2 h y las guarda en caché (`lib/urls.ts`).
- **Procesado en el teléfono:**
  - Las fotos se reducen a 2048 px, más una miniatura de 520 px (`lib/imagen.ts`).
  - Los clips se suben tal cual, con un cuadro como miniatura (`lib/clip.ts`).
- **Cola de subida:** `lib/subida.ts` reintenta con espera creciente y se reanuda al volver la conexión.

## Tiempo real

La publicación `supabase_realtime` incluye `fotos`, `mensajes`, `anuncios`, `misiones`, `bingo_casillas`, `votacion_categorias` y `trivia_preguntas`. La pantalla y la app del invitado se suscriben por `evento_id`; Realtime respeta RLS. El ranking y los resultados se refrescan con polling (cada 10 a 30 s).

## Frontend

- Cada ruta se carga bajo demanda (`React.lazy` en `App.tsx`): el invitado que escanea el QR baja solo su parte.
- La temática del evento (`lib/tematicas.ts`) define colores y tipografías mediante variables CSS (`--t-*`). `ConTema` las aplica.
- Los tipos de la base están a mano en `lib/tipos.ts`.
