import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUsuario } from "./useUsuario";
import { Cargando } from "./ui";

export function RequiereLogin({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useUsuario();
  const loc = useLocation();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to={`/ingresar?volver=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}
