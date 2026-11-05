-- SkyEventos — horario contratado de cada evento y contactos de invitados para novedades
--
-- Horario: cada evento tiene inicio y fin (hasta 24 h). Los invitados pueden registrarse desde antes
-- (para instalar la app), pero subir fotos y mensajes solo desde 1 h antes del inicio hasta 48 h
-- después del fin. Los organizadores pueden probar en cualquier momento mientras el evento esté activo.
-- Eventos sin horario cargado (los anteriores a esta migración y la demo) siguen abiertos como antes.
--
-- Contactos: el email del invitado ya era obligatorio (0012). Ahora se guarda si aceptó recibir
-- novedades y promociones de SkyEventos, y se puede dar de baja con baja_novedades.

begin;

-- ───────────── Horario ─────────────
alter table public.eventos add column if not exists inicio_at timestamptz;
alter table public.eventos add column if not exists fin_at timestamptz;
alter table public.eventos add constraint eventos_horario_ck
  check (inicio_at is null or fin_at is null or (fin_at > inicio_at and fin_at <= inicio_at + interval '24 hours'));

-- El horario solo se cambia con definir_horario (los anfitriones no pueden estirarlo a mano).
create or replace function public.tg_eventos_upd()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not es_admin() then
    new.estado := old.estado; new.owner_id := old.owner_id; new.plan_id := old.plan_id;
    new.codigo := old.codigo; new.expira_at := old.expira_at; new.cerrado_at := old.cerrado_at;
    new.contenido_borrado_at := old.contenido_borrado_at; new.libro_token := old.libro_token;
    new.inicio_at := old.inicio_at; new.fin_at := old.fin_at;
  end if;
  return new;
end $$;

/** Fija el horario contratado. El anfitrión puede cambiarlo hasta 1 h antes del inicio; después, solo el admin. */
create or replace function public.definir_horario(p_evento uuid, p_inicio timestamptz, p_fin timestamptz)
returns public.eventos
language plpgsql security definer set search_path = public as $$
declare
  ev eventos;
  ret int;
begin
  select * into ev from eventos where id = p_evento;
  if ev.id is null or not es_organizador(p_evento) then raise exception 'No autorizado'; end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then raise exception 'El horario de fin tiene que ser posterior al de inicio'; end if;
  if p_fin > p_inicio + interval '24 hours' then raise exception 'El evento puede durar hasta 24 horas'; end if;
  if not es_admin() then
    if ev.inicio_at is not null and now() >= ev.inicio_at - interval '1 hour' then
      raise exception 'El horario ya no se puede cambiar porque el evento está por empezar o ya empezó. Escribinos si necesitás moverlo.';
    end if;
    if p_inicio < now() then raise exception 'El inicio no puede ser en el pasado'; end if;
  end if;
  select pl.retencion_dias into ret from planes pl where pl.id = ev.plan_id;
  update eventos set
    inicio_at = p_inicio,
    fin_at = p_fin,
    fecha = (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date,
    expira_at = case when expira_at is null then null
                     else ((p_inicio at time zone 'America/Argentina/Buenos_Aires')::date)::timestamptz + make_interval(days => ret) end
  where id = p_evento
  returning * into ev;
  return ev;
end $$;

/** Se puede subir contenido: dentro del horario (1 h antes del inicio hasta 48 h después del fin) o, sin horario, mientras esté activo. */
create or replace function public.evento_abierto(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eventos e
    where e.id = p_evento
      and (
        (e.estado = 'activo' and (
          e.inicio_at is null
          or es_organizador(e.id)
          or (now() >= e.inicio_at - interval '1 hour' and now() < coalesce(e.fin_at, e.inicio_at + interval '12 hours') + interval '48 hours')
        ))
        or (e.estado = 'cerrado' and e.cerrado_at > now() - interval '48 hours')
      )
  );
$$;

-- evento_por_codigo suma el horario. Cambia lo que devuelve, así que la versión anterior queda renombrada y sin permisos.
alter function public.evento_por_codigo(text) rename to evento_por_codigo_v1;
revoke execute on function public.evento_por_codigo_v1(text) from public, anon, authenticated;

create function public.evento_por_codigo(p_codigo text)
returns table (id uuid, nombre text, tipo text, tematica text, fecha date, personalizacion jsonb, estado text, abierto boolean,
               premios_activos boolean, inicio_at timestamptz, fin_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.nombre, e.tipo, e.tematica, e.fecha, e.personalizacion, e.estado, evento_abierto(e.id), e.premios_activos, e.inicio_at, e.fin_at
  from eventos e
  where e.codigo = upper(trim(p_codigo)) and e.estado in ('activo', 'cerrado');
$$;
revoke execute on function public.evento_por_codigo(text) from public;
grant execute on function public.evento_por_codigo(text) to anon, authenticated;

-- ───────────── Contactos y novedades ─────────────
alter table public.invitados_contacto add column if not exists acepta_novedades boolean not null default false;
alter table public.invitados_contacto add column if not exists acepta_novedades_at timestamptz;

-- registrar_invitado suma el consentimiento. Con un parámetro más, la versión anterior queda renombrada
-- (si quedaran las dos, la API no sabría cuál llamar).
alter function public.registrar_invitado(text, text, text, text) rename to registrar_invitado_v1;
revoke execute on function public.registrar_invitado_v1(text, text, text, text) from public, anon, authenticated;

create function public.registrar_invitado(p_codigo text, p_nombre text, p_email text, p_mesa text default null, p_novedades boolean default false)
returns public.invitados
language plpgsql security definer set search_path = public as $$
declare
  inv invitados;
  correo text := lower(trim(coalesce(p_email, '')));
begin
  if correo !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(correo) > 254 then
    raise exception 'Ingresá un email válido';
  end if;
  inv := unirse_evento(p_codigo, p_nombre, p_mesa);
  insert into invitados_contacto (invitado_id, evento_id, email, acepta_novedades, acepta_novedades_at)
  values (inv.id, inv.evento_id, correo, coalesce(p_novedades, false), case when p_novedades then now() end)
  on conflict (invitado_id) do update set
    email = excluded.email,
    acepta_novedades = excluded.acepta_novedades,
    acepta_novedades_at = excluded.acepta_novedades_at,
    updated_at = now();
  return inv;
end $$;
revoke execute on function public.registrar_invitado(text, text, text, text, boolean) from public, anon;
grant execute on function public.registrar_invitado(text, text, text, text, boolean) to authenticated;

/** Baja de novedades: deja de enviarse publicidad a ese email (en todos los eventos). */
create or replace function public.baja_novedades(p_email text)
returns void
language sql security definer set search_path = public as $$
  update invitados_contacto set acepta_novedades = false, acepta_novedades_at = null, updated_at = now()
  where email = lower(trim(p_email));
$$;
revoke execute on function public.baja_novedades(text) from public;
grant execute on function public.baja_novedades(text) to anon, authenticated;

/** Contactos de invitados para el admin (exportar para campañas). */
create or replace function public.admin_contactos()
returns table (email text, nombre text, evento text, tipo text, fecha date, acepta_novedades boolean, registrado_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'No autorizado'; end if;
  return query
    select c.email, i.nombre, e.nombre, e.tipo, e.fecha, c.acepta_novedades, c.created_at
    from invitados_contacto c
    join invitados i on i.id = c.invitado_id
    join eventos e on e.id = c.evento_id
    order by c.created_at desc;
end $$;
revoke execute on function public.admin_contactos() from public, anon;
grant execute on function public.admin_contactos() to authenticated;

revoke execute on function public.definir_horario(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.definir_horario(uuid, timestamptz, timestamptz) to authenticated;

commit;
