-- SkyEventos — la política de invitados_contacto evalúa auth.uid() una sola vez por consulta
-- (advisor auth_rls_initplan), no una vez por fila.
alter policy invitados_contacto_ver on public.invitados_contacto using (
  es_organizador(evento_id)
  or exists (select 1 from invitados i where i.id = invitado_id and i.user_id = (select auth.uid()))
);
