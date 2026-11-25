# Salida a producción — SkyEventos

**Fecha:** 25/11/2026. Revisión completa del sistema en vivo (eventos.skystudio.ar + Supabase `ryxgalarjcrlwecxishb`).

## Veredicto: **listo para vender, con 3 pasos tuyos antes**

El sistema funciona de punta a punta y no tiene errores. Antes de anunciarlo hay tres ajustes de panel que solo podés hacer vos (sección "Antes de lanzar"). Lo demás es para las primeras semanas.

## Qué revisé y cómo está

| Área | Estado | Detalle |
|---|---|---|
| Sitio publicado | ✅ | Coincide con el último commit (`4e2675e`). Inicio, demo, contratar, regalar, legales, imagen para compartir y manifest responden 200. Sin errores en la consola. Los 4 planes se ven, el Descartable incluido. |
| Seguridad del sitio | ✅ | HSTS, CSP, `X-Frame-Options` y `nosniff` activos en producción. Sin claves secretas en el código publicado. |
| Base de datos | ✅ | 23 migraciones aplicadas y RLS en todas las tablas. 168 chequeos de permisos pasan. Hay 15 MB de base y 3,3 MB de archivos: muy lejos de los topes del plan Pro. |
| Tareas automáticas | ✅ | `limpiar-eventos-vencidos` (06:00) y `encolar-avisos-capsula` (12:00) corrieron hoy, sin fallas en 7 días. Los llamados internos tampoco dieron errores. |
| Logs | ✅ | Ni la base ni las funciones registraron errores en las últimas 24 h. |
| Pagos (Mercado Pago) | ✅ con un detalle | Producción verificada con un pago real (operación 188828132998). La firma del webhook **está configurada y validando**. Detalle: Mercado Pago manda cada aviso en 2 formatos. El nuevo (firmado) se procesa; el viejo (`?id=…&topic=payment`) recibe 401 y Mercado Pago lo reintenta. No afecta los cobros. |
| Código | ✅ | La app compila sin errores. Quedan 2 avisos moderados de `react-router-dom` que solo afectan al render en servidor, que acá no se usa. |
| App sin conexión | ✅ | El service worker busca primero la versión nueva y, sin wifi, abre la guardada. Nunca guarda datos de Supabase. |
| Mail de contacto | ⚠️ | `skystudio.ar` recibe mails por Cloudflare Email Routing. No puedo comprobar que exista la regla para **eventos@skystudio.ar**, que es el mail del botón de arrepentimiento y de los legales. |
| Legales | ⚠️ | Términos, privacidad y botón de arrepentimiento (Ley 24.240) publicados. Todavía son **borrador**: faltan razón social, CUIT y domicilio. |

## Antes de lanzar (lo hacés vos)

1. **Supabase → Authentication → Rate Limits → "Rate limit for anonymous users" = 1000.** *Bloqueante*: con el valor de fábrica (30 por hora por IP), en un salón con wifi compartido no entran más de 30 invitados. No puedo leer ese valor desde acá: confirmalo o mandame captura.
2. **Authentication → Attack Protection → "Prevent use of leaked passwords"**. Sigue apagado, según el aviso de seguridad de hoy.
3. **Mandá un mail de prueba a eventos@skystudio.ar** y fijate que te llegue. Si no llega, creá la regla en Cloudflare → skystudio.ar → Email → Email Routing.

## Primeras semanas

4. **Legales:** completar razón social, CUIT y domicilio en `src/pages/publico/Legal.tsx` (me los pasás y los cargo), y que los revise un abogado. Consultá con tu contador:
   - si necesitás el **QR de Data Fiscal** de ARCA en el sitio;
   - si hay que **registrar la base de datos** en la AAIP (Ley 25.326).
5. **2FA para tu cuenta de admin:** Authentication → Multi-Factor.
6. **Prueba real con 5 a 10 celulares** en un evento chico: entrar con el QR, subir, ver en la pantalla. Si es posible, una prueba de carga antes del primer evento Premium grande (ver "Capacidad").
7. **Webhook de Mercado Pago:** que el aviso en formato viejo responda "ignorado" en vez de 401, así Mercado Pago deja de reintentarlo. Es un cambio chico en `mp-webhook`, que yo hago con tu OK.
8. **Datos de prueba:** quedan 8 regalos pendientes, 1 pedido y 1 evento sin pagar, y los eventos de prueba (Q4UH3D y otros). No molestan a los clientes, pero ensucian las cifras del admin. Se pueden limpiar.

## Capacidad (a tener en cuenta)

- **Tiempo real:** cada invitado mantiene 1 conexión en vivo. El plan Pro de Supabase incluye **500 conexiones simultáneas** para todo el proyecto. Alcanza para un evento Fiesta (250 invitados), y para dos a la vez llega justo. Un Premium grande (sin tope de invitados) o varios eventos el mismo sábado pueden llegar al límite. Se sube desde Supabase → Settings → Billing, pero el tope de gasto activo lo impide: revisalo antes de un evento grande.
- **Copias de seguridad:** la base tiene backup diario (Pro, 7 días). **Las fotos no tienen copia.** Si se borra el bucket, se pierden.
- **Olvidé mi contraseña:** no hay recuperación automática por mail. La cambia el admin desde /admin. Al principio alcanza, pero conviene tenerlo claro para atender clientes.

## Cómo volver a verificar

```bash
npm run test:db
```

```bash
npm run build
```

- Supabase → Advisors → Security: tiene que desaparecer "Leaked Password Protection Disabled".
- Cuando entre el próximo pago real: Edge Functions → mp-webhook → Logs, revisar que no haya 401 (después del paso 7).
