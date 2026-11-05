-- SkyEventos — La trivia se completa sola
-- Antes, cada pregunta tenía que abrirse y después revelarse a mano: si el anfitrión no lo hacía, los invitados no
-- veían todas las preguntas creadas y los aciertos no sumaban al ranking. Ahora:
--  * al terminar el horario del evento (o al cerrarlo), todas las preguntas abiertas se dan por reveladas:
--    se ve la respuesta correcta y los aciertos suman puntos;
--  * una pregunta revelada ya no admite respuestas.
-- Abrir todas las preguntas juntas se hace desde el panel (TabTrivia).

begin;

-- ¿Ya se puede mostrar la respuesta correcta? Sin excepción para el organizador: el ranking es igual para todos.
create or replace function public.trivia_revelada(p_estado text, p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_estado = 'cerrada' or exists (
    select 1 from eventos e
    where e.id = p_evento
      and (e.estado in ('cerrado', 'archivado')
           or (e.inicio_at is not null and now() >= coalesce(e.fin_at, e.inicio_at + interval '12 hours')))
  );
$$;
revoke execute on function public.trivia_revelada(text, uuid) from public, anon;
grant execute on function public.trivia_revelada(text, uuid) to authenticated;

alter policy trivia_claves_ver on public.trivia_claves using (
  es_organizador(evento_id)
  or (es_miembro(evento_id) and exists (
        select 1 from trivia_preguntas p where p.id = pregunta_id and p.estado <> 'preparada' and trivia_revelada(p.estado, p.evento_id)))
);

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
  if not juego_activo(pre.evento_id, 'trivia') then raise exception 'La trivia no está activa en este evento'; end if;
  if pre.estado <> 'abierta' then raise exception 'Esta pregunta no está abierta'; end if;
  if trivia_revelada(pre.estado, pre.evento_id) then raise exception 'La trivia ya terminó: la respuesta está revelada'; end if;
  if p_opcion is null or p_opcion < 0 or p_opcion >= array_length(pre.opciones, 1) then raise exception 'Opción inválida'; end if;
  insert into trivia_respuestas (pregunta_id, invitado_id, evento_id, opcion)
  values (pre.id, yo, pre.evento_id, p_opcion)
  on conflict (pregunta_id, invitado_id) do nothing;
  if not found then raise exception 'Ya respondiste esta pregunta'; end if;
end $$;

create or replace function public.trivia_resumen(p_evento uuid)
returns table (pregunta_id uuid, opcion int, respuestas bigint)
language sql stable security definer set search_path = public as $$
  select r.pregunta_id, r.opcion, count(*)
  from trivia_respuestas r join trivia_preguntas p on p.id = r.pregunta_id
  where r.evento_id = p_evento
    and (es_organizador(p_evento) or (p.estado <> 'preparada' and trivia_revelada(p.estado, p_evento) and es_miembro(p_evento)))
  group by 1, 2;
$$;

-- Ranking: misma firma; suma las preguntas reveladas (cerradas a mano o con el evento terminado).
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
    where r.evento_id = p_evento and p.estado <> 'preparada' and trivia_revelada(p.estado, p_evento) and r.opcion = k.correcta
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
