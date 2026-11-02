import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";

const db = new PGlite({ extensions: { pgcrypto } });
const sql = fs.readFileSync(process.argv[2], "utf8");

// Simulación mínima de Supabase
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, is_anonymous boolean default false);
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
await db.exec(sql);
await db.exec(`grant all on all tables in schema public to authenticated, anon; grant all on storage.objects to authenticated;`);
console.log("✓ migración aplicada");

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
console.log("FIN");
