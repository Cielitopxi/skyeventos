-- Modo "cámara descartable": cada invitado tiene un rollo con fotos contadas, no puede borrar
-- ni subir de la galería, y nadie ve las fotos (ni las propias) hasta la hora del revelado.
-- El anfitrión ve todo desde el panel y puede ocultar lo que no quiera que se revele.

alter table public.eventos add column if not exists camara_descartable boolean not null default false;
alter table public.eventos add column if not exists fotos_por_invitado smallint not null default 24;
alter table public.eventos add column if not exists revelado_at timestamptz; -- null = automático
alter table public.eventos drop constraint if exists eventos_fotos_por_invitado_ck;
alter table public.eventos add constraint eventos_fotos_por_invitado_ck check (fotos_por_invitado between 1 and 100);

-- Hora del revelado: la elegida por el anfitrión o, si no eligió, el primer mediodía (hora de Argentina)
-- después del fin del evento. Una fiesta que termina a las 4 de la mañana se revela ese mismo día a las 12.
create or replace function public.revelado_de(p_evento uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  ev eventos;
  zona constant text := 'America/Argentina/Buenos_Aires';
  base timestamptz;
  dia date;
  cand timestamptz;
begin
  select * into ev from eventos where id = p_evento;
  if ev.id is null or not ev.camara_descartable then return null; end if;
  if ev.revelado_at is not null then return ev.revelado_at; end if;
  base := coalesce(ev.fin_at, (ev.fecha + time '23:59') at time zone zona, ev.created_at);
  dia := (base at time zone zona)::date;
  cand := (dia + time '12:00') at time zone zona;
  if cand <= base then cand := ((dia + 1) + time '12:00') at time zone zona; end if;
  return cand;
end $$;

create or replace function public.fotos_reveladas(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(now() >= revelado_de(p_evento), true);
$$;

create or replace function public.evento_descartable(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select camara_descartable from eventos where id = p_evento), false);
$$;

revoke execute on function public.revelado_de(uuid) from public, anon;
revoke execute on function public.fotos_reveladas(uuid) from public, anon;
revoke execute on function public.evento_descartable(uuid) from public, anon;
grant execute on function public.revelado_de(uuid) to authenticated;
grant execute on function public.fotos_reveladas(uuid) to authenticated;
grant execute on function public.evento_descartable(uuid) to authenticated;

-- El rollo del invitado: cuántas usó, cuántas tiene y cuándo se revela.
create or replace function public.mi_rollo(p_evento uuid)
returns table (usadas int, total int, revela_at timestamptz)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from fotos f where f.evento_id = p_evento and f.invitado_id = mi_invitado(p_evento)),
         e.fotos_por_invitado::int,
         revelado_de(e.id)
  from eventos e
  where e.id = p_evento and e.camara_descartable and mi_invitado(p_evento) is not null;
$$;
revoke execute on function public.mi_rollo(uuid) from public, anon;
grant execute on function public.mi_rollo(uuid) to authenticated;

-- Al subir: en modo descartable solo fotos, y no más que las del rollo.
create or replace function public.tg_fotos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev eventos; pl planes; total int; mis misiones;
begin
  select * into ev from eventos where id = new.evento_id;
  select * into pl from planes where id = ev.plan_id;
  if new.medio <> 'foto' and not coalesce(pl.clips, false) then
    raise exception 'Los videos y audios están incluidos desde el plan Fiesta';
  end if;
  if new.bingo_id is not null and (not coalesce(pl.misiones, false) or not juego_activo(new.evento_id, 'bingo')
     or not exists (select 1 from bingo_casillas where id = new.bingo_id and evento_id = new.evento_id)) then
    new.bingo_id := null;
  end if;
  if new.mision_id is not null and not juego_activo(new.evento_id, 'misiones') then
    new.mision_id := null;
  end if;
  if es_organizador(new.evento_id) then return new; end if;
  if pl.max_fotos is not null then
    select count(*) into total from fotos where evento_id = new.evento_id;
    if total >= pl.max_fotos then raise exception 'El evento alcanzó el máximo de fotos de su plan'; end if;
  end if;
  if ev.camara_descartable then
    if new.medio <> 'foto' then raise exception 'En modo cámara descartable solo se sacan fotos'; end if;
    -- Un candado por invitado: dos fotos simultáneas no pasan el tope.
    perform pg_advisory_xact_lock(hashtext('rollo:' || new.invitado_id::text));
    select count(*) into total from fotos where evento_id = new.evento_id and invitado_id = new.invitado_id;
    if total >= ev.fotos_por_invitado then
      raise exception 'Se terminó tu rollo: ya usaste tus % fotos', ev.fotos_por_invitado;
    end if;
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
revoke execute on function public.tg_fotos_antes() from public, anon, authenticated;

-- Ver fotos: el anfitrión siempre; los invitados y la pantalla, recién después del revelado.
alter policy fotos_ver on public.fotos using (
  es_organizador(evento_id)
  or (es_miembro(evento_id) and fotos_reveladas(evento_id) and (estado = 'aprobada' or invitado_id = mi_invitado(evento_id)))
);

-- Borrar: en modo descartable una foto sacada no se borra (solo el anfitrión puede).
alter policy fotos_borrar on public.fotos using (
  es_organizador(evento_id) or (invitado_id = mi_invitado(evento_id) and not evento_descartable(evento_id))
);

-- Archivos: las fotos viven en {evento}/{invitado}/archivo. Antes del revelado los invitados no las
-- pueden leer ni listar. La portada ({evento}/portada/…) y la cápsula ({evento}/{invitado}/capsula/…) no cambian.
alter policy fotos_obj_ver on storage.objects using (
  bucket_id = 'fotos'
  and es_miembro(try_uuid((storage.foldername(name))[1]))
  and (
    es_organizador(try_uuid((storage.foldername(name))[1]))
    or fotos_reveladas(try_uuid((storage.foldername(name))[1]))
    or not (array_length(storage.foldername(name), 1) = 2 and (storage.foldername(name))[2] <> 'portada')
  )
);
alter policy fotos_obj_borrar on storage.objects using (
  bucket_id = 'fotos'
  and (
    es_organizador(try_uuid((storage.foldername(name))[1]))
    or ((storage.foldername(name))[2] = mi_invitado(try_uuid((storage.foldername(name))[1]))::text
        and not evento_descartable(try_uuid((storage.foldername(name))[1])))
  )
);

-- evento_por_codigo suma el modo cámara. Cambia lo que devuelve: la versión anterior queda renombrada y sin permisos.
alter function public.evento_por_codigo(text) rename to evento_por_codigo_v2;
revoke execute on function public.evento_por_codigo_v2(text) from public, anon, authenticated;

create function public.evento_por_codigo(p_codigo text)
returns table (id uuid, nombre text, tipo text, tematica text, fecha date, personalizacion jsonb, estado text, abierto boolean,
               premios_activos boolean, inicio_at timestamptz, fin_at timestamptz,
               camara_descartable boolean, fotos_por_invitado int, revelado_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.nombre, e.tipo, e.tematica, e.fecha, e.personalizacion, e.estado, evento_abierto(e.id), e.premios_activos, e.inicio_at, e.fin_at,
         e.camara_descartable, e.fotos_por_invitado::int, revelado_de(e.id)
  from eventos e
  where e.codigo = upper(trim(p_codigo)) and e.estado in ('activo', 'cerrado');
$$;
revoke execute on function public.evento_por_codigo(text) from public;
grant execute on function public.evento_por_codigo(text) to anon, authenticated;
