-- SkyEventos — Premios por votación
-- Categorías que arma el organizador ("Mejor look", "Alma de la fiesta"…). Cada invitado
-- vota a otro invitado: un voto por categoría, que puede cambiar mientras está abierta.
-- Los votos son secretos: solo se ven totales, el organizador siempre y el resto cuando
-- la categoría se revela. Disponible en los planes con misiones.

begin;

create table if not exists public.votacion_categorias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 1 and 60),
  orden int not null default 0,
  estado text not null default 'preparada' check (estado in ('preparada', 'abierta', 'cerrada', 'revelada')),
  created_at timestamptz not null default now()
);
create index if not exists votacion_categorias_evento_idx on public.votacion_categorias(evento_id);
alter table public.votacion_categorias enable row level security;

create table if not exists public.votos (
  categoria_id uuid not null references public.votacion_categorias(id) on delete cascade,
  votante_id uuid not null references public.invitados(id) on delete cascade,
  candidato_id uuid not null references public.invitados(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (categoria_id, votante_id),
  check (votante_id <> candidato_id)
);
create index if not exists votos_votante_idx on public.votos(votante_id);
create index if not exists votos_candidato_idx on public.votos(candidato_id);
create index if not exists votos_evento_idx on public.votos(evento_id);
alter table public.votos enable row level security;

create policy votacion_ver on public.votacion_categorias for select to authenticated using (es_miembro(evento_id));
create policy votacion_crear on public.votacion_categorias for insert to authenticated with check ((select es_organizador(evento_id)));
create policy votacion_editar on public.votacion_categorias for update to authenticated using ((select es_organizador(evento_id))) with check ((select es_organizador(evento_id)));
create policy votacion_borrar on public.votacion_categorias for delete to authenticated using ((select es_organizador(evento_id)));

-- Cada invitado ve solo sus propios votos; se escriben únicamente con votar().
create policy votos_propios on public.votos for select to authenticated using (votante_id = mi_invitado(evento_id));

grant select, insert, update, delete on public.votacion_categorias to authenticated;
grant select on public.votos to authenticated;
alter publication supabase_realtime add table public.votacion_categorias;

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
  if cat.estado <> 'abierta' then raise exception 'La votación de esta categoría no está abierta'; end if;
  if p_candidato = yo then raise exception 'No podés votarte a vos mismo'; end if;
  if not exists (select 1 from invitados where id = p_candidato and evento_id = cat.evento_id and not bloqueado) then
    raise exception 'Candidato inválido';
  end if;
  insert into votos (categoria_id, votante_id, candidato_id, evento_id)
  values (cat.id, yo, p_candidato, cat.evento_id)
  on conflict (categoria_id, votante_id) do update set candidato_id = excluded.candidato_id, created_at = now();
end $$;

-- Totales por categoría y candidato. El organizador ve todo; invitados y pantallas,
-- solo las categorías reveladas.
create or replace function public.resultados_votacion(p_evento uuid)
returns table (categoria_id uuid, candidato_id uuid, nombre text, mesa text, votos bigint)
language sql stable security definer set search_path = public as $$
  select v.categoria_id, i.id, i.nombre, i.mesa, count(*)
  from votos v
  join votacion_categorias c on c.id = v.categoria_id
  join invitados i on i.id = v.candidato_id
  where v.evento_id = p_evento and not i.bloqueado
    and (es_organizador(p_evento) or (c.estado = 'revelada' and es_miembro(p_evento)))
  group by v.categoria_id, i.id, i.nombre, i.mesa
  order by v.categoria_id, count(*) desc, i.nombre;
$$;

-- Votos emitidos por categoría (para mostrar participación sin revelar resultados).
create or replace function public.participacion_votacion(p_evento uuid)
returns table (categoria_id uuid, votos bigint)
language sql stable security definer set search_path = public as $$
  select v.categoria_id, count(*) from votos v
  where v.evento_id = p_evento and es_miembro(p_evento)
  group by 1;
$$;

revoke execute on function public.votar(uuid, uuid) from public, anon;
revoke execute on function public.resultados_votacion(uuid) from public, anon;
revoke execute on function public.participacion_votacion(uuid) from public, anon;
grant execute on function public.votar(uuid, uuid) to authenticated;
grant execute on function public.resultados_votacion(uuid) to authenticated;
grant execute on function public.participacion_votacion(uuid) to authenticated;

commit;
