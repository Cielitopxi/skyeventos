# Reel de lanzamiento — SkyEventos

**Formato:** vertical 9:16 · 20 segundos · 6 escenas · para Instagram Reels y TikTok.
**Idea central:** "Todos sacan fotos en tu fiesta. Con SkyEventos, te quedan todas."
**Público:** novias y novios, familias de quinceañeras, organizadores de cumpleaños y eventos corporativos.

---

## Cómo armarlo

1. Generá cada escena en Higgsfield con su prompt (modelo y ajustes indicados en cada una).
2. **Los textos en pantalla agregalos después** en CapCut o en el editor de Instagram: los modelos de video escriben mal las letras, por eso los prompts piden "sin texto".
3. **Música:** elegila de la biblioteca de Instagram o TikTok (algo alegre y luminoso, tipo pop acústico o house suave). Generá las escenas **sin audio** (`generate_audio: false` / `sound: off`) para que no choquen con la música.
4. Cortes rápidos, al ritmo de la música. Primera escena lo más llamativa posible: se decide en 1 segundo si la gente sigue mirando.

**Ajustes generales (Seedance 2.0):** relación 9:16 · 1080p · modo `std` (o `fast` a 720p si querés gastar menos créditos) · sin audio.

---

## Capturas reales de la app

En [`capturas/`](capturas/), sacadas del evento de demostración (sin datos de clientes):

| Archivo | Qué muestra | Tamaño | Para qué escena |
|---|---|---|---|
| `celular-ingreso.png` | La entrada del invitado: "Sofía & Martín", nombre y email, "Entrar al evento" | 1170×2532 (vertical) | Escena 2: lo que ve la invitada al escanear el QR |
| `celular-galeria.png` | Celular con la galería del evento, pestañas Fotos / Juegos / Ranking y "Subir fotos" | vertical, fondo transparente | Escenas 2 y 4, o para apoyar en el cierre |
| `pantalla-novios.jpg` | La pantalla del salón mostrando una foto de los novios tipo polaroid, con el QR y el código del evento | 1920×1080 | Escena 3: la pantalla gigante |
| `pantalla-mesa.png` | La pantalla del salón con una foto de la mesa con velas | 1920×1080 | Escena 3 (alternativa) |
| `celular-trivia.png` | Trivia de los novios: "¿Dónde se conocieron Sofía y Martín?" con 4 opciones | 1170×2532 | Escena 4 |
| `celular-misiones.png` | Misiones con puntos: selfie con alguien nuevo, paso de baile, tres generaciones, brindis | 1170×2532 | Escena 4 |
| `celular-bingo.png` | Cartón de bingo de momentos (brindis, abrazo, la torta, la pista llena…) | 1170×2532 | Escena 4 |
| `celular-ranking.png` | Ranking con premio ("Un abrazo de los novios") y los 4 primeros puestos con medallas | 1170×1479 (recorte) | Escena 4 |

**Cómo usarlas en Higgsfield:** en Seedance 2.0, subí la captura como `start_image` (la escena arranca desde esa imagen) o como `image_references` (el modelo la toma de referencia). Para las pantallas, conviene `image_references` y pedir en el prompt "la pantalla del salón muestra esta imagen".

**También sirven tal cual:** en CapCut, poné `celular-galeria.png` encima de un video de fiesta (como si alguien lo tuviera en la mano), o hacé un zoom lento sobre `pantalla-novios.jpg`. Es la forma más fiel de mostrar el producto.

> Para el reel, en la escena 4 conviene pasar rápido trivia → bingo → ranking (1 segundo cada una), como si alguien deslizara por la app.

---

## Guion

| # | Tiempo | Qué se ve | Texto en pantalla |
|---|---|---|---|
| 1 | 0–3 s | Pista de una boda: todos los invitados levantan el celular y sacan fotos al mismo tiempo. | **¿Dónde terminan todas las fotos de tu fiesta?** |
| 2 | 3–6 s | Primer plano: una invitada escanea una tarjeta con código QR sobre la mesa decorada. | **Tus invitados entran con el código del evento. Sin descargar nada.** |
| 3 | 6–10 s | La foto que sacó aparece en la pantalla gigante del salón; la mesa festeja. | **Las fotos aparecen en vivo en la pantalla del salón** |
| 4 | 10–13 s | Dos invitados se ríen mirando el celular: trivia de los novios y ranking. | **Trivia, misiones y ranking para animar la fiesta** |
| 5 | 13–17 s | Al día siguiente: la pareja en el sillón mira el fotolibro en una tablet, emocionada. | **Al otro día, todas las fotos en un solo lugar** |
| 6 | 17–20 s | Cierre de marca: fondo azul noche con destellos dorados (acá va tu logo). | **SkyEventos · eventos.skystudio.ar · Bodas, 15, cumpleaños y empresas** |

**Texto para la publicación (copy):**

> ¿Cuántas fotos de tu fiesta nunca llegaste a ver? 📸
> Con SkyEventos tus invitados suben sus fotos desde el celular con el código del evento —sin apps— y aparecen en vivo en la pantalla del salón. Además: trivia, misiones y ranking, y al otro día todas las fotos en un fotolibro.
> 💍 Bodas · 🎉 15 años · 🎂 Cumpleaños · 🏢 Eventos corporativos
> También lo podés regalar 🎁
> 👉 eventos.skystudio.ar

