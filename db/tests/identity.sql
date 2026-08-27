-- La identidad, durante la verificación.
--
-- Comprueba que `app.current_user_id()` de producción tiene la forma que las
-- políticas necesitan, y después la sustituye por una que lee los claims de la
-- sesión. Corre dentro de la transacción que el runner rueda atrás, así que la
-- sustitución no sale de la verificación.
--
-- Por qué se sustituye: en producción el id del usuario sale de un JWT firmado
-- —`auth.uid()` sobre `pg_session_jwt` en Neon, Supabase Auth en Supabase—, y
-- desde psql no hay JWT que presentar. Los dos motores tienen un modo de
-- compatibilidad que lee `request.jwt.claims`, pero es un modo de reserva que
-- depende de si hay JWKS configurado y del estado del cómputo: apoyarse en él
-- hacía que esta verificación fallara de forma intermitente.
--
-- Qué se pierde: que la función real resuelva bien la identidad. Eso no es
-- comprobable desde aquí de ninguna manera, así que en su lugar se comprueba lo
-- que sí es comprobable —su firma, su tipo de retorno, que sea `security
-- definer` y quién puede ejecutarla—, que es exactamente lo que un preludio
-- puede romper.
--
-- Qué se conserva: todo lo demás. Las 12 políticas, los dos helpers `security
-- definer`, el constraint trigger diferido, el trigger de numeración y la RPC
-- de clonado se ejercitan contra el motor real, tal cual están.

do $$
declare
  v_secdef boolean;
  v_volatile "char";
  v_returns oid;
begin
  select p.prosecdef, p.provolatile, p.prorettype
    into v_secdef, v_volatile, v_returns
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and p.proname = 'current_user_id'
     and p.pronargs = 0;

  if not found then
    raise exception 'FALLO: el preludio no definió app.current_user_id().';
  end if;

  if v_returns <> 'uuid'::regtype then
    raise exception 'FALLO: app.current_user_id() devuelve %, y las políticas comparan con uuid.',
      format_type(v_returns, null);
  end if;

  -- `security definer` no es decorativo: en Neon el rol `authenticated` no
  -- tiene USAGE sobre el esquema `auth`, así que sin esto toda política que
  -- resuelva la identidad falla con 42501 en cuanto la evalúa el Data API.
  if not v_secdef then
    raise exception 'FALLO: app.current_user_id() debe ser security definer.';
  end if;

  -- `stable` permite a Postgres evaluarla una vez por consulta en lugar de una
  -- vez por fila. Con 12 políticas encima, la diferencia no es cosmética.
  if v_volatile <> 's' then
    raise exception 'FALLO: app.current_user_id() debe ser stable, es %.', v_volatile;
  end if;

  if not has_function_privilege('authenticated', 'app.current_user_id()', 'execute') then
    raise exception 'FALLO: authenticated no puede ejecutar app.current_user_id().';
  end if;

  if has_function_privilege(app.anonymous_role(), 'app.current_user_id()', 'execute') then
    raise exception 'FALLO: el rol % puede ejecutar app.current_user_id().', app.anonymous_role();
  end if;
end;
$$;

-- El sustituto. `create or replace` conserva dueño y privilegios, así que
-- `authenticated` sigue pudiendo ejecutarla y el rol anónimo sigue sin poder.
--
-- `security invoker` a propósito: leer un GUC de sesión no necesita los
-- privilegios del dueño, y así el sustituto no puede colarse ningún permiso que
-- la función real no tenga.
create or replace function app.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid;
$$;
