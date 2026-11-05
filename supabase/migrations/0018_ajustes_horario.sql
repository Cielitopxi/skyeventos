-- SkyEventos — márgenes del horario configurables desde el admin
--
-- Cada evento se habilita para los invitados `horas_antes` antes del inicio y sigue abierto hasta
-- `horas_despues` después del fin (también después de cerrarlo a mano). Por defecto: 3 h antes y 24 h después.

begin;

create table if not exists public.ajustes (
  id int primary key default 1 check (id = 1),
  horas_antes int not null default 3 check (horas_antes between 0 and 48),
  horas_despues int not null default 24 check (horas_despues between 0 and 168),
  updated_at timestamptz not null default now()
);
insert into public.ajustes (id) values (1) on conflict (id) do nothing;
alter table public.ajustes enable row level security;
create policy ajustes_ver on public.ajustes for select using (true);
create policy ajustes_admin on public.ajustes for update using (es_admin()) with check (es_admin());
grant select on public.ajustes to anon, authenticated;
grant update (horas_antes, horas_despues, updated_at) on public.ajustes to authenticated;

create or replace function public.evento_abierto(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eventos e, ajustes a
    where e.id = p_evento and a.id = 1
      and (
        (e.estado = 'activo' and (
          e.inicio_at is null
          or es_organizador(e.id)
          or (now() >= e.inicio_at - make_interval(hours => a.horas_antes)
              and now() < coalesce(e.fin_at, e.inicio_at + interval '12 hours') + make_interval(hours => a.horas_despues))
        ))
        or (e.estado = 'cerrado' and e.cerrado_at > now() - make_interval(hours => a.horas_despues))
      )
  );
$$;

/** Fija el horario contratado. El anfitrión puede cambiarlo hasta que el evento se habilita; después, solo el admin. */
create or replace function public.definir_horario(p_evento uuid, p_inicio timestamptz, p_fin timestamptz)
returns public.eventos
language plpgsql security definer set search_path = public as $$
declare
  ev eventos;
  ret int;
  antes int;
begin
  select * into ev from eventos where id = p_evento;
  if ev.id is null or not es_organizador(p_evento) then raise exception 'No autorizado'; end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then raise exception 'El horario de fin tiene que ser posterior al de inicio'; end if;
  if p_fin > p_inicio + interval '24 hours' then raise exception 'El evento puede durar hasta 24 horas'; end if;
  if not es_admin() then
    select horas_antes into antes from ajustes where id = 1;
    if ev.inicio_at is not null and now() >= ev.inicio_at - make_interval(hours => coalesce(antes, 3)) then
      raise exception 'El horario ya no se puede cambiar porque el evento ya está habilitado. Escribinos si necesitás moverlo.';
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

-- La lista de eventos del admin incluye el horario. admin_eventos cambia lo que devuelve: se suma una función aparte.
create or replace function public.admin_horarios()
returns table (id uuid, inicio_at timestamptz, fin_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'No autorizado'; end if;
  return query select e.id, e.inicio_at, e.fin_at from eventos e;
end $$;
revoke execute on function public.admin_horarios() from public, anon;
grant execute on function public.admin_horarios() to authenticated;

commit;
