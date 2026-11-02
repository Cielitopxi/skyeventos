import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/** Usuario con email (anfitrión). Las sesiones anónimas de invitado no cuentan. */
export function useUsuario() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUsuario(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const conEmail = usuario && !usuario.is_anonymous ? usuario : null;
  return { usuario: conEmail, cargando };
}
