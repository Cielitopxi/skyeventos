-- SkyEventos — códigos de descuento, tarjetas de regalo y fotolibro compartido
--
-- Cupones: los crea el admin (porcentaje o monto fijo) o nacen de una compra de regalo (tipo 'regalo',
-- su valor es lo que se pagó). Se aplican al pedido pendiente de un evento con aplicar_cupon; si el total
-- queda en 0, el evento se activa sin pasar por Mercado Pago.
-- Regalos: quien regala paga un plan (pedidos_regalo) y recibe un código de un solo uso para compartir.
-- Libro compartido: el anfitrión genera un link público (libro_token) para mostrar el fotolibro en redes.

begin;

-- ───────────── Cupones ─────────────
create table if not exists public.cupones (
  codigo text primary key check (codigo ~ '^[A-Z0-9-]{4,24}$'),
  tipo text not null check (tipo in ('porcentaje', 'monto', 'regalo')),
  valor numeric not null check (valor > 0),
  plan_id text references public.planes(id),          -- si está, solo vale para ese plan (no aplica a regalos)
  usos_max int check (usos_max is null or usos_max > 0), -- null = ilimitado
  usos int not null default 0,
  vence_at timestamptz,
  activo boolean not null default true,
  nota text,
  comprador_id uuid references auth.users(id) on delete set null, -- regalos: quién lo compró
  para text,                                                       -- regalos: a quién va dirigido
  mensaje text,                                                    -- regalos: dedicatoria
  created_at timestamptz not null default now(),
  check (tipo <> 'porcentaje' or valor <= 100)
);
alter table public.cupones enable row level security;
create policy cupones_admin on public.cupones for all using (es_admin()) with check (es_admin());
create policy cupones_comprador on public.cupones for select using (comprador_id = (select auth.uid()));
grant select, insert, update on public.cupones to authenticated;

alter table public.pedidos add column if not exists cupon text references public.cupones(codigo);
alter table public.pedidos add column if not exists monto_lista numeric; -- precio antes del descuento

-- ───────────── Compras de regalo ─────────────
create table if not exists public.pedidos_regalo (
  id uuid primary key default gen_random_uuid(),
  cupon text not null unique references public.cupones(codigo),
  owner_id uuid not null references auth.users(id),
  plan_id text not null references public.planes(id),
  monto numeric not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  pagado_at timestamptz
);
alter table public.pedidos_regalo enable row level security;
create policy pedidos_regalo_ver on public.pedidos_regalo for select using (owner_id = (select auth.uid()) or es_admin());
grant select on public.pedidos_regalo to authenticated;

/** Normaliza un código: mayúsculas, sin espacios. */
create or replace function public.normalizar_codigo(p text) returns text
language sql immutable set search_path = public as $$ select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) $$;

