-- Aviso de cápsula a los 11 meses: pg_cron encola una vez por día los eventos Premium
-- cuya cápsula ya se puede abrir. El mail lo manda la función avisos-capsula (Resend),
-- que se puede programar aparte; mientras tanto el organizador ve el aviso en su panel.
-- Fuera de test:db porque PGlite no trae pg_cron.
create extension if not exists pg_cron;

select cron.schedule(
  'encolar-avisos-capsula',
  '0 12 * * *', -- 9:00 en Argentina
  $$select public.encolar_avisos_capsula()$$
);
