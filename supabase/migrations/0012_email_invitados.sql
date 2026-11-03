-- SkyEventos — email del invitado al registrarse, sin confirmación
-- La sesión sigue siendo anónima (Supabase no manda ningún correo): el email es un dato de contacto
-- para los anfitriones. Va en una tabla aparte porque los demás invitados ven la lista de invitados
-- (nombres para votar y ranking) y no deben ver los emails.

begin;

create table if not exists public.invitados_contacto (
  invitado_id uuid primary key references public.invitados(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invitados_contacto_evento on public.invitados_contacto (evento_id);

alter table public.invitados_contacto enable row level security;
-- Lectura: los organizadores del evento y el propio invitado. Se escribe solo por registrar_invitado.
create policy invitados_contacto_ver on public.invitados_contacto for select using (
  es_organizador(evento_id)
  or exists (select 1 from invitados i where i.id = invitado_id and i.user_id = auth.uid())
);

-- Registro del invitado: nombre, email y mesa. Reusa unirse_evento (cupo del plan, bloqueos, reingreso).
create or replace function public.registrar_invitado(p_codigo text, p_nombre text, p_email text, p_mesa text default null)
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
  insert into invitados_contacto (invitado_id, evento_id, email)
  values (inv.id, inv.evento_id, correo)
  on conflict (invitado_id) do update set email = excluded.email, updated_at = now();
  return inv;
end $$;

revoke execute on function public.registrar_invitado(text, text, text, text) from public, anon;
grant execute on function public.registrar_invitado(text, text, text, text) to authenticated;
grant select on public.invitados_contacto to authenticated;

commit;
