-- Preludio de Supabase.
--
-- Lo que la migración compartida (`db/migrations/`) no puede saber por sí
-- sola: de dónde sale la identidad del usuario, dónde vive la tabla de
-- usuarios y cómo se llama el rol anónimo. Se aplica ANTES de la migración.
--
-- Este proveedor está dormido: el interruptor (`NEXT_PUBLIC_BACKEND`) apunta a
-- Neon. El preludio existe para que volver sea aplicarlo y redesplegar.

create schema if not exists app;

-- `authenticated` y `anon` son los dos roles de PostgREST en Supabase.
grant usage on schema app to authenticated, anon;

-- ──────────────────────────────────────────────────────────────────────────
-- Identidad
--
-- `auth.uid()` de Supabase Auth ya tiene firma `() -> uuid`. El envoltorio
-- `security definer` es el mismo que en Neon: aquí `authenticated` sí ve el
-- esquema `auth`, pero mantenerlo idéntico deja una sola forma de resolver la
-- identidad y una sola función que auditar.
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
  'Id del usuario de la sesión. En Supabase, el claim `sub` del JWT que emite Supabase Auth.';

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
  select 'auth.users';
$$;

create or replace function app.anonymous_role()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'anon';
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Privilegios
-- ──────────────────────────────────────────────────────────────────────────

revoke execute on function app.current_user_id() from public;
grant execute on function app.current_user_id() to authenticated;

-- Solo las lee la migración, que corre como dueño de la base.
revoke execute on function app.users_table() from public;
revoke execute on function app.anonymous_role() from public;