/** Calcula el descuento de un código para un plan, sin aplicarlo (para mostrarlo antes de pagar). */
create or replace function public.cupon_evaluar(p_codigo text, p_plan text)
returns table (valido boolean, mensaje text, codigo text, precio numeric, descuento numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  c cupones;
  pl planes;
  d numeric;
begin
  select * into pl from planes where id = p_plan and activo;
  if pl.id is null then return query select false, 'Plan inexistente', null::text, null::numeric, null::numeric, null::numeric; return; end if;
  select * into c from cupones where cupones.codigo = normalizar_codigo(p_codigo);
  if c.codigo is null or not c.activo then
    return query select false, 'El código no existe o no está activo', null::text, pl.precio_ars, 0::numeric, pl.precio_ars; return;
  end if;
  if c.vence_at is not null and c.vence_at < now() then
    return query select false, 'El código venció', c.codigo, pl.precio_ars, 0::numeric, pl.precio_ars; return;
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    return query select false, 'El código ya se usó', c.codigo, pl.precio_ars, 0::numeric, pl.precio_ars; return;
  end if;
  if c.tipo <> 'regalo' and c.plan_id is not null and c.plan_id <> p_plan then
    return query select false, 'El código no vale para este plan', c.codigo, pl.precio_ars, 0::numeric, pl.precio_ars; return;
  end if;
  d := case c.tipo when 'porcentaje' then round(pl.precio_ars * c.valor / 100) else least(c.valor, pl.precio_ars) end;
  return query select true,
    case when c.tipo = 'regalo' then 'Tarjeta de regalo aplicada' else 'Descuento aplicado' end,
    c.codigo, pl.precio_ars, d, pl.precio_ars - d;
end $$;

/** Aplica un código al pedido pendiente del evento. Si el total queda en 0, activa el evento. */
create or replace function public.aplicar_cupon(p_evento uuid, p_codigo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ped pedidos;
  ev eventos;
  r record;
  ret int;
begin
  select * into ev from eventos where id = p_evento;
  if ev.id is null or ev.owner_id is distinct from auth.uid() then raise exception 'No autorizado'; end if;
  select * into ped from pedidos where evento_id = p_evento and estado = 'pendiente' for update;
  if ped.id is null then raise exception 'No hay un pago pendiente para este evento'; end if;
  if ped.cupon is not null then raise exception 'Este evento ya tiene un código aplicado'; end if;

  perform 1 from cupones where codigo = normalizar_codigo(p_codigo) for update; -- evita dos usos simultáneos
  select * into r from cupon_evaluar(p_codigo, ped.plan_id);
  if not r.valido then raise exception '%', r.mensaje; end if;

  update cupones set usos = usos + 1 where codigo = r.codigo;
  update pedidos set cupon = r.codigo, monto_lista = r.precio, monto = r.total where id = ped.id;

  if r.total <= 0 then
    select pl.retencion_dias into ret from planes pl where pl.id = ev.plan_id;
    update eventos set estado = 'activo', expira_at = coalesce(fecha, current_date)::timestamptz + make_interval(days => ret)
     where id = p_evento and estado = 'pendiente_pago';
    update pedidos set estado = 'aprobado', pagado_at = now(), mp_payment_id = 'cupon:' || r.codigo where id = ped.id;
  end if;
  return jsonb_build_object('codigo', r.codigo, 'descuento', r.descuento, 'total', r.total, 'activado', r.total <= 0);
end $$;

/** Compra de regalo: crea el código (inactivo hasta que se paga) y el pedido para Mercado Pago. */
create or replace function public.crear_regalo(p_plan text, p_para text, p_mensaje text default null)
returns public.pedidos_regalo
language plpgsql security definer set search_path = public as $$
declare
  pl planes;
  cod text;
  pr pedidos_regalo;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Necesitás iniciar sesión para regalar';
  end if;
  select * into pl from planes where id = p_plan and activo;
  if pl.id is null then raise exception 'Plan inexistente'; end if;
  if length(trim(coalesce(p_para, ''))) < 2 then raise exception 'Contanos para quién es el regalo'; end if;
  loop
    cod := 'REGALO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from cupones where codigo = cod);
  end loop;
  insert into cupones (codigo, tipo, valor, plan_id, usos_max, activo, nota, comprador_id, para, mensaje)
  values (cod, 'regalo', pl.precio_ars, pl.id, 1, false, 'Regalo ' || pl.nombre, auth.uid(), left(trim(p_para), 80), left(trim(p_mensaje), 400));
  insert into pedidos_regalo (cupon, owner_id, plan_id, monto) values (cod, auth.uid(), pl.id, pl.precio_ars)
  returning * into pr;
  return pr;
end $$;

/** Marca pagado un regalo y activa su código (webhook de Mercado Pago o admin). */
create or replace function public.activar_regalo(p_pedido uuid, p_payment_id text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  pr pedidos_regalo;
begin
  if not (auth.role() = 'service_role' or es_admin()) then raise exception 'No autorizado'; end if;
  update pedidos_regalo set estado = 'aprobado', pagado_at = coalesce(pagado_at, now()), mp_payment_id = coalesce(p_payment_id, mp_payment_id)
   where id = p_pedido returning * into pr;
  if pr.id is null then raise exception 'Regalo inexistente'; end if;
  update cupones set activo = true where codigo = pr.cupon;
end $$;

-- ───────────── Fotolibro compartido ─────────────
alter table public.eventos add column if not exists libro_token uuid unique;

-- El token solo lo cambia compartir_libro (el anfitrión no puede elegir uno a mano).
create or replace function public.tg_eventos_upd()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not es_admin() then
    new.estado := old.estado; new.owner_id := old.owner_id; new.plan_id := old.plan_id;
    new.codigo := old.codigo; new.expira_at := old.expira_at; new.cerrado_at := old.cerrado_at;
    new.contenido_borrado_at := old.contenido_borrado_at; new.libro_token := old.libro_token;
  end if;
  return new;
end $$;

/** Activa o desactiva el link público del fotolibro. Devuelve el token (null si se desactivó). */
create or replace function public.compartir_libro(p_evento uuid, p_activo boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not es_organizador(p_evento) then raise exception 'No autorizado'; end if;
  update eventos set libro_token = case when p_activo then coalesce(libro_token, gen_random_uuid()) else null end
   where id = p_evento returning libro_token into t;
  return t;
end $$;

/** Todo lo que necesita la página pública del fotolibro. Solo lo aprobado y marcado para el libro. */
create or replace function public.libro_compartido(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'evento', jsonb_build_object('id', e.id, 'nombre', e.nombre, 'tipo', e.tipo, 'tematica', e.tematica, 'fecha', e.fecha,
                                 'plan_id', e.plan_id, 'premios_activos', false, 'personalizacion', e.personalizacion),
    'invitados', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'mesa', i.mesa) order by i.nombre)
                           from invitados i where i.evento_id = e.id and not i.bloqueado), '[]'),
    'fotos', coalesce((select jsonb_agg(to_jsonb(f) - 'mision_id' - 'bingo_id' order by f.created_at)
                       from fotos f where f.evento_id = e.id and f.estado = 'aprobada' and f.en_libro), '[]'),
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'invitado_id', m.invitado_id, 'tipo', m.tipo, 'texto', m.texto, 'created_at', m.created_at) order by m.created_at)
                          from mensajes m where m.evento_id = e.id and m.estado = 'aprobada' and m.en_libro), '[]')
  )
  from eventos e
  where e.libro_token = p_token and e.contenido_borrado_at is null;
