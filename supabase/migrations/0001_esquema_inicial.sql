-- SkyEventos — esquema inicial
-- Multi-evento: todo cuelga de eventos.id y se aísla con RLS.
-- Anfitriones: Supabase Auth con email. Invitados y pantallas: sesión anónima (signInAnonymously).

begin;

create extension if not exists pgcrypto;

-- ───────────────────────── Catálogo ─────────────────────────

create table if not exists public.planes (
  id text primary key,
  nombre text not null,
  precio_ars numeric(12,2) not null,
  max_invitados int,            -- null = ilimitado
  max_fotos int,                -- null = ilimitado
  pantallas int not null default 1,
  retencion_dias int not null default 90,
  misiones boolean not null default true,
  sin_marca boolean not null default false,
  orden int not null default 0,
  activo boolean not null default true
);

insert into public.planes (id, nombre, precio_ars, max_invitados, max_fotos, pantallas, retencion_dias, misiones, sin_marca, orden) values
  ('basico',  'Básico',  45000,  80,  500, 1,  90, false, false, 1),
  ('fiesta',  'Fiesta',  89000, 250, 3000, 2, 180, true,  false, 2),
  ('premium', 'Premium', 149000, null, null, 4, 365, true, true, 3)
on conflict (id) do nothing;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ───────────────────────── Eventos ─────────────────────────

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  owner_id uuid not null references auth.users(id),
  plan_id text not null references public.planes(id),
  tipo text not null default 'boda',          -- boda, quince, cumple, corporativo, egresados, baby_shower, otro
  tematica text not null default 'elegante',  -- slug definido en el frontend (src/lib/tematicas.ts)
  nombre text not null,
  fecha date,
  personalizacion jsonb not null default '{}'::jsonb, -- titulo, subtitulo, bienvenida, colores, portada_path, dedicatoria
  moderacion text not null default 'posterior' check (moderacion in ('previa','posterior')),
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago','activo','cerrado','archivado')),
  token_pantalla text not null default encode(gen_random_bytes(12), 'hex'),
  premios_activos boolean not null default true,
  cerrado_at timestamptz,
  expira_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists eventos_owner_idx on public.eventos(owner_id);

create table if not exists public.organizadores (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (evento_id, user_id)
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  plan_id text not null references public.planes(id),
  monto numeric(12,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','cancelado')),
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  pagado_at timestamptz
);

create table if not exists public.invitados (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  mesa text,
  avatar_path text,
  bloqueado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (evento_id, user_id)
);

create table if not exists public.pantallas (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evento_id, user_id)
);

