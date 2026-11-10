# Puesta en producción

Proyecto Supabase: `ryxgalarjcrlwecxishb`. Las casillas marcadas ya están hechas. Las vacías son pasos que tienen que hacer quienes tienen acceso a cada cuenta (Supabase, Mercado Pago, Resend, hosting).

## 1. Base de datos

- [x] Migraciones `0001` a `0019` aplicadas.
  - `0016`: códigos de descuento, tarjetas de regalo y fotolibro compartido.
  - `0017`: horario de cada evento (`inicio_at`, `fin_at`, máximo 24 h) y consentimiento de novedades de los invitados.
  - `0018`: tabla `ajustes` con los márgenes de habilitación: por defecto 3 h antes del inicio y 24 h después del fin. Se cambian desde `/admin → Horarios`.
  - `0019`: la trivia se completa sola: al terminar el evento, las preguntas abiertas se revelan y suman al ranking.
- [x] RLS activo en todas las tablas; advisors de seguridad sin errores.
  - Las advertencias de funciones `security definer` ejecutables son intencionales: validan permisos adentro.
  - Las de "anonymous access" son intencionales: los invitados usan sesión anónima.
- [ ] **Plan Pro de Supabase** (backups diarios; Point-in-Time Recovery opcional). El plan Free pausa el proyecto tras una semana sin uso.
- [ ] Revisar los precios de `planes` desde `/admin → Planes` antes de abrir las ventas.

## 2. Auth (Supabase → Authentication)

- [x] **Sin mails de Supabase.** Los anfitriones crean su cuenta con email y contraseña desde `/ingresar?registro=1`. La función `cuentas` (verify_jwt = false; valida permisos adentro) la crea ya confirmada, sin mandar ningún mail. Desplegada el 5/11/2026.
  - Si alguien olvida la contraseña, escribe a skystudio.ar y un admin le pone una nueva desde `/admin → Usuarios → Nueva contraseña`. Después la cambia desde su panel ("Mi contraseña").
  - Cualquiera puede crear una cuenta con cualquier email (no hay verificación). Es el costo de no mandar mails; la cuenta no ve nada hasta que contrata un evento.
- [ ] **Ingreso con Google** (opcional):
  1. En Google Cloud Console → APIs y servicios → Credenciales: crear un ID de cliente OAuth (aplicación web).
     URI de redirección autorizada: `https://ryxgalarjcrlwecxishb.supabase.co/auth/v1/callback`.
  2. En Supabase → Authentication → Sign In / Providers → Google: activar y pegar el Client ID y el Client Secret.
  3. Agregar `VITE_LOGIN_GOOGLE=1` en `.env.production` y hacer push: aparece el botón "Continuar con Google" en `/ingresar`.
- [ ] **Anonymous sign-ins** activado (ya lo usan invitados y pantallas).
- [ ] **Rate limits → anonymous users:** subirlo. Viene en 30 por hora por IP, y en un salón todos los invitados comparten el wifi: a partir del invitado 31 en esa hora no se puede entrar. Un valor razonable es 500 o más por hora.
- [ ] **URL Configuration:**
  - Site URL = dominio de producción (`https://eventos.skystudio.ar`).
  - Redirect URLs = `https://eventos.skystudio.ar/**`. Quitar los `localhost` cuando ya no se usen.
- [ ] Los invitados **no** confirman email: se registran con sesión anónima y el email queda como dato de contacto. No hace falta tocar "Confirm email", que aplica a cuentas con contraseña y no se usa.

## 3. Pagos (Mercado Pago)

- [x] `mp-crear-preferencia` (verify_jwt) y `mp-webhook` (verify_jwt = false) desplegadas el 5/11/2026 (versión 2: cobran también tarjetas de regalo, con `external_reference = regalo:<id>`). Sin `MP_ACCESS_TOKEN` responden "Mercado Pago no está configurado".
- [ ] Cargar los secretos en Supabase → Edge Functions → Secrets (nunca en el repo): `MP_ACCESS_TOKEN`, `APP_URL=https://eventos.skystudio.ar` y `MP_WEBHOOK_SECRET`.

Para volver a desplegarlas desde la terminal:

```bash
supabase functions deploy mp-crear-preferencia --project-ref ryxgalarjcrlwecxishb
supabase functions deploy mp-webhook --no-verify-jwt --project-ref ryxgalarjcrlwecxishb
supabase secrets set --project-ref ryxgalarjcrlwecxishb \
  MP_ACCESS_TOKEN=APP_USR-... APP_URL=https://eventos.skystudio.ar MP_WEBHOOK_SECRET=...
```

