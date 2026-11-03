-- SkyEventos — ejecución diaria de limpiar-vencidos
-- pg_cron llama a la Edge Function con el header x-limpieza-clave; la función lo valida contra Vault.
-- La clave se genera acá y vive solo en Vault: nadie la copia a mano.
-- Fuera de test:db: usa Vault, pg_net y pg_cron (PGlite no los trae).
-- Aplicar DESPUÉS de desplegar la función (supabase functions deploy limpiar-vencidos --no-verify-jwt).

select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'limpieza_clave', 'Clave de la Edge Function limpiar-vencidos')
where not exists (select 1 from vault.secrets where name = 'limpieza_clave');

-- Solo la puede ejecutar service_role (la Edge Function).
create or replace function public.limpieza_clave_ok(p_clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_clave, '') <> '' and exists (
    select 1 from vault.decrypted_secrets where name = 'limpieza_clave' and decrypted_secret = p_clave
  );
$$;
revoke execute on function public.limpieza_clave_ok(text) from public, anon, authenticated;
grant execute on function public.limpieza_clave_ok(text) to service_role;

create extension if not exists pg_net;

-- 06:00 UTC = 03:00 en Argentina, fuera del horario de fiestas.
select cron.schedule(
  'limpiar-eventos-vencidos',
  '0 6 * * *',
  $$select net.http_post(
      url := 'https://ryxgalarjcrlwecxishb.supabase.co/functions/v1/limpiar-vencidos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-limpieza-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'limpieza_clave')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
  )$$
);
