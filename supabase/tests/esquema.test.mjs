import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";

const db = new PGlite({ extensions: { pgcrypto } });
const migraciones = process.argv.slice(2).map((f) => fs.readFileSync(f, "utf8"));

// Simulación mínima de Supabase
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, is_anonymous boolean default false, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('t.role', true), ''), 'authenticated') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous', coalesce(nullif(current_setting('t.anon', true), ''), 'false')::boolean) $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage to authenticated, anon;
`);
for (const sql of migraciones) await db.exec(sql);
await db.exec(`grant all on all tables in schema public to authenticated, anon; grant all on storage.objects to authenticated;`);
console.log("✓ migraciones aplicadas:", migraciones.length);

const host = "11111111-1111-1111-1111-111111111111";
const g1 = "22222222-2222-2222-2222-222222222222";
const g2 = "33333333-3333-3333-3333-333333333333";
const intruso = "44444444-4444-4444-4444-444444444444";
await db.exec(`insert into auth.users values ('${host}','a@a.com',false),('${g1}',null,true),('${g2}',null,true),('${intruso}',null,true)`);

const como = async (uid, anon, q, rol = "authenticated") => {
  await db.exec(`reset role; select set_config('t.uid','${uid}',false), set_config('t.anon','${anon}',false), set_config('t.role','${rol}',false); ${rol === "service_role" ? "" : "set role authenticated;"}`);
  try { return await db.query(q); } finally { await db.exec("reset role"); }
};
const espera_error = async (p, txt) => {
  try { await p; console.log("✗ debía fallar:", txt); process.exitCode = 1; } catch (e) { console.log("✓ rechazado:", txt, "→", e.message.split("\n")[0]); }
};

// Contratación
await espera_error(como(g1, true, `select crear_evento('X','boda','elegante','fiesta',null)`), "invitado anónimo no puede contratar");
const ev = (await como(host, false, `select * from crear_evento('Ana & Juan','boda','romantico','basico','2026-12-12')`)).rows[0];
console.log("✓ evento creado, código", ev.codigo, "estado", ev.estado);
await espera_error(como(g1, true, `select unirse_evento('${ev.codigo}','Pepe')`), "no se entra a un evento sin pagar");
await espera_error(como(host, false, `select activar_evento('${ev.id}')`), "el dueño no puede activarlo sin pago");
await como(host, false, `select activar_evento('${ev.id}', 'pago-123')`, "service_role");
console.log("✓ activado por webhook:", (await db.query(`select estado, expira_at from eventos`)).rows[0]);

// Invitados
const i1 = (await como(g1, true, `select * from unirse_evento('${ev.codigo.toLowerCase()}','Pepe','3')`)).rows[0];
const i2 = (await como(g2, true, `select * from unirse_evento('${ev.codigo}','Lola')`)).rows[0];
console.log("✓ invitados unidos:", i1.nombre, i2.nombre);
console.log("✓ evento_por_codigo (anon):", (await como(g1, true, `select nombre, abierto, premios_activos from evento_por_codigo('${ev.codigo}')`)).rows[0]);
console.log("✓ invitado NO ve la tabla eventos (token oculto):", (await como(g1, true, `select count(*)::int n from eventos`)).rows[0].n === 0);

// Misiones y fotos
const mis = (await como(host, false, `insert into misiones (evento_id,titulo,puntos) values ('${ev.id}','Selfie con los novios',20) returning id`)).rows[0];
const mod = (await como(host, false, `insert into misiones (evento_id,titulo,puntos,validacion) values ('${ev.id}','Brindis',10,'moderador') returning id`)).rows[0];
const foto = (eid, iid, extra = "null") => `insert into fotos (evento_id,invitado_id,storage_path,thumb_path,mision_id) values ('${eid}','${iid}','${eid}/${iid}/a.jpg','${eid}/${iid}/a_t.jpg',${extra}) returning estado, mision_estado`;
console.log("✓ foto con misión automática:", (await como(g1, true, foto(ev.id, i1.id, `'${mis.id}'`))).rows[0]);
console.log("✓ foto con misión a moderar:", (await como(g1, true, foto(ev.id, i1.id, `'${mod.id}'`))).rows[0]);
await como(g2, true, foto(ev.id, i2.id));
await espera_error(como(g2, true, foto(ev.id, i1.id)), "subir foto a nombre de otro invitado");
await espera_error(como(intruso, true, foto(ev.id, i1.id)), "intruso sin unirse no sube fotos");
console.log("✓ intruso ve fotos:", (await como(intruso, true, `select count(*)::int n from fotos`)).rows[0].n, "(debe ser 0)");
await como(g1, true, `insert into mensajes (evento_id,invitado_id,texto) values ('${ev.id}','${i1.id}','¡Felicidades!')`);

// Moderación previa
await como(host, false, `update eventos set moderacion='previa', estado='archivado' where id='${ev.id}'`);
console.log("✓ el dueño cambia moderación pero no el estado:", (await db.query(`select moderacion, estado from eventos`)).rows[0]);
console.log("✓ con moderación previa la foto queda:", (await como(g2, true, foto(ev.id, i2.id))).rows[0].estado);
console.log("✓ Pepe ve fotos (aprobadas + propias):", (await como(g1, true, `select count(*)::int n from fotos`)).rows[0].n, "de", (await db.query(`select count(*)::int n from fotos`)).rows[0].n);

// Ranking
console.log("✓ ranking:", (await como(g1, true, `select nombre, puntos::int, fotos::int, misiones::int from ranking('${ev.id}')`)).rows);
await como(host, false, `update fotos set mision_estado='aprobada' where mision_id='${mod.id}'`);
console.log("✓ ranking tras validar misión:", (await como(g1, true, `select nombre, puntos::int from ranking('${ev.id}') limit 1`)).rows[0]);

// Pantalla
const tok = (await db.query(`select token_pantalla from eventos`)).rows[0].token_pantalla;
await espera_error(como(intruso, true, `select unirse_pantalla('${ev.codigo}','malo')`), "pantalla con token incorrecto");
await como(intruso, true, `select unirse_pantalla('${ev.codigo}','${tok}')`);
console.log("✓ pantalla ve fotos aprobadas:", (await como(intruso, true, `select count(*)::int n from fotos`)).rows[0].n);
await espera_error(como(intruso, true, `insert into mensajes (evento_id,invitado_id,texto) values ('${ev.id}','${i1.id}','hack')`), "la pantalla no puede escribir mensajes");

// Storage
await espera_error(como(g2, true, `insert into storage.objects (bucket_id,name) values ('fotos','${ev.id}/${i1.id}/x.jpg')`), "subir archivo en carpeta de otro invitado");
await como(g2, true, `insert into storage.objects (bucket_id,name) values ('fotos','${ev.id}/${i2.id}/x.jpg')`);
console.log("✓ storage: subida en carpeta propia OK");

// Cierre
await como(host, false, `select cerrar_evento('${ev.id}')`);
console.log("✓ cerrado; sigue abierto 48 h:", (await db.query(`select estado, evento_abierto(id) from eventos`)).rows[0]);
await db.exec(`update eventos set cerrado_at = now() - interval '3 days'`);
await espera_error(como(g1, true, foto(ev.id, i1.id)), "subir fotos pasadas las 48 h del cierre");

// Límite del plan básico (80 invitados)
for (let n = 0; n < 78; n++) {
  const u = crypto.randomUUID();
  await db.exec(`insert into auth.users values ('${u}',null,true)`);
  await como(u, true, `select unirse_evento('${ev.codigo}','Inv ${n}')`);
}
const u = crypto.randomUUID();
await db.exec(`insert into auth.users values ('${u}',null,true)`);
await espera_error(como(u, true, `select unirse_evento('${ev.codigo}','Excedente')`), "invitado 81 en plan Básico");

// Sin sesión (rol anon): solo planes y evento_por_codigo
const sinSesion = async (q) => {
  await db.exec(`reset role; select set_config('t.uid','',false), set_config('t.anon','false',false), set_config('t.role','anon',false); set role anon;`);
  try { return await db.query(q); } finally { await db.exec("reset role"); }
};
console.log("✓ anon ve planes:", (await sinSesion(`select count(*)::int n from planes`)).rows[0].n);
console.log("✓ anon usa evento_por_codigo:", (await sinSesion(`select nombre from evento_por_codigo('${ev.codigo}')`)).rows[0]?.nombre);
console.log("✓ anon no ve fotos:", (await sinSesion(`select count(*)::int n from fotos`)).rows[0].n, "(debe ser 0)");
await espera_error(sinSesion(`select activar_evento('${ev.id}')`), "anon no ejecuta activar_evento");
await espera_error(sinSesion(`select crear_evento('X','boda','elegante','fiesta',null)`), "anon no ejecuta crear_evento");
await espera_error(sinSesion(`select ranking('${ev.id}')`), "anon no ejecuta ranking");
await espera_error(como(g1, true, `select tg_fotos_antes()`), "nadie llama triggers por RPC");

// Demo público
console.log("✓ sin demo, evento_demo vacío:", (await sinSesion(`select count(*)::int n from evento_demo()`)).rows[0].n === 0);
await db.exec(`update eventos set estado = 'activo', cerrado_at = null`);
await como(host, false, `update eventos set es_demo = true where id = '${ev.id}'`);
console.log("✓ el dueño no puede marcar demo:", (await db.query(`select es_demo from eventos`)).rows[0].es_demo === false);
await db.exec(`update eventos set es_demo = true`);
const demo = (await sinSesion(`select codigo, token_pantalla from evento_demo()`)).rows[0];
console.log("✓ anon obtiene el demo:", demo.codigo === ev.codigo && demo.token_pantalla === tok);

// Unirse dos veces no falla (idempotente)
await como(g1, true, `select unirse_pantalla('${ev.codigo}','${tok}')`);
await como(g1, true, `select unirse_pantalla('${ev.codigo}','${tok}')`);
const again = (await como(g1, true, `select nombre, mesa from unirse_evento('${ev.codigo}','Pepe','7')`)).rows[0];
console.log("✓ unirse dos veces actualiza sin duplicar:", again.mesa === "7", (await db.query(`select count(*)::int n from invitados where user_id = '${g1}'`)).rows[0].n === 1);

// Bingo de momentos (plan Fiesta)
const ev2 = (await como(host, false, `select * from crear_evento('Bingo','cumple','elegante','fiesta',null)`)).rows[0];
await como(host, false, `select activar_evento('${ev2.id}', 'pago-456')`, "service_role");
const casillas = (await como(host, false, `insert into bingo_casillas (evento_id,posicion,texto) select '${ev2.id}', p, 'Momento ' || p from generate_series(0,8) p returning id, posicion`)).rows.sort((a, b) => a.posicion - b.posicion);
await espera_error(como(g1, true, `insert into bingo_casillas (evento_id,posicion,texto) values ('${ev2.id}',0,'x')`), "un invitado no edita el cartón");
const b1 = (await como(g1, true, `select * from unirse_evento('${ev2.codigo}','Pepe','1')`)).rows[0];
console.log("✓ miembro ve el cartón:", (await como(g1, true, `select count(*)::int n from bingo_casillas`)).rows[0].n === 9);
console.log("✓ intruso no ve el cartón:", (await como(intruso, true, `select count(*)::int n from bingo_casillas where evento_id='${ev2.id}'`)).rows[0].n === 0);
const fotoB = (pos) => `insert into fotos (evento_id,invitado_id,storage_path,thumb_path,bingo_id) values ('${ev2.id}','${b1.id}','${ev2.id}/${b1.id}/b${pos}.jpg','${ev2.id}/${b1.id}/b${pos}_t.jpg','${casillas[pos].id}') returning bingo_id`;
const pts = async () => (await como(g1, true, `select puntos::int from ranking('${ev2.id}') where invitado_id='${b1.id}'`)).rows[0].puntos;
await como(g1, true, fotoB(0));
await como(g1, true, fotoB(0));
console.log("✓ casilla repetida cuenta una vez (2 fotos + 5):", (await pts()) === 7);
await como(g1, true, fotoB(1));
await como(g1, true, fotoB(2));
console.log("✓ línea completa (4 fotos + 15 casillas + 15 línea):", (await pts()) === 34);
for (const p of [3, 4, 5, 6, 7, 8]) await como(g1, true, fotoB(p));
console.log("✓ cartón lleno (10 fotos + 45 + 8 líneas·15 + 50):", (await pts()) === 10 + 45 + 120 + 50);
const ajena = (await como(g1, true, `insert into fotos (evento_id,invitado_id,storage_path,thumb_path,bingo_id) values ('${ev.id}','${i1.id}','${ev.id}/${i1.id}/z.jpg','${ev.id}/${i1.id}/z_t.jpg','${casillas[0].id}') returning bingo_id`)).rows[0];
console.log("✓ casilla de otro evento se anula:", ajena.bingo_id === null);

// Premios por votación (mismo evento Fiesta)
const b2 = (await como(g2, true, `select * from unirse_evento('${ev2.codigo}','Lola','2')`)).rows[0];
const u3 = crypto.randomUUID();
await db.exec(`insert into auth.users values ('${u3}',null,true)`);
const b3 = (await como(u3, true, `select * from unirse_evento('${ev2.codigo}','Tito','2')`)).rows[0];
const cat = (await como(host, false, `insert into votacion_categorias (evento_id,titulo) values ('${ev2.id}','Mejor look') returning id`)).rows[0];
await espera_error(como(g1, true, `insert into votacion_categorias (evento_id,titulo) values ('${ev2.id}','x')`), "un invitado no crea categorías");
await espera_error(como(g1, true, `select votar('${cat.id}','${b2.id}')`), "no se vota con la categoría preparada");
await como(host, false, `update votacion_categorias set estado='abierta' where id='${cat.id}'`);
await como(g1, true, `select votar('${cat.id}','${b3.id}')`);
await como(g1, true, `select votar('${cat.id}','${b2.id}')`);
await como(u3, true, `select votar('${cat.id}','${b2.id}')`);
await espera_error(como(g2, true, `select votar('${cat.id}','${b2.id}')`), "votarse a uno mismo");
await espera_error(como(g2, true, `select votar('${cat.id}','${i1.id}')`), "votar a alguien de otro evento");
await espera_error(como(intruso, true, `select votar('${cat.id}','${b2.id}')`), "votar sin unirse");
await espera_error(como(g1, true, `insert into votos (categoria_id,votante_id,candidato_id,evento_id) values ('${cat.id}','${b1.id}','${b3.id}','${ev2.id}')`), "insertar votos sin votar()");
console.log("✓ cambiar el voto no duplica:", (await db.query(`select count(*)::int n from votos`)).rows[0].n === 2);
console.log("✓ cada uno ve solo su voto:", (await como(g1, true, `select count(*)::int n from votos`)).rows[0].n === 1);
console.log("✓ invitado no ve resultados sin revelar:", (await como(g1, true, `select count(*)::int n from resultados_votacion('${ev2.id}')`)).rows[0].n === 0);
console.log("✓ invitado ve participación:", (await como(g1, true, `select votos::int from participacion_votacion('${ev2.id}')`)).rows[0].votos === 2);
console.log("✓ organizador ve resultados:", (await como(host, false, `select nombre, votos::int from resultados_votacion('${ev2.id}')`)).rows[0]);
await como(host, false, `update votacion_categorias set estado='revelada' where id='${cat.id}'`);
await espera_error(como(u3, true, `select votar('${cat.id}','${b1.id}')`), "no se vota una categoría revelada");
console.log("✓ revelada, el invitado ve al ganador:", (await como(g1, true, `select nombre, votos::int from resultados_votacion('${ev2.id}')`)).rows[0]);
await espera_error(sinSesion(`select resultados_votacion('${ev2.id}')`), "anon no ve resultados");

// Trivia personalizada (mismo evento Fiesta)
const pre = (await como(host, false, `insert into trivia_preguntas (evento_id,texto,opciones,puntos) values ('${ev2.id}','¿Dónde se conocieron?','{Facultad,Trabajo,Boliche}',10) returning id`)).rows[0];
await como(host, false, `insert into trivia_claves (pregunta_id,evento_id,correcta) values ('${pre.id}','${ev2.id}',2)`);
await espera_error(como(g1, true, `insert into trivia_claves (pregunta_id,evento_id,correcta) values ('${pre.id}','${ev2.id}',0)`), "un invitado no escribe claves");
await espera_error(como(g1, true, `select responder_trivia('${pre.id}',2)`), "no se responde una pregunta preparada");
await como(host, false, `update trivia_preguntas set estado='abierta' where id='${pre.id}'`);
console.log("✓ abierta, el invitado no ve la respuesta:", (await como(g1, true, `select count(*)::int n from trivia_claves`)).rows[0].n === 0);
const ptsDe = async (inv) => (await como(g1, true, `select puntos::int from ranking('${ev2.id}') where invitado_id='${inv}'`)).rows[0].puntos;
const antesLola = await ptsDe(b2.id), antesPepe = await ptsDe(b1.id);
await como(g2, true, `select responder_trivia('${pre.id}',2)`);
await como(g1, true, `select responder_trivia('${pre.id}',0)`);
await espera_error(como(g2, true, `select responder_trivia('${pre.id}',1)`), "responder dos veces");
await espera_error(como(u3, true, `select responder_trivia('${pre.id}',3)`), "opción fuera de rango");
await espera_error(como(g1, true, `insert into trivia_respuestas (pregunta_id,invitado_id,evento_id,opcion) values ('${pre.id}','${b3.id}','${ev2.id}',2)`), "insertar respuestas sin responder_trivia()");
console.log("✓ abierta, no suma puntos todavía:", (await ptsDe(b2.id)) === antesLola);
console.log("✓ invitado no ve el resumen abierto:", (await como(g1, true, `select count(*)::int n from trivia_resumen('${ev2.id}')`)).rows[0].n === 0);
console.log("✓ organizador ve el resumen:", (await como(host, false, `select count(*)::int n from trivia_resumen('${ev2.id}')`)).rows[0].n === 2);
await como(host, false, `update trivia_preguntas set estado='cerrada' where id='${pre.id}'`);
console.log("✓ cerrada, el invitado ve la respuesta:", (await como(g1, true, `select correcta from trivia_claves`)).rows[0]?.correcta === 2);
console.log("✓ acierto suma 10, error no suma:", (await ptsDe(b2.id)) === antesLola + 10, (await ptsDe(b1.id)) === antesPepe);
await espera_error(como(u3, true, `select responder_trivia('${pre.id}',2)`), "no se responde una pregunta cerrada");

// Juegos activables: el anfitrión apaga la trivia y el bingo
await como(host, false, `update trivia_preguntas set estado='abierta' where id='${pre.id}'`);
await como(host, false, `update eventos set personalizacion = personalizacion || '{"juegos":{"trivia":false,"bingo":false}}' where id='${ev2.id}'`);
await espera_error(como(u3, true, `select responder_trivia('${pre.id}',2)`), "trivia desactivada");
console.log("✓ bingo desactivado anula la casilla:", (await como(g1, true, fotoB(4))).rows[0].bingo_id === null);
console.log("✓ un plan sin portada personalizada pierde la portada:", (await como(host, false, `update eventos set personalizacion = personalizacion || '{"portada_path":"x.jpg"}' where id='${ev2.id}' returning personalizacion ? 'portada_path' as tiene`)).rows[0].tiene === false);

// Cápsula del tiempo (Premium)
const ev3 = (await como(host, false, `select * from crear_evento('Capsula','boda','elegante','premium','2026-01-10')`)).rows[0];
await como(host, false, `select activar_evento('${ev3.id}', 'pago-789')`, "service_role");
const c1 = (await como(g1, true, `select * from unirse_evento('${ev3.codigo}','Pepe')`)).rows[0];
console.log("✓ Premium conserva la portada:", (await como(host, false, `update eventos set personalizacion = '{"portada_path":"x.jpg","portada":{"estilo":"completa"}}' where id='${ev3.id}' returning personalizacion ? 'portada' as tiene`)).rows[0].tiene === true);
await como(g1, true, `insert into capsula_items (evento_id,invitado_id,texto) values ('${ev3.id}','${c1.id}','¡Feliz primer aniversario!')`);
await espera_error(como(g1, true, `insert into capsula_items (evento_id,invitado_id,texto) values ('${ev2.id}','${b1.id}','hola')`), "cápsula en un plan sin cápsula");
await espera_error(como(g1, true, `insert into capsula_items (evento_id,invitado_id,storage_path) values ('${ev3.id}','${c1.id}','otro/lado.jpg')`), "foto de cápsula fuera de su carpeta");
console.log("✓ el invitado ve lo que dejó:", (await como(g1, true, `select count(*)::int n from capsula_items`)).rows[0].n === 1);
await db.exec(`update eventos set fecha = current_date + 30 where id='${ev3.id}'`);
console.log("✓ sellada, el anfitrión no la ve:", (await como(host, false, `select count(*)::int n from capsula_items`)).rows[0].n === 0);
console.log("✓ pero sabe cuántos mensajes hay:", (await como(host, false, `select items::int, abierta from capsula_estado('${ev3.id}')`)).rows[0]);
await db.exec(`update eventos set fecha = current_date - interval '11 months' - interval '1 day' where id='${ev3.id}'`);
console.log("✓ a los 11 meses se abre:", (await como(host, false, `select count(*)::int n from capsula_items`)).rows[0].n === 1);
console.log("✓ se encola un aviso:", (await db.query(`select encolar_avisos_capsula() n`)).rows[0].n === 1, (await db.query(`select encolar_avisos_capsula() n`)).rows[0].n === 0);

// Administración
const adm = "55555555-5555-5555-5555-555555555555";
await db.exec(`insert into auth.users (id,email) values ('${adm}','admin@sky.com'); insert into admins values ('${adm}')`);
await espera_error(como(host, false, `select * from admin_resumen()`), "un anfitrión no ve el resumen de admin");
console.log("✓ admin ve el resumen:", (await como(adm, false, `select eventos_total::int, avisos_pendientes::int from admin_resumen()`)).rows[0]);
console.log("✓ admin ve todos los eventos:", (await como(adm, false, `select count(*)::int n from admin_eventos()`)).rows[0].n === 3);
await como(adm, false, `select admin_set_admin('a@a.com', true)`);
console.log("✓ admin da acceso por mail:", (await como(host, false, `select count(*)::int n from admin_usuarios()`)).rows[0].n >= 2);
await como(adm, false, `select admin_set_admin('a@a.com', false)`);
await espera_error(como(adm, false, `select admin_set_admin('admin@sky.com', false)`), "un admin no se quita a sí mismo");
await como(adm, false, `select admin_estado_evento('${ev3.id}','archivado')`);
console.log("✓ admin archiva un evento:", (await db.query(`select estado from eventos where id='${ev3.id}'`)).rows[0].estado === "archivado");
await como(adm, false, `update planes set precio_ars = 159000 where id='premium'`);
await como(host, false, `update planes set precio_ars = 1 where id='premium'`);
console.log("✓ solo el admin cambia precios:", (await db.query(`select precio_ars::int p from planes where id='premium'`)).rows[0].p === 159000);

// Clips de video y audio (hasta 10 s, desde el plan Fiesta)
const clip = (eid, iid, medio, dur, nombre) =>
  `insert into fotos (evento_id,invitado_id,storage_path,thumb_path,medio,duracion) values ('${eid}','${iid}','${eid}/${iid}/${nombre}','${eid}/${iid}/${nombre}_t.jpg','${medio}',${dur}) returning id`;
await espera_error(como(g1, true, clip(ev.id, i1.id, "video", 8, "v.mp4")), "video en el plan Básico");
await espera_error(como(g1, true, clip(ev2.id, b1.id, "video", 15, "largo.mp4")), "video de más de 10 segundos");
await espera_error(como(g1, true, clip(ev2.id, b1.id, "video", "null", "sin.mp4")), "video sin duración");
const v1 = (await como(g1, true, clip(ev2.id, b1.id, "video", 9.8, "v1.mp4"))).rows[0];
console.log("✓ video de 9,8 s en plan Fiesta:", !!v1.id);
const a1 = (await como(g1, true, clip(ev2.id, b1.id, "audio", 6, "a1.m4a"))).rows[0];
console.log("✓ audio de 6 s:", !!a1.id);
console.log("✓ el QR del libro muestra el clip a cualquiera:", (await como(intruso, true, `select medio from clip_publico('${v1.id}')`)).rows[0]?.medio === "video");
await db.exec(`insert into storage.objects (bucket_id,name) values ('fotos','${ev2.id}/${b1.id}/v1.mp4'),('fotos','${ev2.id}/${b1.id}/b0.jpg')`);
console.log("✓ y puede leer ese archivo:", (await como(intruso, true, `select count(*)::int n from storage.objects where name like '%v1.mp4'`)).rows[0].n === 1);
console.log("✓ pero no las fotos del evento:", (await como(intruso, true, `select count(*)::int n from storage.objects where name like '%b0.jpg'`)).rows[0].n === 0);
await db.exec(`update fotos set en_libro = false where id='${v1.id}'`);
console.log("✓ fuera del libro deja de ser público:", (await como(intruso, true, `select count(*)::int n from clip_publico('${v1.id}')`)).rows[0].n === 0);

// Marco de foto instantánea
const conMarco = (marco, medio = "foto", dur = "null") =>
  `insert into fotos (evento_id,invitado_id,storage_path,thumb_path,medio,duracion,marco) values ('${ev2.id}','${b1.id}','${ev2.id}/${b1.id}/m.jpg','${ev2.id}/${b1.id}/m_t.jpg','${medio}',${dur},${marco}) returning marco`;
console.log("✓ foto con marco blanco:", (await como(g1, true, conMarco("'blanco'"))).rows[0].marco === "blanco");
await espera_error(como(g1, true, conMarco("'arcoiris'")), "marco inexistente");
await espera_error(como(g1, true, conMarco("'negro'", "video", 5)), "un video con marco");

// Registro con email (sin confirmación: la sesión sigue siendo anónima)
await espera_error(como(g1, true, `select registrar_invitado('${ev2.codigo}','Pepe','pepe-sin-arroba','1')`), "email inválido");
const r1 = (await como(g1, true, `select * from registrar_invitado('${ev2.codigo}','Pepe','  Pepe@Mail.com ','1')`)).rows[0];
console.log("✓ registro con email reusa el invitado:", r1.id === b1.id);
await como(g2, true, `select registrar_invitado('${ev2.codigo}','Lola','lola@mail.com','2')`);
console.log("✓ el anfitrión ve los emails:", (await como(host, false, `select email from invitados_contacto where evento_id='${ev2.id}' order by email`)).rows.map((x) => x.email).join(", "));
console.log("✓ el invitado ve solo el suyo:", (await como(g1, true, `select email from invitados_contacto`)).rows.map((x) => x.email).join(", ") === "pepe@mail.com");
console.log("✓ intruso no ve emails:", (await como(intruso, true, `select count(*)::int n from invitados_contacto`)).rows[0].n === 0);
await espera_error(como(g1, true, `insert into invitados_contacto (invitado_id,evento_id,email) values ('${b2.id}','${ev2.id}','x@y.com')`), "escribir contactos directo");

// Borrado de vencidos: el anfitrión no puede marcar ni desmarcar el contenido borrado
await como(host, false, `update eventos set contenido_borrado_at = now(), nombre = 'Bingo!' where id='${ev2.id}'`);
const tras = (await db.query(`select nombre, contenido_borrado_at from eventos where id='${ev2.id}'`)).rows[0];
console.log("✓ el anfitrión edita el nombre pero no la marca de borrado:", tras.nombre === "Bingo!" && tras.contenido_borrado_at === null);
await como(host, false, `update eventos set contenido_borrado_at = now() where id='${ev2.id}'`, "service_role");
console.log("✓ el servicio de limpieza sí la marca:", (await db.query(`select contenido_borrado_at from eventos where id='${ev2.id}'`)).rows[0].contenido_borrado_at !== null);
await db.exec(`delete from invitados where evento_id='${ev2.id}'`);
console.log("✓ borrar invitados se lleva fotos, mensajes, votos y emails:", (await db.query(`select (select count(*) from fotos where evento_id='${ev2.id}') + (select count(*) from mensajes where evento_id='${ev2.id}') + (select count(*) from votos where evento_id='${ev2.id}') + (select count(*) from invitados_contacto where evento_id='${ev2.id}') as n`)).rows[0].n == 0);
// Cupones y regalos
await como(adm, false, `insert into cupones (codigo,tipo,valor) values ('PROMO20','porcentaje',20),('GRATIS','porcentaje',100)`);
await espera_error(como(host, false, `insert into cupones (codigo,tipo,valor) values ('TRUCHO','porcentaje',100)`), "solo el admin crea cupones");
const evc = (await como(host, false, `select * from crear_evento('Cupón','boda','romantico','basico','2026-12-12')`)).rows[0];
const ev1 = (await como(host, false, `select * from cupon_evaluar(' promo20 ','basico')`)).rows[0];
console.log("✓ evaluar PROMO20:", ev1.valido, ev1.descuento, ev1.total);
const ap = (await como(host, false, `select aplicar_cupon('${evc.id}','promo20') r`)).rows[0].r;
console.log("✓ aplicado:", ap.total, "activado", ap.activado, "monto pedido", (await db.query(`select monto from pedidos where evento_id='${evc.id}'`)).rows[0].monto);
await espera_error(como(host, false, `select aplicar_cupon('${evc.id}','GRATIS')`), "dos códigos en el mismo pedido");
await espera_error(como(intruso, true, `select aplicar_cupon('${evc.id}','GRATIS')`), "aplicar código a evento ajeno");
const evg = (await como(host, false, `select * from crear_evento('Gratis','boda','romantico','basico','2026-12-12')`)).rows[0];
console.log("✓ 100% activa sin pago:", (await como(host, false, `select aplicar_cupon('${evg.id}','GRATIS') r`)).rows[0].r.activado, (await db.query(`select estado from eventos where id='${evg.id}'`)).rows[0].estado);
const reg = (await como(host, false, `select * from crear_regalo('fiesta','Sofi','¡Feliz casamiento!')`)).rows[0];
console.log("✓ regalo creado:", reg.cupon, reg.estado);
const evr = (await como(host, false, `select * from crear_evento('Regalo','boda','romantico','premium','2026-12-12')`)).rows[0];
await espera_error(como(host, false, `select aplicar_cupon('${evr.id}','${reg.cupon}')`), "regalo sin pagar");
await espera_error(como(host, false, `select activar_regalo('${reg.id}')`), "el comprador no activa su regalo");
await como(host, false, `select activar_regalo('${reg.id}','pago-9')`, "service_role");
const apr = (await como(host, false, `select aplicar_cupon('${evr.id}','${reg.cupon}') r`)).rows[0].r;
console.log("✓ regalo de Fiesta aplicado a Premium: paga la diferencia", apr.total, "activado", apr.activado);
console.log("✓ el comprador ve su código:", (await como(host, false, `select count(*)::int n from cupones where codigo='${reg.cupon}'`)).rows[0].n === 1);
console.log("✓ otro usuario no lo ve:", (await como(intruso, true, `select count(*)::int n from cupones`)).rows[0].n === 0);

// Fotolibro compartido
await espera_error(como(intruso, true, `select compartir_libro('${ev.id}', true)`), "compartir libro ajeno");
const tokL = (await como(host, false, `select compartir_libro('${ev.id}', true) t`)).rows[0].t;
const lib = (await como(intruso, true, `select libro_compartido('${tokL}') l`)).rows[0].l;
console.log("✓ libro público:", lib.evento.nombre, "fotos", lib.fotos.length);
console.log("✓ archivo del libro visible:", lib.fotos.length === 0 || (await como(intruso, true, `select libro_archivo_publico('${lib.fotos[0]?.storage_path}') v`)).rows[0].v);
await como(host, false, `update eventos set libro_token = gen_random_uuid() where id='${ev.id}'`);
console.log("✓ el anfitrión no puede elegir el token:", (await db.query(`select libro_token from eventos where id='${ev.id}'`)).rows[0].libro_token === tokL);
await como(host, false, `select compartir_libro('${ev.id}', false)`);
console.log("✓ al dejar de compartir, el link no muestra nada:", (await como(intruso, true, `select libro_compartido('${tokL}') l`)).rows[0].l === null);
console.log("FIN");