**Hashtags:** #bodas2027 #casamiento #quinceañera #fiesta15 #fotosdeboda #eventosargentina #organizaciondeeventos #wedding #skyeventos

---

## Prompts para Higgsfield

### Escena 1 — El gancho (Seedance 2.0 · 4 s)

```
Plano general de una fiesta de casamiento elegante de noche en un salón argentino, luces cálidas doradas y guirnaldas de luces. En el centro de la pista, decenas de invitados bien vestidos levantan sus celulares al mismo tiempo para sacar fotos de los novios que bailan. Destellos de flashes de los celulares. Cámara que se eleva lentamente desde la altura de los invitados hacia arriba. Estética cinematográfica, colores cálidos, profundidad de campo baja, ambiente festivo y emotivo. Sin texto en pantalla, sin logos.
```

### Escena 2 — El código QR (Seedance 2.0 · 4 s)

```
Primer plano sobre una mesa de fiesta decorada con flores blancas, velas y copas. Una tarjeta elegante color marfil con detalles dorados y un código QR está apoyada junto a un centro de mesa. Una mano de mujer con uñas pintadas acerca un celular y escanea el código; la pantalla del celular se ilumina. Fondo desenfocado con invitados conversando y luces cálidas. Movimiento de cámara suave hacia adelante. Estética cinematográfica, tonos marfil, dorado y azul noche. Sin texto legible, sin logos.
```

### Escena 3 — La pantalla del salón (Seedance 2.0 · 5 s)

```
Interior de un salón de fiestas de noche. En la pared hay una pantalla gigante que muestra un mosaico de fotos de los invitados de la fiesta, y una foto nueva de un grupo de amigos sonriendo aparece en grande con una animación suave. En primer plano, de espaldas y desenfocados, una mesa de amigos señala la pantalla, se ríe y aplaude al verse. Luces cálidas, destellos dorados, ambiente de celebración. Cámara que se mueve lentamente de la mesa hacia la pantalla. Estética cinematográfica. Sin texto legible.
```

> **Truco:** para que la pantalla muestre la app real, sacá una captura de la pantalla del salón de un evento de prueba y usala como `start_image` o `image_reference`.

### Escena 4 — Los juegos (Seedance 2.0 · 4 s)

```
Plano medio de dos invitados jóvenes, un hombre y una mujer, bien vestidos en una fiesta de casamiento, sentados a la mesa mirando juntos la pantalla de un celular. Se ríen a carcajadas y uno festeja levantando el puño como si hubiera ganado un juego. Fondo con luces de fiesta desenfocadas y gente bailando. Iluminación cálida, cámara en mano suave, estética de video de casamiento moderno. Sin texto en pantalla.
```

### Escena 5 — El día después (Seedance 2.0 · 5 s)

```
Mañana luminosa en un living moderno y cálido. Una pareja recién casada, relajada, en pijama y con tazas de café, sentada en el sillón mirando juntos fotos de su fiesta en una tablet. Ella desliza las fotos, él la abraza, los dos sonríen emocionados. Luz natural suave que entra por la ventana, plantas, tonos marfil y beige. Cámara que se acerca lentamente. Estética cinematográfica íntima. Sin texto en pantalla.
```

### Escena 6 — Cierre de marca (Seedance 2.0 · 3 s)

```
Fondo abstracto azul noche muy oscuro con partículas doradas brillantes que flotan y se juntan suavemente en el centro, como confeti de luz, dejando un espacio vacío en el medio para colocar un logo. Destellos suaves, movimiento lento y elegante, estética premium y minimalista. Sin texto, sin letras, sin logos.
```

> Sobre este fondo poné el logo de SkyEventos y la dirección **eventos.skystudio.ar** en el editor.

---

## Alternativa en una sola pieza: Marketing Studio

Si preferís un anuncio armado de una vez (12–15 s, estilo UGC, con una persona que habla a cámara), usá **Marketing Studio** con formato vertical 9:16:

```
Anuncio para redes sociales de SkyEventos, un servicio argentino para fiestas: los invitados escanean un código QR con el celular, suben sus fotos sin descargar ninguna app, las fotos aparecen en vivo en la pantalla del salón, juegan trivia y ranking, y al día siguiente los anfitriones tienen todas las fotos en un fotolibro digital. Una novia joven y feliz cuenta a cámara, en español rioplatense y con tono cercano: "En mi casamiento todos sacaron fotos… y gracias a SkyEventos las tengo todas, y encima salían en vivo en la pantalla". Escenas de fiesta de casamiento de noche, luces cálidas y doradas. Cierre con invitación a entrar a eventos.skystudio.ar.
```

---

## Para la próxima

- **Reel para quinceañeras:** mismo guion, con una fiesta de 15 (vestido, vals, amigas) y el texto "Tu fiesta de 15, todas las fotos de tus amigas".
- **Reel de regalo:** "¿No sabés qué regalarles a los novios?" → tarjeta de regalo de SkyEventos.
