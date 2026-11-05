import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { esAppPlay } from "./lib/appPlay";
import { supabaseConfigurado } from "./lib/supabase";
import { RequiereLogin } from "./components/RequiereLogin";
import { Cargando } from "./components/ui";

// Cada sección se descarga recién cuando se abre: el invitado que escanea el QR no baja el panel ni el admin.
const Inicio = lazy(() => import("./pages/publico/Inicio"));
const Contratar = lazy(() => import("./pages/publico/Contratar"));
const Demo = lazy(() => import("./pages/publico/Demo"));
const Ingresar = lazy(() => import("./pages/publico/Ingresar"));
const Login = lazy(() => import("./pages/publico/Login"));
const ResultadoPago = lazy(() => import("./pages/publico/ResultadoPago"));
const Clip = lazy(() => import("./pages/publico/Clip"));
const Regalar = lazy(() => import("./pages/publico/Regalar"));
const Baja = lazy(() => import("./pages/publico/Baja"));
const LibroPublico = lazy(() => import("./pages/libro/LibroPublico"));
const MisEventos = lazy(() => import("./pages/panel/MisEventos"));
const EventoPanel = lazy(() => import("./pages/panel/EventoPanel"));
const EventoInvitado = lazy(() => import("./pages/invitado/EventoInvitado"));
const Pantalla = lazy(() => import("./pages/pantalla/Pantalla"));
const Fotolibro = lazy(() => import("./pages/libro/Fotolibro"));
const Admin = lazy(() => import("./pages/admin/Admin"));

export default function App() {
  return (
    <>
      {!supabaseConfigurado && (
        <div className="no-imprimir bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Falta configurar Supabase: copiá <code>.env.example</code> a <code>.env</code> y completá la clave.
        </div>
      )}
      <Suspense fallback={<Cargando />}>
        <Routes>
          {/* En la app de Google Play no se vende: la portada es la entrada con código y no hay contratar ni regalar. */}
          <Route path="/" element={esAppPlay ? <Ingresar /> : <Inicio />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/contratar" element={esAppPlay ? <Navigate to="/panel" replace /> : <RequiereLogin><Contratar /></RequiereLogin>} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/pago" element={<ResultadoPago />} />
          <Route path="/panel" element={<RequiereLogin><MisEventos /></RequiereLogin>} />
          <Route path="/panel/:id" element={<RequiereLogin><EventoPanel /></RequiereLogin>} />
          <Route path="/panel/:id/libro" element={<RequiereLogin><Fotolibro /></RequiereLogin>} />
          <Route path="/admin" element={<RequiereLogin><Admin /></RequiereLogin>} />
          <Route path="/c/:id" element={<Clip />} />
          <Route path="/regalar" element={esAppPlay ? <Navigate to="/" replace /> : <Regalar />} />
          <Route path="/baja" element={<Baja />} />
          <Route path="/libro/:token" element={<LibroPublico />} />
          <Route path="/e" element={<Ingresar />} />
          <Route path="/e/:codigo" element={<EventoInvitado />} />
          <Route path="/pantalla/:codigo" element={<Pantalla />} />
          <Route path="*" element={<Ingresar />} />
        </Routes>
      </Suspense>
    </>
  );
}
