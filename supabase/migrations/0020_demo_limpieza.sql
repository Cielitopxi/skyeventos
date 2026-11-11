-- SkyEventos — la demo pública se limpia sola
-- Lo que suben los visitantes de /demo se borra a las 24 h (lo hace limpiar-vencidos cada noche).
-- Los invitados de muestra (las fotos lindas de la demo) se anotan acá y nunca se borran.
-- Es una tabla aparte, sin políticas: un invitado no puede marcarse a sí mismo como fijo.

create table if not exists public.demo_fijos (
  invitado_id uuid primary key references public.invitados(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.demo_fijos enable row level security;
revoke all on public.demo_fijos from anon, authenticated;

-- Al aplicar: quedan fijos los invitados que ya están en la demo. Si alguno es de prueba,
-- se borra de esta tabla antes de que corra la limpieza.
insert into public.demo_fijos (invitado_id)
select i.id from public.invitados i join public.eventos e on e.id = i.evento_id
where e.es_demo
on conflict do nothing;
