import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "../../components/ui";

/**
 * Política de privacidad y términos y condiciones.
 * BORRADOR para revisar con un abogado: completar RESPONSABLE con la razón social, el CUIT y el domicilio.
 */
const RESPONSABLE = {
  nombre: "SkyStudio",
  sitio: "skystudio.ar",
  email: "eventos@skystudio.ar",
};
const ACTUALIZADO = "6 de noviembre de 2026";

function Pagina({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  // Los links como /terminos#arrepentimiento llevan directo a la sección.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash, titulo]);
  return (
    <div className="min-h-screen bg-marfil text-noche">
      <header className="border-b border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo />
          <nav className="flex gap-4 text-sm">
            <Link to="/privacidad" className="text-slate-600 hover:text-noche">Privacidad</Link>
            <Link to="/terminos" className="text-slate-600 hover:text-noche">Términos</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-4xl leading-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {ACTUALIZADO}</p>
        <div className="legal mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">{children}</div>
      </main>
    </div>
  );
}

function Seccion({ t, id, children }: { t: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-xl text-noche">{t}</h2>
      {children}
    </section>
  );
}

const Lista = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">
    {items.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ul>
);

const Mail = () => (
  <a href={`mailto:${RESPONSABLE.email}`} className="font-medium text-noche underline decoration-oro/60 underline-offset-4">
    {RESPONSABLE.email}
  </a>
);

export function Privacidad() {
  return (
    <Pagina titulo="Política de privacidad">
      <p>
        SkyEventos es un servicio de {RESPONSABLE.nombre} ({RESPONSABLE.sitio}). Acá explicamos qué datos personales juntamos, para qué los usamos, con quién
        los compartimos y cómo podés ejercer tus derechos, de acuerdo con la Ley 25.326 de Protección de Datos Personales.
      </p>

      <Seccion t="1. Quién es responsable de tus datos">
        <p>
          El responsable de la base de datos es {RESPONSABLE.nombre}. Para cualquier consulta sobre tus datos escribinos a <Mail />.
        </p>
      </Seccion>

      <Seccion t="2. Qué datos juntamos">
        <p><b>Si sos anfitrión</b> (quien contrata un evento):</p>
        <Lista items={["Email y contraseña (la contraseña se guarda cifrada; nadie puede leerla).", "Los datos del evento: nombre, tipo, fecha, horario, temática y lo que personalices.", "Los pagos: plan, monto, código de descuento y el número de operación de Mercado Pago. No vemos ni guardamos los datos de tu tarjeta."]} />
        <p><b>Si sos invitado</b>:</p>
        <Lista items={["Tu nombre, tu email y, si la cargás, tu mesa.", "Las fotos, videos cortos y mensajes que subís, y tus respuestas en los juegos (misiones, bingo, trivia y votaciones).", "Si aceptás o no recibir novedades y promociones, con la fecha."]} />
        <p>
          Para que entres sin crear una cuenta usamos una sesión anónima que se guarda en tu navegador. No usamos herramientas de publicidad ni de
          seguimiento de terceros.
        </p>
      </Seccion>

      <Seccion t="3. Para qué los usamos">
        <Lista
          items={[
            "Para que el evento funcione: mostrar las fotos y mensajes en la pantalla del salón y en la galería, armar el ranking y el fotolibro.",
            "Para que los anfitriones sepan quién participó: reciben el nombre y el email de sus invitados.",
            "Para cobrar y activar los eventos contratados.",
            "Para mandarte novedades y promociones de SkyEventos, solo si lo aceptaste. Cada envío incluye cómo darte de baja.",
            "Para prevenir abusos y mantener el servicio seguro.",
          ]}
        />
      </Seccion>

      <Seccion t="4. Quién más los ve">
        <Lista
          items={[
            "Los anfitriones del evento y, en la pantalla del salón y en el fotolibro, los demás invitados. Los anfitriones pueden ocultar o borrar contenido.",
            "Si el anfitrión comparte el fotolibro, lo puede ver cualquiera que tenga el link.",
            "Proveedores que necesitamos para prestar el servicio: Supabase (base de datos y archivos), Cloudflare (publicación del sitio) y Mercado Pago (cobros). Sus servidores pueden estar fuera de Argentina; trabajan con estándares de seguridad equivalentes.",
            "Autoridades, solo si una ley o una orden judicial nos lo exige.",
          ]}
        />
        <p>No vendemos tus datos.</p>
      </Seccion>

      <Seccion t="5. Cuánto tiempo los guardamos">
        <p>
          Las fotos, mensajes y datos de cada evento se guardan durante el período que incluye el plan contratado (entre 90 y 365 días desde el evento) y
          después se borran automáticamente. Los datos de pago se conservan el tiempo que exigen las normas fiscales. Si aceptaste recibir novedades,
          guardamos tu email hasta que te des de baja.
        </p>
      </Seccion>

      <Seccion t="6. Tus derechos">
        <p>
          Podés pedir acceder a tus datos, corregirlos o borrarlos escribiendo a <Mail /> desde el email con el que te registraste. El acceso es gratuito
          cada seis meses, salvo que acredites un interés legítimo para pedirlo antes. Para dejar de recibir publicidad entrá a{" "}
          <Link to="/baja" className="font-medium text-noche underline decoration-oro/60 underline-offset-4">eventos.skystudio.ar/baja</Link>.
        </p>
        <p className="rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200">
          La Agencia de Acceso a la Información Pública, como órgano de control de la Ley 25.326, atiende las denuncias y reclamos de quienes consideren
          afectados sus derechos sobre datos personales.
        </p>
      </Seccion>

      <Seccion t="7. Menores de edad">
        <p>
          En eventos familiares es habitual que aparezcan menores en las fotos. Quien las sube declara contar con el permiso de sus padres o
          responsables, y los anfitriones pueden quitar cualquier foto. Si sos madre, padre o tutor y querés que borremos una imagen, escribinos a <Mail />.
        </p>
      </Seccion>

      <Seccion t="8. Seguridad">
        <p>
          Las fotos se guardan en un almacenamiento privado: solo las ven los participantes del evento, salvo que el anfitrión comparta el fotolibro. Las
          conexiones viajan cifradas.
        </p>
      </Seccion>

      <Seccion t="9. Cambios">
        <p>Si cambiamos esta política, publicamos la nueva versión acá con su fecha. Si el cambio es importante, lo avisamos en el sitio.</p>
      </Seccion>
    </Pagina>
  );
}

export function Terminos() {
  return (
    <Pagina titulo="Términos y condiciones">
      <p>
        Estos términos rigen el uso de SkyEventos, un servicio de {RESPONSABLE.nombre} ({RESPONSABLE.sitio}). Al contratar un evento, al ingresar como
        invitado o al usar el sitio, los aceptás. Tu información personal se trata según la{" "}
        <Link to="/privacidad" className="font-medium text-noche underline decoration-oro/60 underline-offset-4">política de privacidad</Link>.
      </p>

      <Seccion t="1. El servicio">
        <p>
          SkyEventos permite que los invitados de un evento suban fotos y mensajes desde su celular, que se proyecten en una pantalla, que participen de
          juegos y que el anfitrión arme un fotolibro. Las funciones disponibles dependen del plan contratado.
        </p>
      </Seccion>

      <Seccion t="2. Contratación y pago">
        <Lista
          items={[
            "Cada plan se paga una sola vez por evento, por Mercado Pago. Los precios están en pesos argentinos e incluyen impuestos.",
            "El evento se activa cuando Mercado Pago acredita el pago.",
            "Los invitados pueden participar desde unas horas antes del horario contratado hasta 24 horas después de que termina, según lo que se informa al contratar.",
            "Los códigos de descuento y las tarjetas de regalo son de un solo uso y no se pueden canjear por dinero.",
          ]}
        />
      </Seccion>

      <Seccion t="3. Botón de arrepentimiento y devoluciones" id="arrepentimiento">
        <p>
          Podés arrepentirte de la contratación dentro de los 10 días corridos desde el pago, sin dar explicaciones, como establece el artículo 34 de la
          Ley 24.240 de Defensa del Consumidor, escribiendo a <Mail />. Te devolvemos el importe por el mismo medio de pago. Si el evento ya se realizó, el
          servicio se considera prestado.
        </p>
        <a
          href={`mailto:${RESPONSABLE.email}?subject=${encodeURIComponent("Botón de arrepentimiento")}&body=${encodeURIComponent("Quiero revocar la contratación.\nEmail de mi cuenta: \nCódigo o nombre del evento: \nFecha del pago: ")}`}
          className="btn-primario inline-flex"
        >
          Me arrepiento de la compra
        </a>
      </Seccion>

      <Seccion t="4. Contenido de los invitados">
        <Lista
          items={[
            "Cada persona es responsable de lo que sube. No se permite contenido ilegal, violento, sexual, discriminatorio, que muestre a alguien sin su consentimiento cuando corresponda pedirlo, ni que infrinja derechos de terceros.",
            "Quien sube una foto o un mensaje autoriza a que se muestre en la pantalla del evento, en la galería y en el fotolibro de ese evento. Las fotos siguen siendo de quien las sacó.",
            "Los anfitriones moderan el contenido de su evento y pueden ocultarlo, borrarlo o bloquear a un invitado. Nosotros también podemos quitar contenido que viole estos términos.",
          ]}
        />
      </Seccion>

      <Seccion t="5. Responsabilidades del anfitrión">
        <p>
          El anfitrión es responsable de compartir el código del evento solo con sus invitados, de moderar el contenido y de usar los datos de contacto
          de los invitados solo para fines relacionados con el evento.
        </p>
      </Seccion>

      <Seccion t="6. Disponibilidad">
        <p>
          Trabajamos para que el servicio funcione sin cortes, pero depende de internet, del wifi o los datos móviles del salón y de proveedores externos.
          No respondemos por fallas ajenas a nuestro control. Las fotos se borran al terminar el período de guardado del plan: descargalas antes.
        </p>
      </Seccion>

      <Seccion t="7. Cuentas">
        <p>
          Cada anfitrión es responsable de cuidar su contraseña. Podemos suspender cuentas que hagan un uso abusivo del servicio. Para cerrar tu cuenta y
          borrar tus datos escribinos a <Mail />.
        </p>
      </Seccion>

      <Seccion t="8. Cambios y ley aplicable">
        <p>
          Podemos actualizar estos términos; la versión vigente es la publicada acá con su fecha. Se rigen por las leyes de la República Argentina. Ante
          cualquier conflicto, primero escribinos: casi todo se resuelve hablando.
        </p>
      </Seccion>
    </Pagina>
  );
}
