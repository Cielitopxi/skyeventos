/**
 * ¿La web corre dentro de la app de Google Play (Trusted Web Activity)?
 *
 * Play exige su propia facturación para vender servicios digitales dentro de la app, así que ahí no se muestra
 * nada para contratar ni regalar: eso queda en la web y en la PWA instalada desde el navegador, que no cambian.
 *
 * La TWA se reconoce porque abre con referrer `android-app://<paquete>` o con `?app=play` (Start URL del paquete).
 * Se recuerda en sessionStorage (dura lo que la pestaña de la app) y no en localStorage, porque la TWA comparte
 * el almacenamiento con Chrome: si se guardara para siempre, también se ocultaría al entrar desde el navegador.
 */
const CLAVE = "app-play";

function detectar(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(CLAVE) === "1") return true;
  } catch {
    /* sin almacenamiento */
  }
  const play = document.referrer.startsWith("android-app://") || new URLSearchParams(location.search).get("app") === "play";
  if (play) {
    try {
      sessionStorage.setItem(CLAVE, "1");
    } catch {
      /* sin almacenamiento */
    }
  }
  return play;
}

export const esAppPlay = detectar();
