# SkyEventos — Evaluación integral

**Fecha:** 11 de noviembre de 2026 · **Alcance:** seguridad, bugs, rendimiento, estética, dinámica y propuesta comercial.

## Cómo se hizo

- Analizadores de seguridad y rendimiento de Supabase sobre la base en producción.
- Revisión de políticas de acceso, funciones de pago, almacenamiento y tareas programadas.
- Auditoría de dependencias (`npm audit`) y compilación para medir el peso del sitio.
- Revisión del código en los puntos sensibles (registro, pagos, subida de archivos, pantalla).
- Recorrido de la app como invitado y de la pantalla del salón en la demo.

**Lo que no se probó:** celulares reales, un evento con muchos invitados a la vez (prueba de carga) y una lectura línea por línea de las ~9.600 líneas. Las conclusiones sobre capacidad son estimaciones.

## Veredicto

La base técnica es **sólida y está por encima de lo habitual** para un producto en esta etapa: los datos están bien aislados entre eventos, los pagos no se pueden falsificar y el sitio es liviano. Para venderlo como "el mejor servicio" faltan tres cosas: **cerrar 5 riesgos antes del primer evento pago**, **tener visibilidad de lo que pasa durante una fiesta** y **sumar los momentos "wow"** que hoy lo separan de la competencia.

| Área | Estado | Nota |
|---|---|---|
| Seguridad de datos | 🟢 Muy bien | Acceso por evento, archivos privados, pagos verificados |
| Seguridad de cuentas | 🟡 A mejorar | Registro sin verificación ni límite |
| Estabilidad en un evento real | 🟡 Sin probar | Hay un límite que puede bloquear el ingreso en el salón |
| Rendimiento | 🟢 Bien | 86 kB iniciales; carga rápida |
| Estética | 🟢 Bien | Identidad cuidada; falta movimiento y sorpresa |
| Dinámica del evento | 🟡 Correcta | Buenos juegos; faltan reacciones en vivo y momentos compartidos |
| Preparación comercial | 🟡 A mejorar | Sin testimonios, sin medición, sin canal de revendedores |

---

## 1. Seguridad

### Lo que está bien

- **Todas las tablas tienen control de acceso por fila.** Un invitado solo ve su evento; un anfitrión, solo los suyos.
- **Las fotos están en un almacenamiento privado**, con tope de 30 MB por archivo y solo formatos de imagen, video y audio.
- **Los pagos no se pueden falsificar.** El webhook valida la firma de Mercado Pago, consulta el pago a la API y compara moneda y monto. Activar un evento solo lo puede hacer el servidor o un administrador.
- **Un anfitrión no puede cambiarse el plan, el estado ni el vencimiento** de su evento: un disparador en la base lo impide.
- **No hay claves secretas en el repositorio** ni puntos de inyección de HTML en el código.
- Las tareas nocturnas (limpieza y avisos) corrieron sin fallas en los últimos 7 días.

Los ~80 avisos del analizador de Supabase son, casi todos, esperables: funciones que la app necesita exponer y que validan permisos por dentro, y políticas que alcanzan a los invitados porque entran con sesión anónima.

### Riesgos a corregir

