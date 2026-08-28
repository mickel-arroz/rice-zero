-- Verificación del esquema de RICE(0): RLS owner-only y clonado profundo.
--
-- Compartida por todos los Proveedores de Backend. No nombra a ninguno: la
-- transacción, el alta de los dos usuarios de prueba y el rollback los aporta
-- el runner (`scripts/verify-schema.mjs`), que compone
--
--   preludio → migración → identity.sql → <proveedor>/users.sql → este archivo
--
-- Cómo se ejecuta:  npm run verify:neon  ·  npm run verify:supabase
--
-- No deja rastro: el runner hace `rollback` al final. Si algo no se cumple,
-- aborta con un mensaje que empieza por FALLO. Si termina imprimiendo
-- `verificacion_ok`, las garantías del esquema están comprobadas contra el
-- motor real.
--
-- Los ids son fijos para que el usuario B pueda apuntar al árbol de A sin
-- consultarlo: RLS se lo esconde, y ése es justamente el punto. Un atacante
-- que hubiera filtrado los ids por otro medio tampoco llegaría a los datos.

-- ──────────────────────────────────────────────────────────────────────────
-- Como la usuaria A: un árbol de 5 Nodos, 2 raíces y 3 niveles de fondo.
-- ──────────────────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
begin
  insert into public.projects (id, owner_id, title, description)
  values (
    '11111111-1111-4111-8111-111111111111',
    (select app.current_user_id()),
    'Proyecto de verificación',
    'Se borra con el rollback.'
  );

  insert into public.project_versions (id, project_id, label)
  values (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Original'
  );

  if (
    select version_number from public.project_versions
     where id = '22222222-2222-4222-8222-222222222222'
  ) <> 1 then
    raise exception 'FALLO: la primera Versión de un Proyecto debería ser la número 1.';
  end if;

  insert into public.nodes (id, version_id, parent_id, content, order_index)
  values
    ('33333333-3333-4333-8333-333333333331',
     '22222222-2222-4222-8222-222222222222', null, 'Raíz 1', 0),
    ('33333333-3333-4333-8333-333333333332',
     '22222222-2222-4222-8222-222222222222',
     '33333333-3333-4333-8333-333333333331', 'Hijo 1.1', 0),
    ('33333333-3333-4333-8333-333333333333',
     '22222222-2222-4222-8222-222222222222',
     '33333333-3333-4333-8333-333333333332', 'Nieto 1.1.1', 0),
    ('33333333-3333-4333-8333-333333333334',
     '22222222-2222-4222-8222-222222222222',
     '33333333-3333-4333-8333-333333333331', 'Hijo 1.2', 1),
    ('33333333-3333-4333-8333-333333333335',
     '22222222-2222-4222-8222-222222222222', null, 'Raíz 2', 1);

  insert into public.ai_analyses (version_id, provider, model, summary, master_prompt)
  values (
    '22222222-2222-4222-8222-222222222222',
    'gemini', 'modelo-de-prueba', 'Resumen', 'Master Prompt'
  );
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Clonar: árbol completo, jerarquía remapeada, original intacto.
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_source constant uuid := '22222222-2222-4222-8222-222222222222';
  v_clone public.project_versions;
  v_count integer;
