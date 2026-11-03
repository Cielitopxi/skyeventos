-- SkyEventos — Juegos activables, cápsula del tiempo, portada Premium y administración
--
-- * Juegos: el anfitrión elige cuáles activa en personalizacion.juegos
--   ({"misiones": true, "bingo": false, ...}); una clave ausente cuenta como activa.
--   Las RPC y el trigger de fotos respetan esa elección.
-- * Cápsula del tiempo (solo planes con planes.capsula): los invitados dejan mensajes
--   y fotos sellados. Se abre a los 11 meses del evento; el contenido se guarda un año.
--   Al llegar la fecha se encola un aviso por mail al anfitrión (notificaciones).
-- * Portada personalizada (solo planes con planes.portada_personalizada): foto y diseño
--   de portada en personalizacion.portada_path y personalizacion.portada.
-- * Administración: funciones para ver y operar todo el servicio (solo admins).

begin;

-- ───────────── Planes ─────────────
alter table public.planes add column if not exists capsula boolean not null default false;
alter table public.planes add column if not exists portada_personalizada boolean not null default false;
update public.planes set capsula = true, portada_personalizada = true where id = 'premium';

-- ───────────── Juegos activables ─────────────
create or replace function public.juego_activo(p_evento uuid, p_juego text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (e.personalizacion -> 'juegos' ->> p_juego) is distinct from 'false' from eventos e where e.id = p_evento), false);
$$;

-- Fotos: misión y bingo se anulan si el juego está desactivado.
create or replace function public.tg_fotos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev eventos; pl planes; total int; mis misiones;
begin
  select * into ev from eventos where id = new.evento_id;
  select * into pl from planes where id = ev.plan_id;
  if new.bingo_id is not null and (not coalesce(pl.misiones, false) or not juego_activo(new.evento_id, 'bingo')
     or not exists (select 1 from bingo_casillas where id = new.bingo_id and evento_id = new.evento_id)) then
    new.bingo_id := null;
  end if;
  if new.mision_id is not null and not juego_activo(new.evento_id, 'misiones') then
    new.mision_id := null;
  end if;
  if es_organizador(new.evento_id) then return new; end if;
  if pl.max_fotos is not null then
    select count(*) into total from fotos where evento_id = new.evento_id;
    if total >= pl.max_fotos then raise exception 'El evento alcanzó el máximo de fotos de su plan'; end if;
  end if;
  new.estado := case when ev.moderacion = 'previa' then 'pendiente' else 'aprobada' end;
  new.destacada := false;
  new.en_libro := true;
  if new.mision_id is not null then
    select * into mis from misiones where id = new.mision_id and evento_id = new.evento_id;
    if mis.id is null then
      new.mision_id := null; new.mision_estado := null;
    elsif (mis.inicio is not null and now() < mis.inicio) or (mis.fin is not null and now() > mis.fin) then
      raise exception 'La misión no está disponible en este momento';
    else
      new.mision_estado := case when mis.validacion = 'moderador' then 'pendiente' else 'aprobada' end;
    end if;
  else
    new.mision_estado := null;
  end if;
  return new;
end $$;

