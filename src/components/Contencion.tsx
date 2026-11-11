import React from "react";

/**
 * Red de contención: si algo falla al dibujar, en vez de una pantalla en blanco se muestra un aviso
 * y la página se recarga sola. En la pantalla del salón nadie está cerca para tocar "reintentar".
 * Si vuelve a fallar enseguida, deja de recargar para no entrar en un bucle.
 */
const CLAVE = "contencion-ultima";

export class Contencion extends React.Component<{ children: React.ReactNode }, { fallo: boolean; reintenta: boolean }> {
  state = { fallo: false, reintenta: false };
  private temporizador?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Error de la aplicación", error, info);
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(CLAVE)) || 0;
      sessionStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      /* sin almacenamiento: se recarga igual, una vez */
    }
    if (Date.now() - ultima > 60_000) {
      this.setState({ reintenta: true });
      this.temporizador = setTimeout(() => window.location.reload(), 4000);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.temporizador);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1a242d] px-6 text-center text-white">
        <p className="text-2xl font-semibold">Algo no salió bien</p>
        <p className="max-w-sm text-white/70">
          {this.state.reintenta ? "Estamos volviendo a cargar la página…" : "Tocá el botón para volver a cargar. Tus fotos ya subidas están a salvo."}
        </p>
        <button className="rounded-full bg-white px-6 py-3 font-semibold text-[#1a242d]" onClick={() => window.location.reload()}>
          Volver a cargar
        </button>
      </div>
    );
  }
}