| # | Riesgo | Gravedad | Qué puede pasar | Solución |
|---|---|---|---|---|
| S1 | **Límite de ingresos anónimos por IP** (30 por hora) | 🔴 Bloqueante | En el salón todos comparten el wifi, o sea la misma IP. Después de 30 invitados, el resto no puede entrar. | Subir el límite en Supabase → Authentication → Rate Limits (por ejemplo, a 1.000/h). 2 minutos. |
| S2 | **Registro de anfitriones sin verificación ni límite** | 🟠 Alta | Cualquiera puede crear una cuenta con el email de otra persona (y dejarla sin poder registrarse), o un bot puede crear miles. | Agregar un captcha invisible (Cloudflare Turnstile, gratis) y un límite por IP en la función `cuentas`. |
| S3 | **Dependencias con fallas conocidas** | 🟠 Alta | `react-router` (3 fallas graves) y la librería de autenticación de Supabase están desactualizadas. | Actualizar ambas. Cambio chico, se prueba en una hora. |
| S4 | **Recuperar contraseña depende de vos** | 🟡 Media | Alguien puede escribirte haciéndose pasar por un cliente para que le des acceso. Además no escala. | Recuperación por mail automática (requiere configurar el envío de mails, por ejemplo con Resend). |
| S5 | **Sin protección de contraseñas filtradas** | 🟡 Media | Se aceptan contraseñas que ya circulan en filtraciones. | Activarla en Supabase → Authentication → Passwords. Con el plan Pro ya está disponible. 1 clic. |
| S6 | **Un solo administrador, sin doble factor** | 🟡 Media | Si te roban la contraseña, tienen todos los eventos, contactos y pedidos. | Activar verificación en dos pasos para la cuenta admin. |
| S7 | **Faltan cabeceras de seguridad** (CSP y HSTS) | 🟡 Media | Menor defensa ante scripts inyectados o conexiones degradadas. | Agregarlas al archivo `_headers`. |
| S8 | **Moderación de contenido** | 🟡 Media | Con moderación "posterior", una foto inapropiada aparece en la pantalla gigante al instante. | Moderación previa por defecto en eventos corporativos, y botón de "pánico" para pausar la pantalla. |
| S9 | **Sin copia de las fotos** | 🟡 Media | El plan Pro respalda la base todos los días, pero no los archivos. | Asumirlo en los términos, o copia semanal a otro almacenamiento. |
| S10 | **Textos legales en borrador** | 🟡 Media | Faltan razón social, CUIT, domicilio y revisión de un abogado. | Ya anotado como pendiente. |

Menores: la extensión `pg_net` está en el esquema público (recomendación de Supabase), y el código de evento tiene 6 caracteres sin límite de intentos (el captcha de S2 ayuda).

---

## 2. Bugs y calidad

| # | Problema | Impacto | Solución |
|---|---|---|---|
| B1 | **La vista previa al compartir por WhatsApp sale sin imagen.** La etiqueta `og:image` usa una ruta relativa y el título es solo "SkyEventos". | Alto: WhatsApp es el canal principal de venta y de invitación. | Ruta absoluta, imagen de 1200×630 diseñada y título con propuesta de valor. |
| B2 | **Un error deja la pantalla en blanco.** No hay red de contención de errores. | Alto en la pantalla del salón: queda en blanco delante de todos. | Agregar un límite de errores que recargue solo. |
| B3 | **No hay monitoreo ni medición.** Si algo falla durante una fiesta, no te enterás. Tampoco sabés cuánta gente visita la portada o abandona al pagar. | Alto. | Sentry (errores) y una analítica liviana (Plausible o similar). |
| B4 | **El botón "Pagar" de Mis eventos no deja poner un código de descuento.** | Medio: se pierde el descuento si el cliente vuelve después. | Agregar el campo ahí. |
| B5 | **Sin pruebas automáticas de la interfaz.** Solo se prueba la base. | Medio: cada cambio puede romper algo sin aviso. | Una prueba de punta a punta del recorrido del invitado. |
| B6 | **El archivo del invitado tiene 1.214 líneas.** | Bajo hoy, creciente. | Dividirlo por pestaña. |
| B7 | **Capacidad sin verificar.** El plan Pro incluye 500 conexiones en vivo simultáneas. | Medio: un evento Premium "ilimitado" o dos eventos grandes la misma noche pueden pasarlo. | Prueba de carga con 200 invitados simulados antes de vender Premium. |
| B8 | **Tres familias tipográficas desde Google Fonts.** | Bajo: demora el primer render con mala señal. | Alojarlas en el propio sitio. |

Ya corregidos en estos días: el botón de regalar que quedaba gris sin explicación y la limpieza de datos de prueba en la demo.

---

## 3. Estética y dinámica

La identidad (azul noche, marfil, dorado, tipografías con serif) es coherente y elegante. Lo que falta es **movimiento, sonido y momentos compartidos**: hoy la app es correcta, pero no sorprende.

### Pantalla del salón (es la vidriera: la ven todos)