begin
  select * into v_clone from public.clone_project_version(v_source, '  Rumbo B  ');

  if v_clone.source_version_id is distinct from v_source then
    raise exception 'FALLO: el clon no apunta a su Versión de origen.';
  end if;

  if v_clone.version_number <> 2 then
    raise exception 'FALLO: el clon debería ser la Versión 2, es la %.', v_clone.version_number;
  end if;

  if v_clone.label <> 'Rumbo B' then
    raise exception 'FALLO: la etiqueta del clon no se normalizó, es %.', quote_nullable(v_clone.label);
  end if;

  -- Árbol completo.
  select count(*) into v_count from public.nodes where version_id = v_clone.id;
  if v_count <> 5 then
    raise exception 'FALLO: el clon tiene % Nodos, se esperaban 5.', v_count;
  end if;

  -- Original intacto: clonar copia, no mueve.
  select count(*) into v_count from public.nodes where version_id = v_source;
  if v_count <> 5 then
    raise exception 'FALLO: el original quedó con % Nodos tras clonar.', v_count;
  end if;

  -- Independencia: ni un solo Nodo compartido entre las dos Versiones.
  select count(*) into v_count
    from public.nodes n
   where n.version_id = v_clone.id
     and n.id in (
       select id from public.nodes where version_id = v_source
     );
  if v_count <> 0 then
    raise exception 'FALLO: % Nodos son la misma fila en ambas Versiones.', v_count;
  end if;

  -- Remapeo: ningún padre del clon apunta fuera del clon.
  select count(*) into v_count
    from public.nodes hijo
    join public.nodes padre on padre.id = hijo.parent_id
   where hijo.version_id = v_clone.id
     and padre.version_id <> v_clone.id;
  if v_count <> 0 then
    raise exception 'FALLO: % Nodos del clon cuelgan del árbol original.', v_count;
  end if;

  -- Forma del árbol: dos raíces, igual que el original.
  select count(*) into v_count
    from public.nodes
   where version_id = v_clone.id and parent_id is null;
  if v_count <> 2 then
    raise exception 'FALLO: el clon tiene % raíces, se esperaban 2.', v_count;
  end if;

  -- Jerarquía por contenido: el nieto sigue colgando del hijo, y éste de la raíz.
  select count(*) into v_count
    from public.nodes nieto
    join public.nodes hijo on hijo.id = nieto.parent_id
    join public.nodes raiz on raiz.id = hijo.parent_id
   where nieto.version_id = v_clone.id
     and nieto.content = 'Nieto 1.1.1'
     and hijo.content = 'Hijo 1.1'
     and raiz.content = 'Raíz 1'
     and raiz.parent_id is null;
  if v_count <> 1 then
    raise exception 'FALLO: la cadena Raíz 1 → Hijo 1.1 → Nieto 1.1.1 no sobrevivió al clonado.';
  end if;

  -- Orden entre hermanos.
  select count(*) into v_count
    from public.nodes
   where version_id = v_clone.id
     and content = 'Hijo 1.2'
     and order_index = 1;
  if v_count <> 1 then
    raise exception 'FALLO: el clon perdió el orden entre hermanos.';
  end if;

  -- Los Análisis no se clonan: pertenecen a la Versión que los generó.
  select count(*) into v_count from public.ai_analyses where version_id = v_clone.id;
  if v_count <> 0 then
    raise exception 'FALLO: el clon arrastró % Análisis.', v_count;
  end if;
end;
$$;

-- `nodes_parent_same_version` es un constraint trigger diferido: se comprueba
-- al commit, y este script termina en rollback. Forzarlo ahora hace que el
-- árbol recién clonado pase de verdad por la invariante.
set constraints all immediate;

do $$
begin
  -- Colgar un Nodo de un padre de otra Versión rompe la independencia entre
  -- Versiones, aunque ambas sean del mismo dueño.
  begin
    insert into public.nodes (version_id, parent_id, content)
    select v.id, '33333333-3333-4333-8333-333333333331', 'Cruzado'
      from public.project_versions v
     where v.source_version_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FALLO: un Nodo pudo colgar de un padre de otra Versión.';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Como el usuario B: nada de A es legible ni escribible.
-- ──────────────────────────────────────────────────────────────────────────

set local request.jwt.claims to
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

do $$
declare
  v_project constant uuid := '11111111-1111-4111-8111-111111111111';
  v_version constant uuid := '22222222-2222-4222-8222-222222222222';
  v_count integer;