- [x] **En producción desde el 10/11/2026**: token de producción cargado, `MP_PRUEBA` borrado. Pago real de $1.000 (código `PRUEBAMP`, evento Q4UH3D, pago 188828132998) aprobado y evento activado solo por el webhook. El sandbox con las credenciales de prueba de la cuenta daba "Algo anduvo mal": para probar, usar un código de descuento y pagar de verdad con una tarjeta que no sea la de la cuenta que cobra.
- [x] En Mercado Pago → Tus integraciones → Webhooks: URL `https://ryxgalarjcrlwecxishb.supabase.co/functions/v1/mp-webhook`, evento **Pagos**. Copiar la clave secreta a `MP_WEBHOOK_SECRET`.
- [ ] Hacer una compra real de punta a punta: el evento tiene que pasar a `activo` solo.
- [ ] Probar una tarjeta de regalo (`/regalar`): al acreditarse el pago, el código aparece en "Mis regalos" y se canjea en el último paso de `/contratar`.
- Códigos de descuento: se crean en `/admin → Códigos` (porcentaje o monto, por plan, con usos máximos y vencimiento). Si un código cubre el 100 %, el evento se activa sin pasar por Mercado Pago. Link directo para campañas: `https://eventos.skystudio.ar/contratar?cupon=CODIGO`.

## 4. Avisos de la cápsula (Resend)

- [x] `pg_cron` encola los avisos todos los días a las 9:00 de Argentina (`0009_cron_capsula.sql`).
- [ ] Verificar el dominio en Resend y desplegar la función:

```bash
supabase functions deploy avisos-capsula --project-ref ryxgalarjcrlwecxishb
supabase secrets set --project-ref ryxgalarjcrlwecxishb \
  RESEND_API_KEY=re_... AVISOS_REMITENTE="SkyEventos <eventos@skystudio.ar>" APP_URL=https://eventos.skystudio.ar AVISOS_CLAVE=<clave larga al azar>
```

- [ ] Programarla una vez por día (Edge Functions → la función → Schedules) enviando el header `x-avisos-clave: <AVISOS_CLAVE>`.

Mientras no esté programada, el anfitrión igual ve el aviso en su panel.

## 5. Borrado automático de eventos vencidos

Cada plan guarda el contenido `retencion_dias` días desde la fecha del evento (`expira_at`). Una vez vencido el plazo, la función `limpiar-vencidos` hace esto por cada evento:

1. Borra del bucket la carpeta `{evento}/`: fotos, clips, miniaturas, cápsula y portada.
2. Borra los invitados. En cascada se van sus fotos, mensajes, votos, respuestas, cápsula y emails.
3. Deja el evento en `archivado` con `contenido_borrado_at`. El evento y el pedido se conservan.

Nunca toca el evento demo ni los que no se pagaron. A los anfitriones el panel les avisa desde 15 días antes, con un link para descargar el ZIP y el fotolibro.

- [x] `0014_limpieza_vencidos.sql` aplicada (marca de borrado protegida; probada en `test:db`).
- [x] Función `limpiar-vencidos` desplegada con `verify_jwt = false`. La protege una clave propia, no un JWT.
- [x] `0015_limpieza_programada.sql` aplicada: la clave está en Vault (nadie la ve), `pg_net` está activo y la tarea `limpiar-eventos-vencidos` corre todos los días a las 03:00 de Argentina.
- [x] Probada el 4/11/2026:
  - Sin clave responde 401.
  - La simulación general no encontró eventos vencidos.
  - La inspección de `DEMO26` contó 22 archivos y 3 invitados, igual que Storage, sin borrar nada.

Para volver a desplegar la función después de cambiarla:

```bash
supabase functions deploy limpiar-vencidos --no-verify-jwt --project-ref ryxgalarjcrlwecxishb
```

Para ver qué borraría hoy, sin borrar nada, desde el SQL Editor (agregar `"codigo": "ABC123"` al cuerpo para inspeccionar un evento puntual aunque no esté vencido):

```sql
select net.http_post(
  url := 'https://ryxgalarjcrlwecxishb.supabase.co/functions/v1/limpiar-vencidos',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-limpieza-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'limpieza_clave')),
  body := '{"simular": true}'::jsonb);
-- unos segundos después:
select status_code, content from net._http_response order by created desc limit 1;
```

## 6. Hosting del frontend

Es una SPA estática: `npm run build` genera `dist/`.

- [x] Código en GitHub: `https://github.com/Cielitopxi/skyeventos` (rama `main`).
- [x] **Cloudflare Workers**, proyecto `skyeventos` (Workers Builds conectado a GitHub). Es gratis y permite uso comercial: los archivos estáticos no cuentan para el límite de pedidos. `skystudio.ar` ya está en Cloudflare.
  - `wrangler.jsonc` publica `dist/` como sitio. Las rutas de la app que no son archivos devuelven `index.html` (`single-page-application`).
  - Los headers de seguridad y la caché de `assets/` están en `public/_headers`.
  - Build command `npm run build`; deploy command `npx wrangler deploy` (el que viene por defecto).
