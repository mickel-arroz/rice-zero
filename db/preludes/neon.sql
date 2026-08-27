-- Preludio de Neon.
--
-- Lo que la migración compartida (`db/migrations/`) no puede saber por sí
-- sola: de dónde sale la identidad del usuario, dónde vive la tabla de
-- usuarios y cómo se llama el rol anónimo. Se aplica ANTES de la migración.
--
-- Cambiar de Proveedor de Backend es cambiar de preludio. La migración no se
-- toca.

create schema if not exists app;

-- `authenticated` y `anonymous` son los dos roles del Data API de Neon.
grant usage on schema app to authenticated, anonymous;

-- ──────────────────────────────────────────────────────────────────────────
-- Identidad
--
-- `pg_session_jwt` expone `auth.uid()` con firma `() -> uuid`, que es
-- exactamente lo que las políticas necesitan. Pero `authenticated` NO tiene
-- USAGE sobre el esquema `auth` en Neon: una política que llame a `auth.uid()`
-- en línea falla con «permission denied for schema auth» (42501) en cuanto la
-- evalúa el rol del Data API.
--
-- De ahí el `security definer`: la función corre como su dueño, que sí ve
-- `auth`, y las políticas solo necesitan EXECUTE sobre ella. Es la razón por
-- la que este envoltorio no es decorativo.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function app.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

comment on function app.current_user_id() is
  'Id del usuario de la sesión. En Neon, el claim `sub` del JWT que valida pg_session_jwt.';

-- ──────────────────────────────────────────────────────────────────────────
-- Metadatos que la migración consulta
--
-- Devuelven texto porque la migración los interpola en DDL dinámico: no hay
-- forma de parametrizar el destino de una FK ni el nombre de un rol en un
-- `revoke`.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function app.users_table()
returns text
language sql
immutable
set search_path = ''
as $$
  -- Entrecomillada a propósito: `user` es palabra reservada en Postgres y sin
  -- comillas el `alter table ... add foreign key` falla.
  select 'neon_auth."user"';
$$;

create or replace function app.anonymous_role()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'anonymous';
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Privilegios
-- ──────────────────────────────────────────────────────────────────────────

revoke execute on function app.current_user_id() from public;
grant execute on function app.current_user_id() to authenticated;

-- Solo las lee la migración, que corre como dueño de la base.
revoke execute on function app.users_table() from public;
revoke execute on function app.anonymous_role() from public;