create or replace function public.votar(p_categoria uuid, p_candidato uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cat votacion_categorias; yo uuid; pl planes;
begin
  select * into cat from votacion_categorias where id = p_categoria;
  if cat.id is null then raise exception 'Categoría inexistente'; end if;
  yo := mi_invitado(cat.evento_id);
  if yo is null then raise exception 'Tenés que unirte al evento para votar'; end if;
  if not evento_abierto(cat.evento_id) then raise exception 'El evento ya no admite votos'; end if;
  select pl2.* into pl from planes pl2 join eventos e on e.plan_id = pl2.id where e.id = cat.evento_id;
  if not coalesce(pl.misiones, false) then raise exception 'La votación no está incluida en el plan del evento'; end if;
  if not juego_activo(cat.evento_id, 'votacion') then raise exception 'La votación no está activa en este evento'; end if;
  if cat.estado <> 'abierta' then raise exception 'La votación de esta categoría no está abierta'; end if;
  if p_candidato = yo then raise exception 'No podés votarte a vos mismo'; end if;
  if not exists (select 1 from invitados where id = p_candidato and evento_id = cat.evento_id and not bloqueado) then
    raise exception 'Candidato inválido';
  end if;
  insert into votos (categoria_id, votante_id, candidato_id, evento_id)
  values (cat.id, yo, p_candidato, cat.evento_id)
  on conflict (categoria_id, votante_id) do update set candidato_id = excluded.candidato_id, created_at = now();
end $$;

create or replace function public.responder_trivia(p_pregunta uuid, p_opcion int) returns void
language plpgsql security definer set search_path = public as $$
declare
  pre trivia_preguntas; yo uuid; pl planes;
begin
  select * into pre from trivia_preguntas where id = p_pregunta;
  if pre.id is null then raise exception 'Pregunta inexistente'; end if;
  yo := mi_invitado(pre.evento_id);
  if yo is null then raise exception 'Tenés que unirte al evento para jugar'; end if;
  if not evento_abierto(pre.evento_id) then raise exception 'El evento ya no admite respuestas'; end if;
  select pl2.* into pl from planes pl2 join eventos e on e.plan_id = pl2.id where e.id = pre.evento_id;
  if not coalesce(pl.misiones, false) then raise exception 'La trivia no está incluida en el plan del evento'; end if;
  if not juego_activo(pre.evento_id, 'trivia') then raise exception 'La trivia no está activa en este evento'; end if;
  if pre.estado <> 'abierta' then raise exception 'Esta pregunta no está abierta'; end if;
  if p_opcion is null or p_opcion < 0 or p_opcion >= array_length(pre.opciones, 1) then raise exception 'Opción inválida'; end if;
  insert into trivia_respuestas (pregunta_id, invitado_id, evento_id, opcion)
  values (pre.id, yo, pre.evento_id, p_opcion)
  on conflict (pregunta_id, invitado_id) do nothing;
  if not found then raise exception 'Ya respondiste esta pregunta'; end if;
end $$;

-- ───────────── Beneficios Premium en la personalización ─────────────
-- Sin security definer: el plan se lee con los permisos del que escribe (planes es público).
create or replace function public.tg_eventos_premium() returns trigger
language plpgsql set search_path = public as $$
declare
  pl planes;
begin
  select * into pl from planes where id = new.plan_id;
  if not coalesce(pl.portada_personalizada, false) then
    new.personalizacion := new.personalizacion - 'portada' - 'portada_path';
  end if;
  return new;
end $$;
create trigger eventos_premium before insert or update of personalizacion, plan_id on public.eventos
  for each row execute function public.tg_eventos_premium();
revoke execute on function public.tg_eventos_premium() from public, anon, authenticated;

-- ───────────── Cápsula del tiempo ─────────────
create or replace function public.capsula_abre_at(p_evento uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select (coalesce(e.fecha, e.created_at::date) + interval '11 months')::timestamptz from eventos e where e.id = p_evento;
$$;

create or replace function public.capsula_habilitada(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select pl.capsula from eventos e join planes pl on pl.id = e.plan_id where e.id = p_evento), false)
     and juego_activo(p_evento, 'capsula');
$$;

create table if not exists public.capsula_items (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  invitado_id uuid not null references public.invitados(id) on delete cascade,
  texto text check (texto is null or char_length(trim(texto)) between 1 and 1000),
  storage_path text,
  created_at timestamptz not null default now(),
  check (texto is not null or storage_path is not null)
);
create index if not exists capsula_items_evento_idx on public.capsula_items(evento_id);
create index if not exists capsula_items_invitado_idx on public.capsula_items(invitado_id);
alter table public.capsula_items enable row level security;

-- Cada invitado ve lo que dejó; el organizador, todo, recién cuando la cápsula se abre.
create policy capsula_ver on public.capsula_items for select to authenticated using (
  invitado_id = mi_invitado(evento_id)
  or (es_organizador(evento_id) and now() >= capsula_abre_at(evento_id))
);
create policy capsula_dejar on public.capsula_items for insert to authenticated with check (
  invitado_id = mi_invitado(evento_id) and evento_abierto(evento_id) and capsula_habilitada(evento_id)
  and (storage_path is null or storage_path like evento_id::text || '/' || invitado_id::text || '/capsula/%')
);
create policy capsula_borrar on public.capsula_items for delete to authenticated using (
  invitado_id = mi_invitado(evento_id) and evento_abierto(evento_id)
);
grant select, insert, delete on public.capsula_items to authenticated;

-- Estado de la cápsula sin revelar el contenido.
create or replace function public.capsula_estado(p_evento uuid)
returns table (items bigint, invitados bigint, abre_at timestamptz, abierta boolean, habilitada boolean)
language sql stable security definer set search_path = public as $$
  select count(c.id), count(distinct c.invitado_id), capsula_abre_at(p_evento), now() >= capsula_abre_at(p_evento), capsula_habilitada(p_evento)
  from (select 1) x left join capsula_items c on c.evento_id = p_evento
  where es_miembro(p_evento);
$$;

-- ───────────── Avisos por mail ─────────────
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  tipo text not null check (tipo in ('capsula_lista')),
  email text not null,
  programada_at timestamptz not null default now(),
  enviada_at timestamptz,
  intentos int not null default 0,
  error text,
  unique (evento_id, tipo)
);
create index if not exists notificaciones_pendientes_idx on public.notificaciones(programada_at) where enviada_at is null;
alter table public.notificaciones enable row level security;
create policy notificaciones_admin on public.notificaciones for select to authenticated using ((select es_admin()));