$$;

/** Archivos que se pueden ver sin sesión porque están en un fotolibro compartido. */
create or replace function public.libro_archivo_publico(p_nombre text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fotos f join eventos e on e.id = f.evento_id
    where e.libro_token is not null and f.estado = 'aprobada' and f.en_libro
      and (f.storage_path = p_nombre or f.thumb_path = p_nombre)
  ) or exists (
    select 1 from eventos e where e.libro_token is not null and e.personalizacion ->> 'portada_path' = p_nombre
  );
$$;

create policy fotos_obj_libro_publico on storage.objects for select using (bucket_id = 'fotos' and libro_archivo_publico(name));

-- Permisos
revoke execute on function public.cupon_evaluar(text, text) from public, anon;
revoke execute on function public.aplicar_cupon(uuid, text) from public, anon;
revoke execute on function public.crear_regalo(text, text, text) from public, anon;
revoke execute on function public.activar_regalo(uuid, text) from public, anon;
revoke execute on function public.compartir_libro(uuid, boolean) from public, anon;
grant execute on function public.cupon_evaluar(text, text) to authenticated;
grant execute on function public.aplicar_cupon(uuid, text) to authenticated;
grant execute on function public.crear_regalo(text, text, text) to authenticated;
grant execute on function public.activar_regalo(uuid, text) to authenticated, service_role;
grant execute on function public.compartir_libro(uuid, boolean) to authenticated;
grant execute on function public.libro_compartido(uuid) to anon, authenticated;
grant execute on function public.libro_archivo_publico(text) to anon, authenticated;

commit;
