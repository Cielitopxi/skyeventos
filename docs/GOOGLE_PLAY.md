# Publicar SkyEventos en Google Play

La app de Play es la misma web (eventos.skystudio.ar) empaquetada como **Trusted Web Activity (TWA)**:
se abre a pantalla completa, sin barra del navegador, y cada deploy de la web actualiza la app sin pasar por la tienda.
Solo hay que subir una versión nueva a Play si cambia el ícono, el nombre o el paquete.

Lo que ya está listo en el repo:

- `public/manifest.webmanifest`: nombre, descripción, idioma, ícono maskable, atajos ("Tengo un código", "Mis eventos").
- `public/sw.js`: service worker (requisito de la TWA y para abrir sin señal).
- `public/.well-known/assetlinks.json`: vincula el dominio con la app. **Falta la huella** (paso 4).

## 1. Cuenta de desarrollador

1. Crear la cuenta en https://play.google.com/console (pago único de USD 25).
2. Conviene registrarla como **organización** (SkyStudio): las cuentas personales nuevas tienen que hacer una prueba cerrada
   con al menos 12 testers durante 14 días antes de poder publicar en producción. Revisá el requisito vigente en la consola.

## 2. Generar el paquete (PWABuilder, lo más simple)

1. Entrar a https://www.pwabuilder.com, poner `https://eventos.skystudio.ar` y tocar **Package for stores → Android**.
2. Opciones:
   - **Package ID**: `ar.skystudio.eventos` (si usás otro, cambialo también en `assetlinks.json`).
   - **App name**: SkyEventos · **Launcher name**: SkyEventos
   - **Start URL**: `/e?app=play` (arranca en el código de evento; el `?app=play` oculta contratar y regalar) · **Theme / background color**: `#1a242d`
   - **Signing key**: "Create new". Descargás un `.keystore` con su contraseña: **guardalo en un lugar seguro**
     (sin él no se pueden publicar actualizaciones del paquete). No lo subas al repositorio.
3. Descargás un zip con el `.aab` (para Play) y un `.apk` (para probar en un celular).

Alternativa por línea de comandos: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
(`npx @bubblewrap/cli init --manifest https://eventos.skystudio.ar/manifest.webmanifest`, luego `build`).

## 3. Subir a Play Console

1. Crear la app → idioma Español (Latinoamérica) → App → Gratis.
2. Completar la ficha: descripción, capturas de pantalla del celular (mínimo 2), ícono 512×512 (`public/icono-512.png`),
   gráfico destacado 1024×500, política de privacidad (URL pública, obligatoria porque la app usa cámara y fotos),
   clasificación de contenido, público objetivo y la sección "Seguridad de los datos" (fotos, nombre y email de usuarios).
3. **Pruebas → Prueba interna** → subir el `.aab`. Activar **Firma de apps de Play** (viene por defecto).

## 4. Vincular el dominio (para que no aparezca la barra del navegador)

1. En Play Console: **Configuración → Integridad de la app → Firma de apps** → copiar la **huella SHA-256 del certificado de firma de apps**.
2. Pegarla en `public/.well-known/assetlinks.json` en lugar de `REEMPLAZAR:...` (formato `AB:CD:...`).
   Si probás el `.apk` de PWABuilder fuera de Play, agregá también la huella de tu keystore (está en el zip, `assetlinks.json`).
3. Commit y push: Cloudflare publica el archivo en `https://eventos.skystudio.ar/.well-known/assetlinks.json`.
4. Verificar con https://developers.google.com/digital-asset-links/tools/generator.

## 5. Ojo con los pagos dentro de la app

Google Play exige su propio sistema de facturación para vender **bienes o servicios digitales** dentro de las apps,
y SkyEventos (planes y tarjetas de regalo) probablemente entre en esa categoría. Antes de publicar en producción, definí una de estas opciones:

- **App sin venta (elegida e implementada)**: la app de Play sirve para invitados y anfitriones (subir fotos, panel, pantalla, fotolibro),
  y la contratación se hace en la web. Dentro de la TWA (`src/lib/appPlay.ts`: referrer `android-app://` o `?app=play`):
  - la portada es la entrada con código de evento, sin landing ni precios;
  - `/contratar` y `/regalar` redirigen, y no hay botones de "Nuevo evento" ni "Pagar";
  - en `/ingresar` solo se ingresa: no se crean cuentas (Play pediría también poder borrarlas desde la app).
  La web y la PWA instalada desde el navegador siguen igual, con contratar y regalar.
- **Facturación alternativa / de elección del usuario**: Google la habilita en algunos países con comisión reducida; revisá si aplica a Argentina.
- **Play Billing**: integrar la Digital Goods API en la TWA (más trabajo y comisión de Google).

Revisá la política vigente: https://support.google.com/googleplay/android-developer/answer/9858738