-- Encola el aviso de "tu cápsula está lista" para cada evento que llegó a los 11 meses.
-- La corre pg_cron una vez por día; es idempotente gracias al unique (evento_id, tipo).
create or replace function public.encolar_avisos_capsula() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into notificaciones (evento_id, tipo, email)
  select e.id, 'capsula_lista', u.email
  from eventos e
  join planes pl on pl.id = e.plan_id and pl.capsula
  join auth.users u on u.id = e.owner_id
  where e.estado in ('activo', 'cerrado', 'archivado') and u.email is not null
    and now() >= capsula_abre_at(e.id)
    and exists (select 1 from capsula_items c where c.evento_id = e.id)
  on conflict (evento_id, tipo) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────── Administración ─────────────
-- Los permisos se revocan marcando activo = false (queda el registro de quién fue admin).
alter table public.admins add column if not exists activo boolean not null default true;
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and activo);
$$;

create policy planes_admin on public.planes for update to authenticated using ((select es_admin())) with check ((select es_admin()));
grant update on public.planes to authenticated;

create or replace function public.admin_resumen()
returns table (eventos_activos bigint, eventos_pendientes bigint, eventos_total bigint, ingresos numeric, ingresos_mes numeric,
               pedidos_pendientes bigint, invitados bigint, fotos bigint, mensajes bigint, avisos_pendientes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  return query select
    (select count(*) from eventos where estado = 'activo'),
    (select count(*) from eventos where estado = 'pendiente_pago'),
    (select count(*) from eventos),
    (select coalesce(sum(monto), 0) from pedidos where estado = 'aprobado'),
    (select coalesce(sum(monto), 0) from pedidos where estado = 'aprobado' and pagado_at >= date_trunc('month', now())),
    (select count(*) from pedidos where estado = 'pendiente'),
    (select count(*) from invitados),
    (select count(*) from fotos),
    (select count(*) from mensajes),
    (select count(*) from notificaciones where enviada_at is null);
end $$;

create or replace function public.admin_eventos()
returns table (id uuid, codigo text, nombre text, tipo text, plan_id text, estado text, fecha date, created_at timestamptz,
               expira_at timestamptz, es_demo boolean, owner_email text, invitados bigint, fotos bigint, mensajes bigint,
               pagado numeric, capsula_items bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  return query
  select e.id, e.codigo, e.nombre, e.tipo, e.plan_id, e.estado, e.fecha, e.created_at, e.expira_at, e.es_demo, u.email::text,
         (select count(*) from invitados i where i.evento_id = e.id),
         (select count(*) from fotos f where f.evento_id = e.id),
         (select count(*) from mensajes m where m.evento_id = e.id),
         (select coalesce(sum(p.monto), 0) from pedidos p where p.evento_id = e.id and p.estado = 'aprobado'),
         (select count(*) from capsula_items c where c.evento_id = e.id)
  from eventos e left join auth.users u on u.id = e.owner_id
  order by e.created_at desc;
end $$;

create or replace function public.admin_pedidos()
returns table (id uuid, evento_id uuid, evento text, codigo text, owner_email text, plan_id text, monto numeric, estado text,
               mp_payment_id text, created_at timestamptz, pagado_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  return query
  select p.id, p.evento_id, e.nombre, e.codigo, u.email::text, p.plan_id, p.monto, p.estado, p.mp_payment_id, p.created_at, p.pagado_at
  from pedidos p join eventos e on e.id = p.evento_id left join auth.users u on u.id = p.owner_id
  order by p.created_at desc;
end $$;

create or replace function public.admin_usuarios()
returns table (user_id uuid, email text, es_admin boolean, eventos bigint, creado_at timestamptz, ultimo_ingreso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  return query
  select u.id, u.email::text, coalesce(a.activo, false), (select count(*) from eventos e where e.owner_id = u.id), u.created_at, u.last_sign_in_at
  from auth.users u left join admins a on a.user_id = u.id
  where not coalesce(u.is_anonymous, false)
  order by u.created_at desc;
end $$;

create or replace function public.admin_notificaciones()
returns table (id uuid, evento text, codigo text, tipo text, email text, programada_at timestamptz, enviada_at timestamptz, intentos int, error text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  return query
  select n.id, e.nombre, e.codigo, n.tipo, n.email, n.programada_at, n.enviada_at, n.intentos, n.error
  from notificaciones n join eventos e on e.id = n.evento_id
  order by n.programada_at desc;
end $$;

-- Da o quita permisos de administración a un usuario registrado (por mail).
create or replace function public.admin_set_admin(p_email text, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email)) and not coalesce(is_anonymous, false);
  if uid is null then raise exception 'No hay ninguna cuenta con ese mail: tiene que ingresar una vez al panel'; end if;
  if not p_admin and uid = auth.uid() then raise exception 'No podés quitarte el acceso a vos mismo'; end if;
  insert into admins (user_id, activo) values (uid, p_admin)
  on conflict (user_id) do update set activo = excluded.activo;
end $$;

-- Cambia el estado de un evento (activar sin pago, cerrar, archivar, reactivar).
create or replace function public.admin_estado_evento(p_evento uuid, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  if p_estado not in ('activo', 'cerrado', 'archivado') then raise exception 'Estado inválido'; end if;
  if p_estado = 'activo' then
    perform activar_evento(p_evento, 'admin');
  else
    update eventos set estado = p_estado, cerrado_at = coalesce(cerrado_at, now()) where id = p_evento;
  end if;
end $$;

revoke execute on function public.juego_activo(uuid, text) from public, anon;
revoke execute on function public.capsula_abre_at(uuid) from public, anon;
revoke execute on function public.capsula_habilitada(uuid) from public, anon;
revoke execute on function public.capsula_estado(uuid) from public, anon;
revoke execute on function public.encolar_avisos_capsula() from public, anon, authenticated;
revoke execute on function public.admin_resumen() from public, anon;
revoke execute on function public.admin_eventos() from public, anon;
revoke execute on function public.admin_pedidos() from public, anon;
revoke execute on function public.admin_usuarios() from public, anon;
revoke execute on function public.admin_notificaciones() from public, anon;
revoke execute on function public.admin_set_admin(text, boolean) from public, anon;
revoke execute on function public.admin_estado_evento(uuid, text) from public, anon;
grant execute on function public.juego_activo(uuid, text) to authenticated;
grant execute on function public.capsula_abre_at(uuid) to authenticated;
grant execute on function public.capsula_habilitada(uuid) to authenticated;
grant execute on function public.capsula_estado(uuid) to authenticated;
grant execute on function public.encolar_avisos_capsula() to service_role;
grant execute on function public.admin_resumen() to authenticated;
grant execute on function public.admin_eventos() to authenticated;
grant execute on function public.admin_pedidos() to authenticated;
grant execute on function public.admin_usuarios() to authenticated;
grant execute on function public.admin_notificaciones() to authenticated;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;
grant execute on function public.admin_estado_evento(uuid, text) to authenticated;

commit;
