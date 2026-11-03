-- Clips de video y audio de hasta 10 segundos. Viven en la tabla fotos (medio = video|audio)
-- para reutilizar moderación, galería, pantalla, misiones y fotolibro. storage_path es el
-- archivo del clip y thumb_path un JPG (un cuadro del video o la forma de onda del audio).

alter table public.planes add column if not exists clips boolean not null default false;
update public.planes set clips = true where id in ('fiesta', 'premium');

alter table public.fotos add column if not exists medio text not null default 'foto';
alter table public.fotos add column if not exists duracion numeric(4,1);
alter table public.fotos add constraint fotos_medio_ck check (medio in ('foto', 'video', 'audio'));
alter table public.fotos add constraint fotos_duracion_ck check (
  (medio = 'foto' and duracion is null) or (medio <> 'foto' and duracion is not null and duracion > 0 and duracion <= 10.5)
);

-- El bucket acepta los formatos que graban los celulares (hasta 30 MB por archivo).
update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array['image/jpeg','image/png','image/webp',
                               'video/mp4','video/webm','video/quicktime',
                               'audio/mp4','audio/webm','audio/mpeg','audio/ogg','audio/aac','audio/x-m4a','audio/wav']
where id = 'fotos';

create or replace function public.clips_habilitados(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select pl.clips from eventos e join planes pl on pl.id = e.plan_id where e.id = p_evento), false);
$$;

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

-- Página pública del clip (QR del fotolibro impreso): solo clips aprobados que van en el libro.
create or replace function public.clip_publico(p_id uuid)
returns table (storage_path text, thumb_path text, medio text, duracion numeric, caption text, invitado text,
               evento text, titulo text, tematica text, fecha date)
language sql stable security definer set search_path = public as $$
  select f.storage_path, f.thumb_path, f.medio, f.duracion, f.caption, i.nombre, e.nombre,
         nullif(e.personalizacion->>'titulo', ''), e.tematica, e.fecha
  from fotos f join invitados i on i.id = f.invitado_id join eventos e on e.id = f.evento_id
  where f.id = p_id and f.medio <> 'foto' and f.estado = 'aprobada' and f.en_libro;
$$;

-- Quien escanea el QR no es miembro del evento: puede leer ese archivo puntual (y su miniatura).
create or replace function public.clip_archivo_publico(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fotos f
    where (f.storage_path = p_nombre or f.thumb_path = p_nombre) and f.medio <> 'foto' and f.estado = 'aprobada' and f.en_libro
  );
$$;
create index if not exists fotos_storage_path_idx on public.fotos(storage_path);
create index if not exists fotos_thumb_path_idx on public.fotos(thumb_path);
create policy fotos_obj_clip_publico on storage.objects for select to authenticated using (
  bucket_id = 'fotos' and public.clip_archivo_publico(name)
);

revoke execute on function public.clips_habilitados(uuid) from public;
revoke execute on function public.clip_publico(uuid) from public;
revoke execute on function public.clip_archivo_publico(text) from public, anon;
grant execute on function public.clip_archivo_publico(text) to authenticated;
grant execute on function public.clips_habilitados(uuid) to anon, authenticated;
grant execute on function public.clip_publico(uuid) to anon, authenticated;
