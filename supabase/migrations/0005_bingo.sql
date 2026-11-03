-- SkyEventos — Bingo de momentos
-- Cartón de 3x3 por evento. Cada foto puede marcar una casilla; en el ranking suma
-- 5 puntos por casilla distinta, 15 por línea completa (filas, columnas, diagonales)
-- y 50 por cartón lleno. Disponible en los planes con misiones.

begin;

create table if not exists public.bingo_casillas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  posicion int not null check (posicion between 0 and 8),
  texto text not null check (char_length(trim(texto)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (evento_id, posicion)
);
alter table public.bingo_casillas enable row level security;

alter table public.fotos add column if not exists bingo_id uuid references public.bingo_casillas(id) on delete set null;
create index if not exists fotos_bingo_idx on public.fotos(bingo_id);

-- Una política por acción: evita el lint de políticas permisivas múltiples en select.
create policy bingo_ver on public.bingo_casillas for select to authenticated using (es_miembro(evento_id));
create policy bingo_crear on public.bingo_casillas for insert to authenticated with check ((select es_organizador(evento_id)));
create policy bingo_editar on public.bingo_casillas for update to authenticated using ((select es_organizador(evento_id))) with check ((select es_organizador(evento_id)));
create policy bingo_borrar on public.bingo_casillas for delete to authenticated using ((select es_organizador(evento_id)));

grant select, insert, update, delete on public.bingo_casillas to authenticated;
alter publication supabase_realtime add table public.bingo_casillas;

-- Fotos: además de lo anterior, la casilla de bingo tiene que ser del mismo evento
-- y el plan tiene que incluir juegos.
create or replace function public.tg_fotos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev eventos; pl planes; total int; mis misiones;
begin
  select * into ev from eventos where id = new.evento_id;
  select * into pl from planes where id = ev.plan_id;
  if new.bingo_id is not null and (not coalesce(pl.misiones, false)
     or not exists (select 1 from bingo_casillas where id = new.bingo_id and evento_id = new.evento_id)) then
    new.bingo_id := null;
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

-- Ranking: misma firma, suma los puntos del bingo.
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
  ), bc as (
    select fo.invitado_id, array_agg(distinct c.posicion) pos
    from fotos fo join bingo_casillas c on c.id = fo.bingo_id
    where fo.evento_id = p_evento and fo.estado <> 'oculta'
    group by 1
  ), b as (
    select bc.invitado_id,
           cardinality(bc.pos) * 5
           + 15 * (select count(*) from (values (array[0,1,2]), (array[3,4,5]), (array[6,7,8]), (array[0,3,6]),
                                                (array[1,4,7]), (array[2,5,8]), (array[0,4,8]), (array[2,4,6])) l(v)
                   where l.v <@ bc.pos)
           + case when cardinality(bc.pos) = 9 then 50 else 0 end as pts
    from bc
  )
  select i.id, i.nombre, i.mesa,
         coalesce(f.n,0) + coalesce(m.n,0)*2 + coalesce(mi.pts,0) + coalesce(b.pts,0) as puntos,
         coalesce(f.n,0), coalesce(mi.n,0)
  from invitados i
  left join f on f.invitado_id = i.id
  left join m on m.invitado_id = i.id
  left join mi on mi.invitado_id = i.id
  left join b on b.invitado_id = i.id
  where i.evento_id = p_evento and not i.bloqueado and es_miembro(p_evento)
  order by puntos desc, i.nombre;
$$;

commit;
