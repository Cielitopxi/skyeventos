-- SkyEventos — unirse_evento y unirse_pantalla sin carrera
-- Dos llamadas simultáneas (doble montaje en React, recargas rápidas) pasaban el
-- "if exists" a la vez y la segunda chocaba con la clave primaria/única.

begin;

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
  if inv.id is not null and inv.bloqueado then raise exception 'Tu acceso a este evento fue bloqueado'; end if;

  if inv.id is null then
    select * into pl from planes where id = ev.plan_id;
    select count(*) into total from invitados where evento_id = ev.id;
    if pl.max_invitados is not null and total >= pl.max_invitados then
      raise exception 'El evento alcanzó el máximo de invitados de su plan';
    end if;
  end if;

  insert into invitados (evento_id, user_id, nombre, mesa)
  values (ev.id, auth.uid(), trim(p_nombre), nullif(trim(p_mesa), ''))
  on conflict (evento_id, user_id) do update set nombre = excluded.nombre, mesa = excluded.mesa
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
  insert into pantallas (evento_id, user_id) values (ev.id, auth.uid()) on conflict do nothing;
  return ev.id;
end $$;

commit;
