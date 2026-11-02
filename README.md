# SkyEventos

Plataforma para eventos: los invitados comparten fotos y mensajes con un QR, se proyectan en una pantalla en vivo, juegan misiones y al final se genera un fotolibro PDF con la temática del evento.

**Stack:** React + Vite + Tailwind · Supabase (Postgres con RLS, Auth, Storage, Realtime, Edge Functions) · Mercado Pago Checkout Pro.

## Rutas

| Ruta | Para quién |
|---|---|
| `/` | Landing con planes y temáticas |
| `/contratar` | Asistente de contratación y pago (requiere login por email) |
| `/panel`, `/panel/:id` | Panel del anfitrión: resumen, personalizar, moderar, misiones y premios, invitados, QR, fotolibro |
| `/panel/:id/libro` | Fotolibro 21 × 21 cm → “Guardar como PDF” |
| `/e`, `/e/:codigo` | App del invitado (sesión anónima, sin cuenta) |
| `/pantalla/:codigo?k=token` | Pantalla en vivo para TV/proyector |

## Puesta en marcha

1. **Base de datos:** en el SQL Editor de Supabase ejecutá `supabase/migrations/0001_esquema_inicial.sql`.
2. **Auth** (Authentication → Sign In / Providers):
   - Activar **Anonymous sign-ins** (lo usan invitados y pantallas).
   - Email con magic link activado (viene por defecto).
   - URL Configuration: Site URL = la URL pública; agregar `http://localhost:5190/**` a Redirect URLs.
3. **Frontend:** copiá `.env.example` a `.env` y completá `VITE_SUPABASE_ANON_KEY` (Settings → API).
   ```
   npm install
   npm run dev      # http://localhost:5190
   ```
4. **Mercado Pago:**
   - Desplegar las funciones: `supabase functions deploy mp-crear-preferencia` y `supabase functions deploy mp-webhook --no-verify-jwt`.
   - Secretos: `supabase secrets set MP_ACCESS_TOKEN=... APP_URL=https://tu-dominio MP_WEBHOOK_SECRET=...`.
   - Con un token `TEST-...` se usa el checkout de prueba.
   - En el panel de Mercado Pago → Webhooks, configurá `https://<proyecto>.supabase.co/functions/v1/mp-webhook` (evento *Pagos*) y copiá la clave secreta a `MP_WEBHOOK_SECRET`.
5. **Administrador:** para activar eventos sin pago (pruebas, cortesías), insertá tu usuario:
   `insert into admins (user_id) select id from auth.users where email = 'tu@email.com';`

## Pruebas de la base

`npm run test:db` aplica la migración en un Postgres embebido (PGlite) con simulaciones de `auth` y `storage` y verifica las reglas de acceso: contratación, activación por pago, ingreso por código, aislamiento entre eventos, moderación, misiones y puntos, pantalla, carpetas de storage, cierre con 48 h de gracia y límites del plan.

## Pendiente / próximas etapas

- Generación del PDF en servidor (Chromium headless sobre `/panel/:id/libro`) y envío por email.
- Mover las fotos a Cloudflare R2 si crece el volumen (hoy: Supabase Storage, bucket privado `fotos`).
- Cola de subida persistente (IndexedDB) para no perder fotos si el invitado cierra la pestaña sin conexión.
- Moderación automática de contenido, bingo fotográfico, búsqueda del tesoro con QR, trivia y votaciones.
- Borrado automático al vencer `expira_at` (cron).
