import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Contencion } from "./components/Contencion";
import "./index.css";
import { registrarServiceWorker } from "./lib/pwa";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Contencion>
        <App />
      </Contencion>
    </BrowserRouter>
  </React.StrictMode>,
);

registrarServiceWorker();
