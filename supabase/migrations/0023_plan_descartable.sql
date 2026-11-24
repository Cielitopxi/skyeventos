-- Plan "Descartable": el más accesible. Sin pantalla en vivo; cada invitado tiene un rollo y las fotos
-- se revelan al día siguiente. Un evento con este plan queda siempre en modo cámara descartable.
-- El precio y los topes se cambian desde /admin → Planes.

alter table public.planes add column if not exists solo_descartable boolean not null default false;

insert into public.planes (id, nombre, precio_ars, max_invitados, max_fotos, pantallas, retencion_dias, misiones, sin_marca, orden,
                           activo, capsula, portada_personalizada, clips, solo_descartable)
values ('descartable', 'Descartable', 45000, 80, 3000, 0, 30, false, false, 0,
        true, false, false, false, true)
on conflict (id) do nothing;

-- Si el plan es "solo descartable", el modo no se puede apagar (ni al crear ni al editar).
create or replace function public.tg_eventos_descartable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from planes where id = new.plan_id and solo_descartable) then
    new.camara_descartable := true;
  end if;
  return new;
end $$;
revoke execute on function public.tg_eventos_descartable() from public, anon, authenticated;

drop trigger if exists eventos_descartable on public.eventos;
create trigger eventos_descartable before insert or update on public.eventos
  for each row execute function public.tg_eventos_descartable();