1. **Entrada de cada foto nueva con animación y nombre** ("📸 Valentina acaba de subir…").
2. **Reacciones en vivo:** los invitados tocan ❤️ 🔥 😂 en su celular y los emojis flotan por la pantalla.
3. **Modos de pantalla** que el anfitrión elige: polaroid, mosaico, muro de mensajes, ranking animado.
4. **Momentos guiados:** cuenta regresiva para la trivia en vivo, revelación del ganador con confeti, "la foto de la noche" por votos.
5. **Botón de pausa** para el vals, el video de los novios o una emergencia.

### Celular del invitado

1. **Menos fricción al entrar.** Hoy se pide nombre, email y aceptar términos antes de ver nada. Propuesta: entrar solo con el nombre y pedir el email después de la primera foto ("¿te mandamos tus fotos?"). Cada campo de más reduce la participación.
2. **Cámara dentro de la app con marcos de la temática** del evento (el marco con los nombres y la fecha).
3. **Me gusta en las fotos** de la galería, que suman al ranking.
4. **Festejo al cumplir una misión:** confeti, vibración y aviso en la pantalla del salón.
5. **Avisos** cuando se abre una trivia o una votación.

### Panel del anfitrión

1. **Plantillas por tipo de evento:** boda, 15 años, cumpleaños, corporativo, con trivia, misiones y bingo ya cargados para editar.
2. **Asistente de 3 pasos** al crear el evento, con vista previa en vivo.
3. **"Modo fiesta"** para el DJ o animador: una pantalla con botones grandes (lanzar trivia, revelar ganador, pausar pantalla).
4. **Informe después del evento:** cuántos participaron, fotos por hora, mesa ganadora.

### Después del evento (donde se genera el boca a boca)

1. **Video resumen automático** de 30 segundos con las mejores fotos y música, listo para Instagram.
2. **Mail a cada invitado con sus fotos** y un enlace al álbum: cada invitado es un posible cliente.
3. **Fotolibro impreso** como venta adicional, en alianza con una imprenta.

---

## 4. Para venderlo como el mejor servicio

| Qué | Por qué |
|---|---|
| **Testimonios y casos reales** en la portada (fotos de eventos hechos, con permiso) | Hoy la portada no tiene ninguna prueba social. |
| **Programa para salones, planners, fotógrafos y DJs** con código propio y comisión | Ellos venden por vos. El sistema de códigos ya existe. |
| **Marca blanca para salones** (su logo en la pantalla) | Venta recurrente a un solo cliente. |
| **Soporte por WhatsApp el día del evento** | Es lo que más tranquiliza a quien contrata. |
| **Garantía:** "si no funciona, te devolvemos la plata" | Baja el riesgo percibido. |
| **Plan de prueba gratis** (10 invitados, 20 fotos) | Deja probar con un evento chico antes de pagar. |
| **Preguntas frecuentes y comparación** con el fotógrafo tradicional y con otras apps | Responde las dudas antes del contacto. |
| **Kit imprimible** de carteles de mesa con el QR | Se ve profesional y aumenta la participación. |

---

## 5. Plan sugerido

### Antes del primer evento pago (1 a 3 días)

1. S1 — Subir el límite de ingresos anónimos. **Lo hacés vos, 2 minutos.**
2. S5 y S6 — Protección de contraseñas filtradas y doble factor. **Lo hacés vos, 5 minutos.**
3. S3 — Actualizar dependencias.
4. S2 — Captcha y límite en el registro.
5. B1 — Vista previa de WhatsApp.
6. B2 y B3 — Contención de errores y monitoreo.
7. S7 — Cabeceras de seguridad.
8. Prueba con 5 a 10 celulares reales en una reunión chica.

### Primer mes

- Reacciones en vivo y animación de foto nueva en la pantalla.
- Entrada con menos fricción.
- Plantillas por tipo de evento.
- Botón de pausa y moderación previa por defecto en corporativos.
- B4 (código al pagar) y B7 (prueba de carga).
- Testimonios y preguntas frecuentes en la portada.

### Después

- Video resumen automático y mail a los invitados.
- Modo fiesta para el animador.
- Programa de revendedores y marca blanca.
- Recuperación de contraseña por mail (S4).
- Fotolibro impreso.
