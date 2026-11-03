-- SkyEventos — Trivia personalizada
-- Preguntas sobre los anfitriones con 2 a 4 opciones. El organizador abre cada pregunta,
-- los invitados responden una sola vez y, al cerrarla, se revela la respuesta correcta
-- y suma puntos al ranking. La respuesta correcta vive en una tabla aparte que los
-- invitados solo pueden leer cuando la pregunta está cerrada.
-- Disponible en los planes con misiones.

begin;

create table if not exists public.trivia_preguntas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 200),
  opciones text[] not null check (array_length(opciones, 1) between 2 and 4),
  puntos int not null default 10 check (puntos between 0 and 1000),
  orden int not null default 0,
  estado text not null default 'preparada' check (estado in ('preparada', 'abierta', 'cerrada')),
  created_at timestamptz not null default now()
);
create index if not exists trivia_preguntas_evento_idx on public.trivia_preguntas(evento_id);
alter table public.trivia_preguntas enable row level security;

create table if not exists public.trivia_claves (
  pregunta_id uuid primary key references public.trivia_preguntas(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  correcta int not null check (correcta between 0 and 3)
);
create index if not exists trivia_claves_evento_idx on public.trivia_claves(evento_id);
alter table public.trivia_claves enable row level security;

create table if not exists public.trivia_respuestas (
  pregunta_id uuid not null references public.trivia_preguntas(id) on delete cascade,
  invitado_id uuid not null references public.invitados(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  opcion int not null check (opcion between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (pregunta_id, invitado_id)
);
create index if not exists trivia_respuestas_invitado_idx on public.trivia_respuestas(invitado_id);
create index if not exists trivia_respuestas_evento_idx on public.trivia_respuestas(evento_id);
alter table public.trivia_respuestas enable row level security;

create policy trivia_ver on public.trivia_preguntas for select to authenticated using (es_miembro(evento_id));
create policy trivia_crear on public.trivia_preguntas for insert to authenticated with check ((select es_organizador(evento_id)));
create policy trivia_editar on public.trivia_preguntas for update to authenticated using ((select es_organizador(evento_id))) with check ((select es_organizador(evento_id)));
create policy trivia_borrar on public.trivia_preguntas for delete to authenticated using ((select es_organizador(evento_id)));

create policy trivia_claves_ver on public.trivia_claves for select to authenticated using (
  es_organizador(evento_id)
  or (es_miembro(evento_id) and exists (select 1 from trivia_preguntas p where p.id = pregunta_id and p.estado = 'cerrada'))
);
create policy trivia_claves_crear on public.trivia_claves for insert to authenticated with check ((select es_organizador(evento_id)));
create policy trivia_claves_editar on public.trivia_claves for update to authenticated using ((select es_organizador(evento_id))) with check ((select es_organizador(evento_id)));
create policy trivia_claves_borrar on public.trivia_claves for delete to authenticated using ((select es_organizador(evento_id)));

-- Cada invitado ve solo sus respuestas; se escriben únicamente con responder_trivia().
create policy trivia_respuestas_propias on public.trivia_respuestas for select to authenticated using (invitado_id = mi_invitado(evento_id));

grant select, insert, update, delete on public.trivia_preguntas, public.trivia_claves to authenticated;
grant select on public.trivia_respuestas to authenticated;
alter publication supabase_realtime add table public.trivia_preguntas;

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
  if pre.estado <> 'abierta' then raise exception 'Esta pregunta no está abierta'; end if;
  if p_opcion is null or p_opcion < 0 or p_opcion >= array_length(pre.opciones, 1) then raise exception 'Opción inválida'; end if;
  insert into trivia_respuestas (pregunta_id, invitado_id, evento_id, opcion)
  values (pre.id, yo, pre.evento_id, p_opcion)
  on conflict (pregunta_id, invitado_id) do nothing;
  if not found then raise exception 'Ya respondiste esta pregunta'; end if;
end $$;

-- Respuestas por opción. El organizador ve todo; invitados y pantallas, solo las cerradas.
create or replace function public.trivia_resumen(p_evento uuid)
returns table (pregunta_id uuid, opcion int, respuestas bigint)
language sql stable security definer set search_path = public as $$
  select r.pregunta_id, r.opcion, count(*)
  from trivia_respuestas r join trivia_preguntas p on p.id = r.pregunta_id
  where r.evento_id = p_evento and (es_organizador(p_evento) or (p.estado = 'cerrada' and es_miembro(p_evento)))
  group by 1, 2;
$$;

revoke execute on function public.responder_trivia(uuid, int) from public, anon;
revoke execute on function public.trivia_resumen(uuid) from public, anon;
grant execute on function public.responder_trivia(uuid, int) to authenticated;
grant execute on function public.trivia_resumen(uuid) to authenticated;

-- Ranking: misma firma, suma los puntos de las preguntas de trivia cerradas.
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
  ), tr as (
    select r.invitado_id, sum(p.puntos) pts
    from trivia_respuestas r
    join trivia_preguntas p on p.id = r.pregunta_id
    join trivia_claves k on k.pregunta_id = p.id
    where r.evento_id = p_evento and p.estado = 'cerrada' and r.opcion = k.correcta
    group by 1
  )
  select i.id, i.nombre, i.mesa,
         coalesce(f.n,0) + coalesce(m.n,0)*2 + coalesce(mi.pts,0) + coalesce(b.pts,0) + coalesce(tr.pts,0) as puntos,
         coalesce(f.n,0), coalesce(mi.n,0)
  from invitados i
  left join f on f.invitado_id = i.id
  left join m on m.invitado_id = i.id
  left join mi on mi.invitado_id = i.id
  left join b on b.invitado_id = i.id
  left join tr on tr.invitado_id = i.id
  where i.evento_id = p_evento and not i.bloqueado and es_miembro(p_evento)
  order by puntos desc, i.nombre;
$$;

commit;