begin
  -- Lectura: las cuatro tablas se ven vacías.
  select count(*) into v_count from public.projects;
  if v_count <> 0 then
    raise exception 'FALLO: B ve % Proyectos ajenos.', v_count;
  end if;

  select count(*) into v_count from public.project_versions;
  if v_count <> 0 then
    raise exception 'FALLO: B ve % Versiones ajenas.', v_count;
  end if;

  select count(*) into v_count from public.nodes;
  if v_count <> 0 then
    raise exception 'FALLO: B ve % Nodos ajenos.', v_count;
  end if;

  select count(*) into v_count from public.ai_analyses;
  if v_count <> 0 then
    raise exception 'FALLO: B ve % Análisis ajenos.', v_count;
  end if;

  -- Escritura sobre filas ajenas: RLS las esconde, así que no toca ninguna.
  update public.projects set title = 'Secuestrado' where id = v_project;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FALLO: B actualizó % Proyectos ajenos.', v_count;
  end if;

  delete from public.projects where id = v_project;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FALLO: B borró % Proyectos ajenos.', v_count;
  end if;

  delete from public.nodes where version_id = v_version;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FALLO: B borró % Nodos ajenos.', v_count;
  end if;

  -- Inserción dentro del árbol de A.
  begin
    insert into public.nodes (version_id, content) values (v_version, 'Intruso');
    raise exception 'FALLO: B insertó un Nodo en una Versión ajena.';
  exception
    when insufficient_privilege then null;
  end;

  -- Inserción de una Versión en el Proyecto de A.
  begin
    insert into public.project_versions (project_id, label) values (v_project, 'Intrusa');
    raise exception 'FALLO: B insertó una Versión en un Proyecto ajeno.';
  exception
    when insufficient_privilege then null;
  end;

  -- Un Análisis sobre el árbol de A.
  begin
    insert into public.ai_analyses (version_id, provider, model, summary, master_prompt)
    values (v_version, 'gemini', 'modelo-de-prueba', 'Robado', 'Robado');
    raise exception 'FALLO: B guardó un Análisis en una Versión ajena.';
  exception
    when insufficient_privilege then null;
  end;

  -- Suplantación: crear un Proyecto a nombre de A.
  begin
    insert into public.projects (owner_id, title)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Suplantado');
    raise exception 'FALLO: B creó un Proyecto a nombre de A.';
  exception
    when insufficient_privilege then null;
  end;

  -- La RPC no es un atajo alrededor de RLS.
  begin
    perform public.clone_project_version(v_version, 'Robada');
    raise exception 'FALLO: B clonó una Versión ajena.';
  exception
    when no_data_found then null;
  end;

  -- Control positivo: B sí puede trabajar en lo suyo. Sin esto, todas las
  -- comprobaciones de arriba pasarían igual con un esquema que no deja
  -- escribir nada a nadie.
  insert into public.projects (id, owner_id, title)
  values (
    '44444444-4444-4444-8444-444444444444',
    (select app.current_user_id()),
    'Proyecto de B'
  );

  insert into public.project_versions (id, project_id, label)
  values (
    '55555555-5555-4555-8555-555555555555',
    '44444444-4444-4444-8444-444444444444',
    'La de B'
  );

  insert into public.nodes (id, version_id, content)
  values (
    '66666666-6666-4666-8666-666666666666',
    '55555555-5555-4555-8555-555555555555',
    'Nodo de B'
  );

  select count(*) into v_count from public.nodes;
  if v_count <> 1 then
    raise exception 'FALLO: B debería ver exactamente su Nodo, ve %.', v_count;
  end if;

  -- Mover un Nodo propio al árbol de A: lo ataja el `with check` de
  -- nodes_update_own, que es justo lo que esa política existe para impedir.
  begin
    update public.nodes
       set version_id = v_version
     where id = '66666666-6666-4666-8666-666666666666';
    raise exception 'FALLO: B movió un Nodo suyo a una Versión ajena.';
  exception
    when insufficient_privilege then null;
  end;

  -- Colgar la procedencia de una Versión propia de una Versión ajena.
  begin
    insert into public.project_versions (project_id, label, source_version_id)
    values ('44444444-4444-4444-8444-444444444444', 'Procedencia falsa', v_version);
    raise exception 'FALLO: B apuntó el origen de una Versión suya a una ajena.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Sin sesión no hay datos
