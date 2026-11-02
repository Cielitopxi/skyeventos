-- SkyEventos — correcciones de los advisors de Supabase (security + performance)
-- Sin drops: solo alter/revoke/grant/create index, idempotente.

begin;

-- ─────────── Security: search_path fijo (0011_function_search_path_mutable) ───────────
alter function public.try_uuid(text) set search_path = '';

-- ─────────── Security: EXECUTE de funciones SECURITY DEFINER (0028/0029) ───────────
-- Supabase da EXECUTE a PUBLIC/anon por defecto. Nadie sin sesión necesita estas funciones:
-- invitados y pantallas entran con sesión anónima, que usa el rol authenticated.

-- Triggers: no se llaman por RPC (EXECUTE solo se valida al crear el trigger).
revoke execute on function public.tg_fotos_antes() from public, anon, authenticated;
revoke execute on function public.tg_mensajes_antes() from public, anon, authenticated;
revoke execute on function public.tg_eventos_despues() from public, anon, authenticated;
revoke execute on function public.tg_invitados_upd() from public, anon, authenticated;
revoke execute on function public.tg_eventos_upd() from public, anon, authenticated;

-- RPC y helpers de RLS: solo con sesión.
revoke execute on function public.activar_evento(uuid, text) from public, anon;
revoke execute on function public.crear_evento(text, text, text, text, date, jsonb) from public, anon;
revoke execute on function public.cerrar_evento(uuid, boolean) from public, anon;
revoke execute on function public.unirse_evento(text, text, text) from public, anon;
revoke execute on function public.unirse_pantalla(text, text) from public, anon;
revoke execute on function public.ranking(uuid) from public, anon;
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.es_organizador(uuid) from public, anon;
revoke execute on function public.es_miembro(uuid) from public, anon;
revoke execute on function public.mi_invitado(uuid) from public, anon;
revoke execute on function public.evento_abierto(uuid) from public, anon;
revoke execute on function public.generar_codigo() from public, anon, authenticated;

grant execute on function public.activar_evento(uuid, text) to authenticated, service_role;
grant execute on function public.crear_evento(text, text, text, text, date, jsonb) to authenticated;
grant execute on function public.cerrar_evento(uuid, boolean) to authenticated;
grant execute on function public.unirse_evento(text, text, text) to authenticated;
grant execute on function public.unirse_pantalla(text, text) to authenticated;
grant execute on function public.ranking(uuid) to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_organizador(uuid) to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;
grant execute on function public.mi_invitado(uuid) to authenticated;
grant execute on function public.evento_abierto(uuid) to authenticated;
-- evento_por_codigo sigue pública (pantalla de ingreso sin login). try_uuid es invoker e inocua.

-- Las políticas que usan esos helpers pasan a aplicar solo a authenticated
-- (anon ve vacío en vez de "permission denied for function"). planes_ver sigue pública.
alter policy admins_ver on public.admins to authenticated using (user_id = (select auth.uid()));
alter policy eventos_ver on public.eventos to authenticated;
alter policy eventos_editar on public.eventos to authenticated;
alter policy organizadores_ver on public.organizadores to authenticated;
alter policy pedidos_ver on public.pedidos to authenticated using (owner_id = (select auth.uid()) or es_admin());
alter policy invitados_ver on public.invitados to authenticated;
alter policy invitados_editar on public.invitados to authenticated
  using (user_id = (select auth.uid()) or es_organizador(evento_id))
  with check (user_id = (select auth.uid()) or es_organizador(evento_id));
alter policy pantallas_ver on public.pantallas to authenticated
  using (es_organizador(evento_id) or user_id = (select auth.uid()));
alter policy misiones_ver on public.misiones to authenticated;
alter policy misiones_admin on public.misiones to authenticated;
alter policy fotos_ver on public.fotos to authenticated;
alter policy fotos_subir on public.fotos to authenticated;
alter policy fotos_moderar on public.fotos to authenticated;
alter policy fotos_borrar on public.fotos to authenticated;
alter policy mensajes_ver on public.mensajes to authenticated;
alter policy mensajes_crear on public.mensajes to authenticated;
alter policy mensajes_moderar on public.mensajes to authenticated;
alter policy mensajes_borrar on public.mensajes to authenticated;
alter policy premios_ver on public.premios to authenticated;
alter policy premios_admin on public.premios to authenticated;
alter policy anuncios_ver on public.anuncios to authenticated;
alter policy anuncios_crear on public.anuncios to authenticated;
alter policy fotos_obj_ver on storage.objects to authenticated;
alter policy fotos_obj_subir on storage.objects to authenticated;
alter policy fotos_obj_borrar on storage.objects to authenticated;

-- ─────────── Performance: índices para FKs (0001_unindexed_foreign_keys) ───────────
create index if not exists anuncios_evento_idx on public.anuncios(evento_id);
create index if not exists eventos_plan_idx on public.eventos(plan_id);
create index if not exists fotos_invitado_idx on public.fotos(invitado_id);
create index if not exists fotos_mision_idx on public.fotos(mision_id);
create index if not exists invitados_user_idx on public.invitados(user_id);
create index if not exists mensajes_invitado_idx on public.mensajes(invitado_id);
create index if not exists misiones_evento_idx on public.misiones(evento_id);
create index if not exists organizadores_user_idx on public.organizadores(user_id);
create index if not exists pantallas_user_idx on public.pantallas(user_id);
create index if not exists pedidos_evento_idx on public.pedidos(evento_id);
create index if not exists pedidos_owner_idx on public.pedidos(owner_id);
create index if not exists pedidos_plan_idx on public.pedidos(plan_id);
create index if not exists premios_evento_idx on public.premios(evento_id);

commit;
