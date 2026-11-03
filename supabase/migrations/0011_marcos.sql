-- Marco de foto instantánea, opcional y elegido por quien sube la foto (los clips no llevan).
-- La foto original no se modifica: el marco se dibuja al mostrarla (galería, pantalla, fotolibro).
alter table public.fotos add column if not exists marco text;
alter table public.fotos add constraint fotos_marco_ck check (
  marco is null or (medio = 'foto' and marco in ('blanco', 'negro', 'crema'))
);