--
-- Dos comprobaciones, porque responden a preguntas distintas:
--
--   1. El motor le dice NO a un visitante anónimo de verdad. Es la prueba
--      end-to-end, y el rol se nombra por DDL dinámico porque se llama `anon`
--      en Supabase y `anonymous` en Neon.
--   2. Ese rol no tiene NI UN privilegio sobre las cuatro tablas ni EXECUTE
--      sobre ninguna función del esquema. Cubre lo que la primera no ve: la
--      primera solo prueba `projects`, y quedarse ahí dejaría pasar un GRANT
--      olvidado en las otras tres o en la RPC de clonado.
-- ──────────────────────────────────────────────────────────────────────────

-- Vuelta al rol de la migración: `app.anonymous_role()` es un metadato del
-- esquema y `authenticated` no tiene EXECUTE sobre él, por diseño.
reset role;

-- 1. Un visitante anónimo de verdad, contra el motor.
do $$
declare
  v_anon constant text := app.anonymous_role();
  v_count integer;
begin
  execute format('set local role %I', v_anon);

  begin
    select count(*) into v_count from public.projects;
    raise exception 'FALLO: un visitante anónimo (%) pudo consultar Proyectos (vio % filas).',
      v_anon, v_count;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- `set local role` dentro de un bloque plpgsql sobrevive al bloque, así que
-- hace falta deshacerlo a mano antes de volver a leer el catálogo.
reset role;

-- 2. Y no tiene ni un privilegio, en ninguna de las cuatro tablas.
do $$
declare
  v_anon constant text := app.anonymous_role();
  v_count integer;
  v_offenders text;
begin
  select count(*), string_agg(distinct table_name || ':' || privilege_type, ', ')
    into v_count, v_offenders
    from information_schema.role_table_grants
   where grantee = v_anon
     and table_schema = 'public'
     and table_name in (
       'projects', 'project_versions', 'nodes', 'ai_analyses', 'project_overviews'
     );
  if v_count <> 0 then
    raise exception 'FALLO: el rol % tiene privilegios de tabla: %.', v_anon, v_offenders;
  end if;

  select count(*), string_agg(p.proname, ', ')
    into v_count, v_offenders
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege(v_anon, p.oid, 'execute');
  if v_count <> 0 then
    raise exception 'FALLO: el rol % puede ejecutar: %.', v_anon, v_offenders;
  end if;

  -- Control positivo: `authenticated` sí llega a las tablas, a la RPC y a los
  -- helpers. Sin esto, las dos comprobaciones de arriba pasarían con un esquema
  -- que no deja tocar nada a nadie.
  select count(*) into v_count
    from information_schema.role_table_grants
   where grantee = 'authenticated'
     and table_schema = 'public'
     and table_name in ('projects', 'project_versions', 'nodes', 'ai_analyses');
  -- 4 en projects/project_versions/nodes + 3 en ai_analyses, que no se edita.
  if v_count <> 15 then
    raise exception 'FALLO: authenticated tiene % privilegios de tabla, se esperaban 15.', v_count;
  end if;

  if not has_function_privilege(
       'authenticated', 'public.clone_project_version(uuid, text)', 'execute') then
    raise exception 'FALLO: authenticated no puede ejecutar clone_project_version.';
  end if;
  if not has_function_privilege(
       'authenticated', 'public.is_version_owner(uuid)', 'execute') then
    raise exception 'FALLO: authenticated no puede ejecutar is_version_owner.';
  end if;
end;
$$;

select 'verificacion_ok' as resultado;
