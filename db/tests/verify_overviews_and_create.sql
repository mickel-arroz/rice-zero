-- Verificación de lo que trae `0002`: la vista de la lista y el alta atómica.
--
-- Corre DESPUÉS de `verify_rls_and_clone.sql`, dentro de la misma transacción,
-- así que hereda su escenario y lo aprovecha en vez de montar otro:
--
--   A (aaaaaaaa-…) → 1 Proyecto, 2 Versiones (la original y su clon),
--                    10 Nodos (5 + 5) y 1 Análisis.
--   B (bbbbbbbb-…) → 1 Proyecto, 1 Versión, 1 Nodo, 0 Análisis.
--
-- Lo que se comprueba aquí no se puede comprobar contra el adaptador en
-- memoria: que la vista hereda RLS y que las dos escrituras del alta van en la
-- misma transacción son garantías del MOTOR.

-- ──────────────────────────────────────────────────────────────────────────
-- Como la usuaria A: la vista cuenta bien, y cuenta lo suyo.
-- ──────────────────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  v_project constant uuid := '11111111-1111-4111-8111-111111111111';
  v_row public.project_overviews;
  v_count integer;
begin
  select count(*) into v_count from public.project_overviews;
  if v_count <> 1 then
    raise exception 'FALLO: A debería ver 1 Proyecto en la vista, ve %.', v_count;
  end if;

  select * into v_row from public.project_overviews where id = v_project;

  -- Las tres cifras salen de tablas distintas y de un lateral cada una. Que
  -- sean 2/10/1 y no 2/20/2 es lo que prueba que los laterales no se
  -- multiplican entre ellos: con un solo `from` encadenando los tres joins,
  -- cada Nodo habría contado una vez por Análisis.
  if v_row.version_count <> 2 then
    raise exception 'FALLO: la vista cuenta % Versiones, se esperaban 2.', v_row.version_count;
  end if;
  if v_row.node_count <> 10 then
    raise exception 'FALLO: la vista cuenta % Nodos, se esperaban 10.', v_row.node_count;
  end if;
  if v_row.analysis_count <> 1 then
    raise exception 'FALLO: la vista cuenta % Análisis, se esperaba 1.', v_row.analysis_count;
  end if;

  -- El icono por defecto lo pone la migración, no el llamante: este Proyecto
  -- lo creó `verify_rls_and_clone.sql`, que no sabe que la columna existe.
  if v_row.icon <> 'node' then
    raise exception 'FALLO: el icono por defecto es «%», se esperaba «node».', v_row.icon;
  end if;

  if v_row.last_activity_at is null then
    raise exception 'FALLO: la última actividad no puede ser nula.';
  end if;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- La última actividad se mueve al editar un NODO
--
-- Es la razón de ser de la columna calculada: `touch_updated_at` es un trigger
-- por tabla, así que tocar un Nodo no toca `projects.updated_at`. Si la vista
-- leyera esa columna, la lista se quedaría congelada mientras el usuario
-- trabaja — que es exactamente el bug que este bloque impide que vuelva.
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_project constant uuid := '11111111-1111-4111-8111-111111111111';
  v_version constant uuid := '22222222-2222-4222-8222-222222222222';
  v_futuro constant timestamptz := now() + interval '1 hour';
  v_actividad timestamptz;
  v_proyecto_tocado timestamptz;
begin
  -- La marca se pone a mano en el INSERT, y no se provoca con un UPDATE, por
  -- una razón del motor: dentro de una transacción `now()` no avanza, así que
  -- `touch_updated_at` escribiría la MISMA marca que ya tienen todas las filas
  -- y la comprobación pasaría sin haber probado nada. `nodes` solo tiene
  -- trigger de update, así que en el insert el valor entra tal cual.
  insert into public.nodes (version_id, content, updated_at)
  values (v_version, 'Nodo recién tocado', v_futuro);

  select last_activity_at into v_actividad
    from public.project_overviews where id = v_project;
  select updated_at into v_proyecto_tocado
    from public.projects where id = v_project;

  if v_actividad <> v_futuro then
    raise exception 'FALLO: la última actividad es %, se esperaba la del Nodo (%).',
      v_actividad, v_futuro;
  end if;

  -- Y el contraejemplo: la columna del Proyecto NO se ha movido. Sin esto, el
  -- bloque pasaría igual el día que alguien añadiera un trigger de propagación
  -- sobre `nodes` — que es la solución que el ticket descarta a propósito,
  -- porque el Autoguardado escribiría en el Proyecto una vez por pulsación.
  if v_proyecto_tocado >= v_actividad then
    raise exception 'FALLO: editar un Nodo tocó projects.updated_at; el trigger es por tabla.';
  end if;

  -- Se deshace para que las cifras de más abajo sigan siendo las del escenario.
  delete from public.nodes where content = 'Nodo recién tocado';
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- El alta: un Proyecto nunca existe sin su Versión inicial
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_project public.projects;
  v_count integer;
  v_number integer;
