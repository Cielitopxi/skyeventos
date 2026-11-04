# Puesta en producción

Proyecto Supabase: `ryxgalarjcrlwecxishb`. Las casillas marcadas ya están hechas. Las vacías son pasos que tienen que hacer quienes tienen acceso a cada cuenta (Supabase, Mercado Pago, Resend, hosting).

## 1. Base de datos

- [x] Migraciones `0001` a `0015` aplicadas (`list_migrations` muestra las 15).
- [x] RLS activo en todas las tablas; advisors de seguridad sin errores.
  - Las advertencias de funciones `security definer` ejecutables son intencionales: validan permisos adentro.
  - Las de "anonymous access" son intencionales: los invitados usan sesión anónima.
- [ ] **Plan Pro de Supabase** (backups diarios; Point-in-Time Recovery opcional). El plan Free pausa el proyecto tras una semana sin uso.
- [ ] Revisar los precios de `planes` desde `/admin → Planes` antes de abrir las ventas.

## 2. Auth (Supabase → Authentication)

- [ ] **SMTP propio** (Settings → SMTP; por ejemplo, el de Resend). **Imprescindible.** El servidor de correo que trae Supabase manda muy pocos mails por hora y solo a direcciones del equipo: sin SMTP propio los anfitriones no reciben el enlace para entrar.
- [ ] Personalizar la plantilla "Magic Link" (Emails → Templates) con la marca, en español.
- [ ] **Anonymous sign-ins** activado (ya lo usan invitados y pantallas).
- [ ] **Rate limits → anonymous users:** subirlo. Viene en 30 por hora por IP, y en un salón todos los invitados comparten el wifi: a partir del invitado 31 en esa hora no se puede entrar. Un valor razonable es 500 o más por hora.
- [ ] **URL Configuration:**
  - Site URL = dominio de producción (por ejemplo, `https://skyeventos.com`).
  - Redirect URLs = `https://skyeventos.com/**`. Quitar los `localhost` cuando ya no se usen.
- [ ] Los invitados **no** confirman email: se registran con sesión anónima y el email queda como dato de contacto. No hace falta tocar "Confirm email", que aplica a cuentas con contraseña y no se usa.

## 3. Pagos (Mercado Pago)

Las funciones están escritas pero **no desplegadas**: hacen falta las credenciales.

```bash
supabase functions deploy mp-crear-preferencia --project-ref ryxgalarjcrlwecxishb
supabase functions deploy mp-webhook --no-verify-jwt --project-ref ryxgalarjcrlwecxishb
supabase secrets set --project-ref ryxgalarjcrlwecxishb \
  MP_ACCESS_TOKEN=APP_USR-... APP_URL=https://skyeventos.com MP_WEBHOOK_SECRET=...
```

- [ ] Probar primero con un token `TEST-...`: usa el checkout de prueba.
- [ ] En Mercado Pago → Tus integraciones → Webhooks: URL `https://ryxgalarjcrlwecxishb.supabase.co/functions/v1/mp-webhook`, evento **Pagos**. Copiar la clave secreta a `MP_WEBHOOK_SECRET`.
- [ ] Hacer una compra real de punta a punta: el evento tiene que pasar a `activo` solo.

## 4. Avisos de la cápsula (Resend)

- [x] `pg_cron` encola los avisos todos los días a las 9:00 de Argentina (`0009_cron_capsula.sql`).
- [ ] Verificar el dominio en Resend y desplegar la función:

```bash
supabase functions deploy avisos-capsula --project-ref ryxgalarjcrlwecxishb
supabase secrets set --project-ref ryxgalarjcrlwecxishb \
  RESEND_API_KEY=re_... AVISOS_REMITENTE="SkyEventos <hola@skyeventos.com>" APP_URL=https://skyeventos.com AVISOS_CLAVE=<clave larga al azar>
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

- [ ] Elegir el hosting. Ya está configurado para:
  - **Vercel:** `vercel.json`, con rewrites a `index.html` y headers de seguridad.
  - **Netlify o Cloudflare Pages:** `public/_redirects` y `public/_headers`.
- [ ] Variables de entorno del build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL=https://skyeventos.com`.
- [ ] Dominio con HTTPS. La cámara y el micrófono del grabador **solo funcionan con HTTPS**.
- [ ] Probar en un celular real (iOS Safari y Android Chrome):
  - Entrar por QR.
  - Sacar una foto.
  - Grabar un video y un audio.
  - Ver la pantalla en vivo en una TV.

## 7. Contenido y legales

- [ ] Política de privacidad y términos, con link en la landing y en el registro del invitado. Ahora se juntan **emails** de invitados (Ley 25.326 de Protección de Datos Personales): indicar para qué se usan y cómo pedir la baja. El registro ya pide aceptar que los anfitriones reciban nombre y email.
- [ ] Revisar el evento de demostración `DEMO26`. Tiene datos de prueba ocultos (fotos de prueba y un invitado "Prueba Votación").

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
