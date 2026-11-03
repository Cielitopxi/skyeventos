# SkyEventos

Plataforma para eventos sociales y corporativos. Los invitados escanean un QR y, sin instalar nada:

- Comparten **fotos, videos y audios** de hasta 10 segundos, y dejan **mensajes**.
- Ven todo en una **pantalla en vivo** (TV o proyector).
- Juegan: **misiones**, **bingo de momentos**, **trivia** y **premios por votación**.
- Dejan mensajes en una **cápsula del tiempo** (plan Premium).

Al final, el anfitrión descarga un **fotolibro** en PDF con la temática del evento y QR para los clips.

**Stack:** React 18 + Vite + Tailwind · Supabase (Postgres con RLS, Auth, Storage, Realtime, Edge Functions) · Mercado Pago Checkout Pro · Resend (mails).

- Para salir a producción: [docs/PRODUCCION.md](docs/PRODUCCION.md).
- Cómo está armado: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Rutas

| Ruta | Para quién |
|---|---|
| `/` | Landing con planes y temáticas |
| `/demo` | Demo pública (evento `DEMO26`) |
| `/ingresar` | Login de anfitriones (enlace mágico por email) |
| `/contratar` | Asistente de contratación y pago |
| `/pago` | Retorno de Mercado Pago (espera la activación por webhook) |
| `/panel`, `/panel/:id` | Panel del anfitrión: resumen, personalizar, moderar, juegos, invitados, QR, cápsula y fotolibro |
| `/panel/:id/libro` | Fotolibro 21 × 21 cm → "Guardar como PDF" |
| `/admin` | Panel de administración (solo usuarios en `admins`) |
| `/e`, `/e/:codigo` | App del invitado: nombre + email, sin confirmación (sesión anónima) |
| `/pantalla/:codigo?k=token` | Pantalla en vivo |
| `/c/:id` | Reproductor público de un clip (el QR del fotolibro) |

## Desarrollo local

```bash
cp .env.example .env      # completar VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5190
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 5190 |
| `npm run typecheck` | Chequeo de tipos (TypeScript estricto) |
| `npm run build` | Tipos + build de producción en `dist/` |
| `npm run test:db` | Aplica las migraciones en un Postgres embebido (PGlite) y prueba las reglas de acceso |

### Variables del frontend (`.env`)

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (Settings → API). Es pública por diseño: la seguridad la da RLS. |
| `VITE_APP_URL` | URL pública de la app, sin `/` final. Se usa en los QR y en los enlaces de login. |

## Estructura

```
src/
  App.tsx              rutas (cada página se carga bajo demanda)
  components/          piezas compartidas: ui, Iconos, Portada, Instantanea (marcos), Grabador, …
  lib/                 supabase (cliente y helpers), tipos, subida (cola con reintentos),
                       imagen y clip (procesado en el teléfono), urls (URLs firmadas), tematicas
  pages/
    publico/           landing, demo, login, contratar, pago, clip público
    invitado/          app del invitado (galería, juegos, mensajes, ranking, perfil)
    panel/             panel del anfitrión, una pestaña por archivo (Tab*.tsx)
    pantalla/          pantalla en vivo
    libro/             fotolibro imprimible
    admin/             administración
supabase/
  migrations/          esquema, en orden (0001 … 0015)
  functions/           Edge Functions: mp-crear-preferencia, mp-webhook, avisos-capsula, limpiar-vencidos
  tests/               esquema.test.mjs (pruebas de RLS y reglas de negocio)
```

## Base de datos

Las migraciones de `supabase/migrations` se aplican en orden numérico. Todas las tablas tienen RLS. Las operaciones con reglas de negocio (unirse, votar, responder trivia, activar o cerrar un evento) son funciones `security definer` que validan permisos adentro. Detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

`0009_cron_capsula.sql` y `0015_limpieza_programada.sql` usan `pg_cron`, `pg_net` y Vault, por eso quedan fuera de `test:db` (PGlite no los trae).

## Pruebas

`npm run test:db` levanta un Postgres embebido con simulaciones de `auth` y `storage` y verifica, entre otras cosas:

- Contratación y activación por pago.
- Ingreso por código, registro con email y quién puede ver cada email.
- Aislamiento entre eventos y moderación.
- Misiones, bingo, votación secreta, trivia y cápsula.
- Clips por plan y su QR público, y marcos.
- Límites de cada plan y cierre con 48 h de gracia.

Cada línea `✓` muestra el resultado de una verificación. Las que dicen `true` o `false` hay que mirarlas: un `false` no corta la ejecución. Si un rechazo esperado no ocurre, se marca con `✗` y el proceso termina con código 1.
