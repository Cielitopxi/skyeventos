import { Route, Routes } from "react-router-dom";
import { supabaseConfigurado } from "./lib/supabase";
import Inicio from "./pages/publico/Inicio";
import Contratar from "./pages/publico/Contratar";
import Demo from "./pages/publico/Demo";
import Ingresar from "./pages/publico/Ingresar";
import Login from "./pages/publico/Login";
import ResultadoPago from "./pages/publico/ResultadoPago";
import MisEventos from "./pages/panel/MisEventos";
import EventoPanel from "./pages/panel/EventoPanel";
import EventoInvitado from "./pages/invitado/EventoInvitado";
import Pantalla from "./pages/pantalla/Pantalla";
import Fotolibro from "./pages/libro/Fotolibro";
import { RequiereLogin } from "./components/RequiereLogin";

export default function App() {
  return (
    <>
      {!supabaseConfigurado && (
        <div className="no-imprimir bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Falta configurar Supabase: copiá <code>.env.example</code> a <code>.env</code> y completá la clave.
        </div>
      )}
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/contratar" element={<RequiereLogin><Contratar /></RequiereLogin>} />
        <Route path="/ingresar" element={<Login />} />
        <Route path="/pago" element={<ResultadoPago />} />
        <Route path="/panel" element={<RequiereLogin><MisEventos /></RequiereLogin>} />
        <Route path="/panel/:id" element={<RequiereLogin><EventoPanel /></RequiereLogin>} />
        <Route path="/panel/:id/libro" element={<RequiereLogin><Fotolibro /></RequiereLogin>} />
        <Route path="/e" element={<Ingresar />} />
        <Route path="/e/:codigo" element={<EventoInvitado />} />
        <Route path="/pantalla/:codigo" element={<Pantalla />} />
        <Route path="*" element={<Ingresar />} />
      </Routes>
    </>
  );
}
