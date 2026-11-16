# Cierre de seguridad — SkyEventos

**Fecha:** 16/11/2026 · **Revisó:** skill `cierre-seguro`.

**Qué se revisó:**
- el código (`src/`, `supabase/functions/`, `supabase/migrations/`);
- el bundle compilado (`dist/`) y el historial completo de Git;
- la base de datos en producción (`ryxgalarjcrlwecxishb`), con consultas y advisors de seguridad;
- las Edge Functions desplegadas;
- los headers de Cloudflare Pages.

**Pruebas:**
- `npm run build`: compila bien.
- `npm run test:db`: pasan los 152 chequeos y falla 0.

## Veredicto: **Listo con pendientes**

- **12 de 17 controles cumplen.**
- **4 cumplen en parte,** y lo que falta depende de ajustes en paneles o de cuentas externas.
- **1 no aplica.**
- **Hay un bloqueante por confirmar:** el límite de ingresos anónimos en Supabase.

En el código no se encontró ninguna falla grave.

## Los 17 controles

| # | Control | Estado | Evidencia | Acción |
|---|---|---|---|---|
| 1 | Ocultar API keys | ✅ | El cliente solo usa `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable), `VITE_APP_URL` y `VITE_LOGIN_GOOGLE`. En `src/` y en `dist/` no aparece `service_role`, `APP_USR-`, `sk_live` ni ninguna clave privada. El token de Mercado Pago solo vive en las Edge Functions. | — |
| 2 | Eliminar secretos de Git | ✅ | Solo están versionados `.env.example` y `.env.production`, que tiene únicamente valores públicos. `.gitignore` cubre `.env`, `.env.local` y `.mcp.json`. En el historial no hay ningún JWT ni token privado; `service_role` aparece solo como nombre de rol en los tests. | Conviene agregar `.env.*.local` al `.gitignore`. |
| 3 | Key pública para la DB | ✅ | La clave `sb_publishable_…` está en el cliente y `SUPABASE_SERVICE_ROLE_KEY` solo en las funciones. | — |
| 4 | Row-Level Security | ✅ | Todas las tablas de `public` tienen RLS. No hay políticas de escritura `true`. Las dos lecturas `true` (`planes` y `ajustes`) son datos públicos. Todas las funciones `security definer` tienen `search_path`. No hay vistas. Hay 152 tests de permisos entre usuarios. | — |
| 5 | Encriptar datos sensibles | ⚠️ | Todo viaja por HTTPS, con HSTS. Las claves internas están en Vault. Los datos de tarjeta los maneja Mercado Pago. Los emails están en una tabla aparte (`invitados_contacto`) que solo ven el anfitrión y el propio invitado. El plan Pro hace backups diarios de la base, pero **los archivos de Storage no tienen copia**. | Decidir si se respaldan las fotos (S9 del informe de evaluación). |
| 6 | Forzar la autenticación | ✅ | `mp-crear-preferencia` usa verify_jwt. `cuentas` valida el JWT y que el usuario sea admin para cambiar claves. `limpiar-vencidos` valida la clave de Vault. `mp-webhook` verifica la firma HMAC y además consulta el pago a la API de Mercado Pago. Las RPC de admin validan `es_admin()`. | Confirmar que `MP_WEBHOOK_SECRET` esté cargado en Secrets. Si falta, la función solo avisa en el log, aunque igual no se puede falsificar un pago. |
| 7 | Restringir el acceso a registros | ✅ | Las políticas usan `es_miembro` y `es_organizador` por evento. Los IDs son uuid. La pantalla usa un token aleatorio y el fotolibro compartido un `libro_token` uuid que se puede revocar. El bucket `fotos` es privado. | — |
| 8 | Bloquear manipulación de campos | ✅ | El trigger `tg_eventos_upd` protege estado, plan, owner y vencimiento. Plan y precio los calcula el servidor (`crear_evento`, `aplicar_cupon`). El webhook compara el monto. Un invitado solo puede editar nombre y mesa de su propia fila. | — |
| 9 | Proteger Session cookies | ✅ | Es una SPA con la sesión de Supabase en localStorage, y está compensada: hay una CSP estricta (`script-src 'self'`), no se usa `dangerouslySetInnerHTML` ni `innerHTML` en ningún lado, y los tokens duran poco y se renuevan. | — |
| 10 | Hashear contraseñas | ⚠️ | Las contraseñas las hashea Supabase Auth con bcrypt, con largo de 8 a 72 en `cuentas`. **El advisor confirma que la protección de contraseñas filtradas está apagada**, y el admin no tiene 2FA. | Paneles: ver la lista de abajo. |
| 11 | Rate limiting | ⚠️ | El alta de cuentas tiene tope por IP (`registro_permitido`: 5 por hora y 20 por día, con test). Las demás altas dependen de Supabase Auth. **No pude confirmar que el límite de ingresos anónimos ya se haya subido de 30 a 1000 por hora.** | Confirmar en el panel. Es **bloqueante** para eventos con wifi compartido. |
| 12 | Protección contra bots | ⚠️ | No hay captcha en el registro ni en el ingreso de invitados. Lo mitiga el tope por IP. | Sumar Cloudflare Turnstile cuando tengas la site key. |
| 13 | Parametrizar queries | ✅ | No hay `execute` dinámico en las migraciones ni SQL concatenado. El cliente usa el query builder y RPCs con parámetros. | — |
| 14 | Validar inputs | ✅ | Hay `check` en la base (nombre de 1 a 60, texto de 1 a 600, caption hasta 140) y validación de email y contraseña en `cuentas`. Los montos y planes se validan en el servidor. No hay redirects armados con parámetros. | — |
| 15 | Sanitizar contenido | ✅ | React escapa todo y hay CSP completa, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y `frame-ancestors`. El mail de la cápsula escapa el HTML. Hay moderación: ocultar, bloquear y premoderación opcional. | — |
| 16 | Restringir archivos | ✅ | El bucket es privado, con 30 MB por archivo y lista blanca de MIME (imagen, video y audio, sin SVG ni HTML). La ruta la arma la app (`{evento}/{invitado}/{id}`) y las políticas de Storage exigen que sea la carpeta propia. Hay limpieza diaria de vencidos y de la demo. | — |
| 17 | Devolver datos necesarios | ✅ | Las vistas públicas van por RPC con columnas elegidas (`evento_por_codigo` no devuelve `owner_id` ni tokens). Los `select('*')` del cliente caen en tablas sin datos sensibles: `invitados` no tiene email, y las respuestas de la trivia están en `trivia_claves`, que el invitado no ve hasta que se revelan. No hay source maps públicos. | Detalle menor: `limpiar-vencidos` devuelve `error.message`, pero es un endpoint interno con clave. |

N/A: no hay `avisos-capsula` desplegada, así que su control de clave no aplica todavía.

## Hallazgos por gravedad

**Bloqueante**
1. **El límite de ingresos anónimos puede seguir en 30 por hora por IP** (control 11). Con más de 30 invitados en el mismo wifi, el resto no puede entrar.
   - **Arreglo:** Supabase → Authentication → Rate Limits → "Rate limit for anonymous users" = 1000.

**Alta**
2. **La protección de contraseñas filtradas está apagada** (control 10, lo confirma el advisor `auth_leaked_password_protection`).
3. **El admin no tiene 2FA** (control 10). Quien entre a esa cuenta puede activar eventos, crear cupones y nombrar otros admins.

**Media**
4. **No hay captcha en el registro** (control 12).
5. **Las fotos de Storage no tienen copia de seguridad** (control 5).
6. **Hay que confirmar que `MP_WEBHOOK_SECRET` esté cargado** (control 6). El código en `supabase/functions/mp-webhook/index.ts:22` lo deja como opcional.

**Baja**
7. **Cualquiera puede dar de baja de las novedades a cualquier email** con `baja_novedades(email)`. Solo apaga el envío de novedades: no expone datos ni borra nada.
8. **La extensión `pg_net` está en el esquema `public`** (advisor). Moverla puede romper el cron, así que se deja como está.
9. **Quedan 2 avisos moderados de `react-router-dom`** que solo afectan a SSR, que acá no se usa. El arreglo completo requiere pasar a v7.
10. **`limpiar-vencidos` devuelve `error.message`** (`supabase/functions/limpiar-vencidos/index.ts:101`). Es un endpoint interno con clave.

Los avisos `authenticated_security_definer_function_executable` (45) y `anon_security_definer_function_executable` (7) son **intencionales**: son las RPCs de la app, y cada una valida adentro quién la llama. Los de "Anonymous Access Policies" son el diseño esperado, porque los invitados entran como anónimos.

## Lo que arreglé

Nada en esta pasada: no apareció ninguna falla de código que haga falta corregir antes de lanzar. Los arreglos de la evaluación anterior ya están en `f50e30e`: tope de registro, CSP y HSTS, contención de errores y dependencias.

## Lo que tenés que hacer vos (Supabase → Authentication)

1. **Rate Limits:** "Rate limit for anonymous users" → **1000** → Save. *(Bloqueante.)*
2. **Attack Protection:** activar **"Prevent use of leaked passwords"** → Save.
3. **Multi-Factor:** habilitar TOTP. Después, entrar con la cuenta admin y activar la verificación en dos pasos.
4. **Edge Functions → Secrets:** confirmar que exista **`MP_WEBHOOK_SECRET`**, la clave secreta de Webhooks del panel de Mercado Pago.
5. **Opcional:** crear un sitio en Cloudflare Turnstile y pasarme la *site key* para agregar captcha.

## Cómo volver a verificar

```bash
npm run test:db
```

```bash
npm run build
```

- Volver a correr el advisor de seguridad de Supabase: tiene que desaparecer `auth_leaked_password_protection`.
- Probar con 31 o más ingresos anónimos desde una misma red, o pedirme que lo simule.
