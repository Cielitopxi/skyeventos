-- SkyEventos — evento demo público
-- Un evento marcado es_demo se puede abrir desde /demo sin contratar: como invitado
-- (sesión anónima, igual que siempre) y en la pantalla en vivo (se expone su token).

begin;

alter table public.eventos add column if not exists es_demo boolean not null default false;

-- Solo un admin marca o desmarca el demo (el trigger de eventos ya impide otros cambios de estado).
create or replace function public.tg_eventos_demo() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not es_admin() then
    new.es_demo := old.es_demo;
  end if;
  return new;
end $$;
revoke execute on function public.tg_eventos_demo() from public, anon, authenticated;
create trigger eventos_demo before update on public.eventos for each row execute function public.tg_eventos_demo();

-- Datos para la página /demo: código y link de pantalla del demo activo más reciente.
create or replace function public.evento_demo()
returns table (codigo text, token_pantalla text, nombre text, tematica text)
language sql stable security definer set search_path = public as $$
  select e.codigo, e.token_pantalla, e.nombre, e.tematica
  from eventos e
  where e.es_demo and e.estado = 'activo'
  order by e.created_at desc
  limit 1;
$$;
revoke execute on function public.evento_demo() from public;
grant execute on function public.evento_demo() to anon, authenticated;

commit;
