-- SkyEventos — marca de contenido borrado en eventos vencidos
-- Cada plan promete guardar el contenido `retencion_dias` (expira_at). La Edge Function limpiar-vencidos
-- (programada en 0015) borra del bucket la carpeta {evento}/ y los registros personales: invitados y,
-- en cascada, fotos, mensajes, votos, respuestas, cápsula y emails. El evento y su pago quedan para
-- la historia, en estado 'archivado' y con contenido_borrado_at.

alter table public.eventos add column if not exists contenido_borrado_at timestamptz;
create index if not exists eventos_a_limpiar_idx on public.eventos (expira_at) where contenido_borrado_at is null;

-- El anfitrión no puede tocar la marca de borrado (ni los campos que ya protegía).
create or replace function public.tg_eventos_upd() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not es_admin() then
    new.estado := old.estado; new.owner_id := old.owner_id; new.plan_id := old.plan_id;
    new.codigo := old.codigo; new.expira_at := old.expira_at; new.cerrado_at := old.cerrado_at;
    new.contenido_borrado_at := old.contenido_borrado_at;
  end if;
  return new;
end $$;
