-- SkyEventos — límite de registros de anfitriones por IP
-- La función `cuentas` crea cuentas sin sesión previa: sin tope, un bot podría crear miles o
-- alguien registrar emails ajenos en masa. Se permiten 5 altas por hora y 20 por día por IP.
-- Solo la usa la Edge Function (service_role); los intentos de más de 2 días se van borrando.

create table if not exists public.registro_intentos (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists registro_intentos_ip_idx on public.registro_intentos (ip, created_at desc);
alter table public.registro_intentos enable row level security;
revoke all on public.registro_intentos from anon, authenticated;

create or replace function public.registro_permitido(p_ip text) returns boolean
language plpgsql security definer set search_path = public as $$
declare ip_ text := left(coalesce(nullif(trim(p_ip), ''), 'desconocida'), 64);
begin
  delete from registro_intentos where created_at < now() - interval '2 days';
  if (select count(*) from registro_intentos where ip = ip_ and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from registro_intentos where ip = ip_ and created_at > now() - interval '1 day') >= 20 then
    return false;
  end if;
  insert into registro_intentos (ip) values (ip_);
  return true;
end $$;
revoke execute on function public.registro_permitido(text) from public, anon, authenticated;
grant execute on function public.registro_permitido(text) to service_role;