- [x] **Variables:** van en `.env.production`, dentro del repo: la URL de Supabase, la clave publicable y la URL de la app. Son públicas por diseño, así que no hace falta cargar nada en el panel de Cloudflare. **Nunca** poner ahí claves secretas (`service_role`, tokens).
- Cada push a `main` publica solo, en uno o dos minutos.
- [x] **Dominio:** `eventos.skystudio.ar` está declarado en `routes` de `wrangler.jsonc`. Como la zona está en esta cuenta de Cloudflare, el deploy crea el DNS y el certificado HTTPS. La cámara y el micrófono del grabador **solo funcionan con HTTPS**.
- Dirección provisoria del Worker: `https://skyeventos.cuenta-skystudio.workers.dev`.
- [x] **PWA de invitados:** íconos PNG, `public/sw.js` (abre sin conexión) y manifest por evento: el ícono instalado abre directo `/e/CODIGO`. En Android aparece el botón "Instalar"; en iPhone, la indicación de Compartir → Agregar a inicio.
- [ ] Probar en un celular real (iOS Safari y Android Chrome):
  - Entrar por QR.
  - Sacar una foto.
  - Grabar un video y un audio.
  - Ver la pantalla en vivo en una TV.
- [ ] **App en Google Play:** pasos en [GOOGLE_PLAY.md](GOOGLE_PLAY.md). Falta la cuenta de Play Console, generar el paquete y pegar la huella SHA-256 en `public/.well-known/assetlinks.json`.
- Fotolibro compartido: desde el fotolibro, "Compartir" genera `https://eventos.skystudio.ar/libro/<token>` (se ve sin cuenta y se puede desactivar). La vista previa en WhatsApp o Facebook muestra la imagen y el texto generales de SkyEventos, no la portada del evento.

## 7. Contenido y legales

- [x] Emails de invitados: obligatorios para entrar. La casilla "Quiero recibir novedades y promociones" es opcional y queda registrada con fecha. En `/admin → Contactos` se descarga el CSV (por defecto, solo quienes aceptaron). Cada envío de publicidad tiene que llevar el link de baja `https://eventos.skystudio.ar/baja`.
- [x] Borrador de **política de privacidad** (`/privacidad`) y **términos** (`/terminos`), con **botón de arrepentimiento** (`/terminos#arrepentimiento`, Res. 424/2020). Enlazados en el pie de la portada, el registro del invitado, crear cuenta y el pago.
- [ ] **Revisarlos con un abogado** y completar en `src/pages/publico/Legal.tsx` (`RESPONSABLE`) la razón social, el CUIT y el domicilio. Confirmar que `eventos@skystudio.ar` recibe mails: es el contacto de los dos textos y del botón de arrepentimiento.
- [ ] Revisar el evento de demostración `DEMO26`. Tiene datos de prueba ocultos (fotos de prueba y un invitado "Prueba Votación").

## 7 bis. Instalación como app (invitados)

- **Android:** PWA con botón "Instalar la app" (aviso fijo, guía y botón en "Yo"). Para Google Play, ver `docs/GOOGLE_PLAY.md`.
- **iPhone:** no hay versión en App Store. Una app que solo envuelve la web suele rechazarse (guía 4.2 de Apple) y requiere la cuenta de desarrollador (USD 99 por año). Los invitados la instalan desde Safari con Compartir → **Agregar a inicio**. La app muestra los pasos según el navegador y avisa si el link se abrió dentro de Instagram o Facebook, que no dejan instalar. El ícono abre directo el evento, con su nombre.
- Después de registrarse, en el celular se abre sola la guía de instalación. El anfitrión tiene en la pestaña QR un mensaje listo para mandar por WhatsApp antes del evento.

## 8. Pendientes conocidos (no bloquean el lanzamiento)

| Tema | Estado | Impacto |
|---|---|---|
| Cola de subida persistente | En memoria | Si el invitado cierra la pestaña sin conexión, pierde las fotos que no se subieron. |
| PDF del fotolibro en servidor | Se genera en el navegador con "Guardar como PDF" | Depende del navegador del anfitrión. |
| Archivos huérfanos | Si se rechaza el registro de una foto (por ejemplo, se llegó al máximo del plan), el archivo ya subido queda en Storage. | Bajo. |
| Moderación automática | No hay | El anfitrión modera a mano (moderación previa o posterior). |

## 9. Antes de cada despliegue

```bash
npm run typecheck
npm run test:db
npm run build
```