begin
  select * into v_project
    from public.create_project_with_version('  Idea nueva  ', '   ', 'rocket');

  if v_project.owner_id is distinct from (select app.current_user_id()) then
    raise exception 'FALLO: el alta no atribuyó el Proyecto a la sesión.';
  end if;
  if v_project.icon <> 'rocket' then
    raise exception 'FALLO: el alta guardó el icono «%».', v_project.icon;
  end if;
  -- Una descripción en blanco es lo mismo que sin descripción.
  if v_project.description is not null then
    raise exception 'FALLO: una descripción en blanco debería quedar nula, quedó «%».',
      v_project.description;
  end if;

  select count(*), min(version_number) into v_count, v_number
    from public.project_versions where project_id = v_project.id;
  if v_count <> 1 then
    raise exception 'FALLO: el Proyecto nació con % Versiones, se esperaba 1.', v_count;
  end if;
  if v_number <> 1 then
    raise exception 'FALLO: la Versión inicial es la número %, se esperaba 1.', v_number;
  end if;

  -- Sin icono, el nodo cero.
  select * into v_project from public.create_project_with_version('Sin icono');
  if v_project.icon <> 'node' then
    raise exception 'FALLO: sin icono debería quedar «node», quedó «%».', v_project.icon;
  end if;
end;
$$;

-- Un alta que falla no deja medio Proyecto: las dos escrituras van juntas.
do $$
declare
  v_count integer;
begin
  begin
    perform public.create_project_with_version(repeat('x', 300));
    raise exception 'FALLO: un título de 300 caracteres debería rechazarse.';
  exception
    when check_violation then null;
  end;

  select count(*) into v_count
    from public.projects where title = repeat('x', 300);
  if v_count <> 0 then
    raise exception 'FALLO: el alta fallida dejó % Proyectos huérfanos.', v_count;
  end if;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Como el usuario B: la vista NO es una puerta trasera
--
-- Es la comprobación que justifica `security_invoker = true`. Sin esa opción
-- la vista leería con los permisos de su dueño —que tiene BYPASSRLS— y B vería
-- los Proyectos de A con todas sus métricas. RLS en las tablas no basta cuando
-- hay una vista delante.
-- ──────────────────────────────────────────────────────────────────────────

set local request.jwt.claims to
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

do $$
declare
  v_row public.project_overviews;
  v_count integer;
begin
  select count(*) into v_count from public.project_overviews;
  if v_count <> 1 then
    raise exception 'FALLO: B debería ver 1 Proyecto en la vista, ve %.', v_count;
  end if;

  select * into v_row from public.project_overviews;
  if v_row.title <> 'Proyecto de B' then
    raise exception 'FALLO: B ve «%» en la vista.', v_row.title;
  end if;

  -- Y las métricas también son las suyas: 1 Versión, 1 Nodo, 0 Análisis.
  if (v_row.version_count, v_row.node_count, v_row.analysis_count) <> (1, 1, 0) then
    raise exception 'FALLO: las métricas de B son %/%/%.',
      v_row.version_count, v_row.node_count, v_row.analysis_count;
  end if;

  -- La vista es de solo lectura: escribir se escribe en las tablas. Dos
  -- códigos y no uno porque hay dos cerrojos, y cualquiera de los dos vale:
  -- el `grant` es solo de select (42501) y, además, una vista con agregados no
  -- es actualizable automáticamente (55000, que es el que contesta este motor).
  begin
    update public.project_overviews set title = 'Por la puerta de atrás';
    raise exception 'FALLO: se pudo escribir a través de la vista.';
  exception
    when insufficient_privilege or object_not_in_prerequisite_state then null;
  end;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Sin sesión, tampoco por aquí
-- ──────────────────────────────────────────────────────────────────────────

reset role;

do $$
declare
  v_anon constant text := app.anonymous_role();
  v_count integer;
begin
  execute format('set local role %I', v_anon);

  begin
    select count(*) into v_count from public.project_overviews;
    raise exception 'FALLO: un visitante anónimo (%) leyó la vista (vio % filas).',
      v_anon, v_count;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
declare
  v_anon constant text := app.anonymous_role();
begin
  if has_function_privilege(
       v_anon, 'public.create_project_with_version(text, text, text)', 'execute') then
    raise exception 'FALLO: el rol % puede dar de alta Proyectos.', v_anon;
  end if;

  -- Control positivo: quien sí tiene sesión llega a las dos cosas nuevas.
  if not has_function_privilege(
       'authenticated', 'public.create_project_with_version(text, text, text)', 'execute') then
    raise exception 'FALLO: authenticated no puede ejecutar create_project_with_version.';
  end if;
  if not has_table_privilege('authenticated', 'public.project_overviews', 'select') then
    raise exception 'FALLO: authenticated no puede leer project_overviews.';
  end if;
end;
$$;

select 'verificacion_0002_ok' as resultado;