create table if not exists public.misiones (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  titulo text not null,
  descripcion text,
  puntos int not null default 10 check (puntos >= 0),
  validacion text not null default 'automatica' check (validacion in ('automatica','moderador')),
  relampago boolean not null default false,
  inicio timestamptz,
  fin timestamptz,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  invitado_id uuid not null references public.invitados(id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  ancho int, alto int,
  caption text check (char_length(caption) <= 140),
  mision_id uuid references public.misiones(id) on delete set null,
  estado text not null default 'aprobada' check (estado in ('pendiente','aprobada','oculta')),
  mision_estado text check (mision_estado in ('pendiente','aprobada','rechazada')),
  destacada boolean not null default false,
  en_libro boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists fotos_evento_idx on public.fotos(evento_id, created_at desc);

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  invitado_id uuid not null references public.invitados(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 600),
  tipo text not null default 'nota' check (tipo in ('nota','dedicatoria')),
  estado text not null default 'aprobada' check (estado in ('pendiente','aprobada','oculta')),
  en_libro boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists mensajes_evento_idx on public.mensajes(evento_id, created_at desc);

create table if not exists public.premios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  puesto int not null check (puesto > 0),
  descripcion text not null
);

create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Helpers de acceso ─────────────────────────

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public.es_organizador(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eventos where id = p_evento and owner_id = auth.uid())
      or exists (select 1 from organizadores where evento_id = p_evento and user_id = auth.uid())
      or es_admin();
$$;

create or replace function public.es_miembro(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_organizador(p_evento)
      or exists (select 1 from invitados where evento_id = p_evento and user_id = auth.uid() and not bloqueado)
      or exists (select 1 from pantallas where evento_id = p_evento and user_id = auth.uid());
$$;

create or replace function public.mi_invitado(p_evento uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from invitados where evento_id = p_evento and user_id = auth.uid() and not bloqueado;
$$;

-- ¿Se puede subir contenido? activo, o hasta 48 h después de cerrado.
create or replace function public.evento_abierto(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eventos
    where id = p_evento
      and (estado = 'activo' or (estado = 'cerrado' and cerrado_at > now() - interval '48 hours'))
  );
$$;

-- ───────────────────────── Código de evento ─────────────────────────

create or replace function public.generar_codigo() returns text
language plpgsql volatile set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin 0/O, 1/I
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from eventos where codigo = c);
  end loop;
  return c;
end $$;

-- ───────────────────────── RPC: contratación ─────────────────────────

create or replace function public.crear_evento(
  p_nombre text, p_tipo text, p_tematica text, p_plan text, p_fecha date, p_personalizacion jsonb default '{}'::jsonb
) returns public.eventos
language plpgsql security definer set search_path = public as $$
declare
  ev eventos;
  pl planes;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Necesitás iniciar sesión con tu email para contratar';
  end if;
  select * into pl from planes where id = p_plan and activo;
  if pl.id is null then raise exception 'Plan inexistente'; end if;

  insert into eventos (codigo, owner_id, plan_id, tipo, tematica, nombre, fecha, personalizacion)
  values (generar_codigo(), auth.uid(), p_plan, p_tipo, p_tematica, p_nombre, p_fecha, coalesce(p_personalizacion, '{}'::jsonb))
  returning * into ev;

  insert into pedidos (evento_id, owner_id, plan_id, monto) values (ev.id, auth.uid(), p_plan, pl.precio_ars);
  return ev;
end $$;

-- Llamada por el webhook de Mercado Pago (service_role) o por un admin.
create or replace function public.activar_evento(p_evento uuid, p_payment_id text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  ret int;
begin
  if not (auth.role() = 'service_role' or es_admin()) then
    raise exception 'No autorizado';
  end if;
  select pl.retencion_dias into ret from eventos e join planes pl on pl.id = e.plan_id where e.id = p_evento;
  update eventos set estado = 'activo',
         expira_at = coalesce(fecha, current_date)::timestamptz + make_interval(days => ret)
   where id = p_evento and estado = 'pendiente_pago';
  update pedidos set estado = 'aprobado', mp_payment_id = coalesce(p_payment_id, mp_payment_id), pagado_at = now()
   where evento_id = p_evento and estado = 'pendiente';
end $$;

create or replace function public.cerrar_evento(p_evento uuid, p_cerrar boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_organizador(p_evento) then raise exception 'No autorizado'; end if;
  if p_cerrar then
    update eventos set estado = 'cerrado', cerrado_at = now() where id = p_evento and estado = 'activo';
  else
    update eventos set estado = 'activo', cerrado_at = null where id = p_evento and estado = 'cerrado';
  end if;
end $$;

-- ───────────────────────── RPC: acceso por código ─────────────────────────

-- Datos públicos mínimos para la pantalla de ingreso (sin login).
create or replace function public.evento_por_codigo(p_codigo text)
returns table (id uuid, nombre text, tipo text, tematica text, fecha date, personalizacion jsonb, estado text, abierto boolean, premios_activos boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.nombre, e.tipo, e.tematica, e.fecha, e.personalizacion, e.estado, evento_abierto(e.id), e.premios_activos
  from eventos e
  where e.codigo = upper(trim(p_codigo)) and e.estado in ('activo','cerrado');
$$;

create or replace function public.unirse_evento(p_codigo text, p_nombre text, p_mesa text default null)
returns public.invitados
language plpgsql security definer set search_path = public as $$
declare
  ev eventos;
  pl planes;
  inv invitados;
  total int;
begin
  if auth.uid() is null then raise exception 'Sesión inválida'; end if;
  select * into ev from eventos where codigo = upper(trim(p_codigo)) and estado in ('activo','cerrado');
  if ev.id is null then raise exception 'Código de evento inválido'; end if;

  select * into inv from invitados where evento_id = ev.id and user_id = auth.uid();
  if inv.id is not null then
    if inv.bloqueado then raise exception 'Tu acceso a este evento fue bloqueado'; end if;
    update invitados set nombre = trim(p_nombre), mesa = nullif(trim(p_mesa), '') where id = inv.id returning * into inv;
    return inv;
  end if;

  select * into pl from planes where id = ev.plan_id;
  select count(*) into total from invitados where evento_id = ev.id;
  if pl.max_invitados is not null and total >= pl.max_invitados then
    raise exception 'El evento alcanzó el máximo de invitados de su plan';
  end if;

  insert into invitados (evento_id, user_id, nombre, mesa)
  values (ev.id, auth.uid(), trim(p_nombre), nullif(trim(p_mesa), ''))
  returning * into inv;
  return inv;
end $$;

create or replace function public.unirse_pantalla(p_codigo text, p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ev eventos;
  pl planes;
  total int;
begin
  if auth.uid() is null then raise exception 'Sesión inválida'; end if;
  select * into ev from eventos where codigo = upper(trim(p_codigo)) and token_pantalla = p_token and estado in ('activo','cerrado');
  if ev.id is null then raise exception 'Link de pantalla inválido'; end if;
  if exists (select 1 from pantallas where evento_id = ev.id and user_id = auth.uid()) then return ev.id; end if;
  select * into pl from planes where id = ev.plan_id;
  select count(*) into total from pantallas where evento_id = ev.id;
  if total >= pl.pantallas then
    -- se recicla la pantalla más vieja: el link sigue funcionando si se cambia de TV
    delete from pantallas where (evento_id, user_id) in (
      select evento_id, user_id from pantallas where evento_id = ev.id order by created_at limit 1);
  end if;
  insert into pantallas (evento_id, user_id) values (ev.id, auth.uid());
  return ev.id;
end $$;

-- ───────────────────────── Ranking ─────────────────────────
-- 1 punto por foto aprobada, 2 por mensaje aprobado, puntos de la misión cumplida
-- (x2 si es relámpago). Cada misión puntúa una sola vez por invitado.

create or replace function public.ranking(p_evento uuid)
returns table (invitado_id uuid, nombre text, mesa text, puntos bigint, fotos bigint, misiones bigint)
language sql stable security definer set search_path = public as $$
  with f as (
    select invitado_id, count(*) n from fotos where evento_id = p_evento and estado = 'aprobada' group by 1
  ), m as (
    select invitado_id, count(*) n from mensajes where evento_id = p_evento and estado = 'aprobada' group by 1
  ), mi as (
    select x.invitado_id, count(*) n, sum(x.pts) pts from (
      select distinct on (fo.invitado_id, fo.mision_id) fo.invitado_id,
             mis.puntos * case when mis.relampago then 2 else 1 end as pts
      from fotos fo join misiones mis on mis.id = fo.mision_id
      where fo.evento_id = p_evento and fo.mision_estado = 'aprobada' and fo.estado <> 'oculta'
    ) x group by 1
  )
  select i.id, i.nombre, i.mesa,
         coalesce(f.n,0) + coalesce(m.n,0)*2 + coalesce(mi.pts,0) as puntos,
         coalesce(f.n,0), coalesce(mi.n,0)
  from invitados i
  left join f on f.invitado_id = i.id
  left join m on m.invitado_id = i.id
  left join mi on mi.invitado_id = i.id
  where i.evento_id = p_evento and not i.bloqueado and es_miembro(p_evento)
  order by puntos desc, i.nombre;
$$;

-- ───────────────────────── Triggers ─────────────────────────

-- Fotos: estado según moderación, estado de misión según validación, límite del plan.
create or replace function public.tg_fotos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev eventos; pl planes; total int; mis misiones;
begin
  if es_organizador(new.evento_id) then return new; end if;
  select * into ev from eventos where id = new.evento_id;
  select * into pl from planes where id = ev.plan_id;
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
drop trigger if exists fotos_antes on public.fotos;
create trigger fotos_antes before insert on public.fotos for each row execute function public.tg_fotos_antes();

create or replace function public.tg_mensajes_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev eventos;
begin
  if es_organizador(new.evento_id) then return new; end if;
  select * into ev from eventos where id = new.evento_id;
  new.estado := case when ev.moderacion = 'previa' then 'pendiente' else 'aprobada' end;
  new.en_libro := true;
  return new;
end $$;
drop trigger if exists mensajes_antes on public.mensajes;
create trigger mensajes_antes before insert on public.mensajes for each row execute function public.tg_mensajes_antes();

-- El dueño queda como organizador.
create or replace function public.tg_eventos_despues() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into organizadores (evento_id, user_id) values (new.id, new.owner_id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists eventos_despues on public.eventos;
create trigger eventos_despues after insert on public.eventos for each row execute function public.tg_eventos_despues();

-- Los invitados solo pueden cambiar campos permitidos de su propio registro.
create or replace function public.tg_invitados_upd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not es_organizador(new.evento_id) then
    new.bloqueado := old.bloqueado;
    new.evento_id := old.evento_id;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;
drop trigger if exists invitados_upd on public.invitados;
create trigger invitados_upd before update on public.invitados for each row execute function public.tg_invitados_upd();

-- ───────────────────────── RLS ─────────────────────────

alter table public.planes enable row level security;
alter table public.admins enable row level security;
alter table public.eventos enable row level security;
alter table public.organizadores enable row level security;
alter table public.pedidos enable row level security;
alter table public.invitados enable row level security;
alter table public.pantallas enable row level security;
alter table public.misiones enable row level security;
alter table public.fotos enable row level security;
alter table public.mensajes enable row level security;
alter table public.premios enable row level security;
alter table public.anuncios enable row level security;

drop policy if exists planes_ver on public.planes;
create policy planes_ver on public.planes for select using (true);

drop policy if exists admins_ver on public.admins;
create policy admins_ver on public.admins for select using (user_id = auth.uid());

-- eventos: solo organizadores (invitados y pantallas usan evento_por_codigo, que no expone el token de pantalla).
drop policy if exists eventos_ver on public.eventos;
create policy eventos_ver on public.eventos for select using (es_organizador(id));
drop policy if exists eventos_editar on public.eventos;
create policy eventos_editar on public.eventos for update using (es_organizador(id)) with check (es_organizador(id));

-- Sin security definer a propósito: current_user es 'authenticated' en un UPDATE directo
-- y el dueño de la función cuando el cambio viene de una RPC (cerrar_evento, activar_evento).
create or replace function public.tg_eventos_upd() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not es_admin() then
    new.estado := old.estado; new.owner_id := old.owner_id; new.plan_id := old.plan_id;
    new.codigo := old.codigo; new.expira_at := old.expira_at; new.cerrado_at := old.cerrado_at;
  end if;
  return new;
end $$;
drop trigger if exists eventos_upd on public.eventos;
create trigger eventos_upd before update on public.eventos for each row execute function public.tg_eventos_upd();

drop policy if exists organizadores_ver on public.organizadores;
create policy organizadores_ver on public.organizadores for select using (es_organizador(evento_id));

drop policy if exists pedidos_ver on public.pedidos;
create policy pedidos_ver on public.pedidos for select using (owner_id = auth.uid() or es_admin());

drop policy if exists invitados_ver on public.invitados;
create policy invitados_ver on public.invitados for select using (es_miembro(evento_id));
drop policy if exists invitados_editar on public.invitados;
create policy invitados_editar on public.invitados for update
  using (user_id = auth.uid() or es_organizador(evento_id))
  with check (user_id = auth.uid() or es_organizador(evento_id));

drop policy if exists pantallas_ver on public.pantallas;
create policy pantallas_ver on public.pantallas for select using (es_organizador(evento_id) or user_id = auth.uid());

drop policy if exists misiones_ver on public.misiones;
create policy misiones_ver on public.misiones for select using (es_miembro(evento_id));
drop policy if exists misiones_admin on public.misiones;
create policy misiones_admin on public.misiones for all using (es_organizador(evento_id)) with check (es_organizador(evento_id));

-- fotos: el organizador ve todo; invitados/pantalla ven aprobadas + las propias.
drop policy if exists fotos_ver on public.fotos;
create policy fotos_ver on public.fotos for select using (
  es_organizador(evento_id)
  or (es_miembro(evento_id) and (estado = 'aprobada' or invitado_id = mi_invitado(evento_id)))
);
drop policy if exists fotos_subir on public.fotos;
create policy fotos_subir on public.fotos for insert with check (
  invitado_id = mi_invitado(evento_id) and evento_abierto(evento_id)
  and storage_path like evento_id::text || '/' || invitado_id::text || '/%'
  and thumb_path like evento_id::text || '/' || invitado_id::text || '/%'
);
drop policy if exists fotos_moderar on public.fotos;
create policy fotos_moderar on public.fotos for update using (es_organizador(evento_id)) with check (es_organizador(evento_id));
drop policy if exists fotos_borrar on public.fotos;
create policy fotos_borrar on public.fotos for delete using (invitado_id = mi_invitado(evento_id) or es_organizador(evento_id));

drop policy if exists mensajes_ver on public.mensajes;
create policy mensajes_ver on public.mensajes for select using (
  es_organizador(evento_id)
  or (es_miembro(evento_id) and (estado = 'aprobada' or invitado_id = mi_invitado(evento_id)))
);
drop policy if exists mensajes_crear on public.mensajes;
create policy mensajes_crear on public.mensajes for insert with check (
  invitado_id = mi_invitado(evento_id) and evento_abierto(evento_id)
);
drop policy if exists mensajes_moderar on public.mensajes;
create policy mensajes_moderar on public.mensajes for update using (es_organizador(evento_id)) with check (es_organizador(evento_id));
drop policy if exists mensajes_borrar on public.mensajes;
create policy mensajes_borrar on public.mensajes for delete using (invitado_id = mi_invitado(evento_id) or es_organizador(evento_id));

drop policy if exists premios_ver on public.premios;
create policy premios_ver on public.premios for select using (es_miembro(evento_id));
drop policy if exists premios_admin on public.premios;
create policy premios_admin on public.premios for all using (es_organizador(evento_id)) with check (es_organizador(evento_id));

drop policy if exists anuncios_ver on public.anuncios;
create policy anuncios_ver on public.anuncios for select using (es_miembro(evento_id));
drop policy if exists anuncios_crear on public.anuncios;
create policy anuncios_crear on public.anuncios for insert with check (es_organizador(evento_id));

-- ───────────────────────── Grants de RPC ─────────────────────────

revoke execute on function public.activar_evento(uuid, text) from anon;
grant execute on function public.evento_por_codigo(text) to anon, authenticated;

-- ───────────────────────── Storage ─────────────────────────
create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Bucket privado "fotos": {evento_id}/{invitado_id}/{archivo}. Portadas: {evento_id}/portada/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_obj_ver on storage.objects;
create policy fotos_obj_ver on storage.objects for select using (
  bucket_id = 'fotos' and public.es_miembro(public.try_uuid((storage.foldername(name))[1]))
);
drop policy if exists fotos_obj_subir on storage.objects;
create policy fotos_obj_subir on storage.objects for insert with check (
  bucket_id = 'fotos' and (
    ((storage.foldername(name))[2] = public.mi_invitado(public.try_uuid((storage.foldername(name))[1]))::text
      and public.evento_abierto(public.try_uuid((storage.foldername(name))[1])))
    or public.es_organizador(public.try_uuid((storage.foldername(name))[1]))
  )
);
drop policy if exists fotos_obj_borrar on storage.objects;
create policy fotos_obj_borrar on storage.objects for delete using (
  bucket_id = 'fotos' and (
    (storage.foldername(name))[2] = public.mi_invitado(public.try_uuid((storage.foldername(name))[1]))::text
    or public.es_organizador(public.try_uuid((storage.foldername(name))[1]))
  )
);

-- ───────────────────────── Realtime ─────────────────────────

do $$
begin
  begin alter publication supabase_realtime add table public.fotos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mensajes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.anuncios; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.misiones; exception when duplicate_object then null; end;
end $$;

commit;
