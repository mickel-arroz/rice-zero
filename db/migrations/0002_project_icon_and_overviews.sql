-- RICE(0) — icono de Proyecto, la lista con métricas y el alta transaccional.
--
-- Migración ADITIVA sobre `0001_initial_schema.sql`: no toca ninguna columna ni
-- ninguna política existente, así que se puede aplicar sobre una base que ya
-- lleva datos. Trae tres cosas, y las tres son del #9:
--
--   · `projects.icon`, la clave del icono asignado.
--   · `project_overviews`, la vista que resuelve la lista y sus métricas en UNA
--     sola consulta.
--   · `create_project_with_version`, el alta de un Proyecto junto con su
--     Versión inicial, en una transacción.
--
-- Como `0001`, no nombra a ningún proveedor: lo que varía entre ellos lo aporta
-- el preludio de `db/preludes/`.
--
-- Es idempotente a propósito (`if not exists`, `create or replace`). `0001` no
-- lo era porque se aplica sobre una base vacía; ésta tiene que poder correr
-- sobre la base que YA está en pie en Neon, donde volver a aplicar `0001`
-- fallaría en el primer `create table`.

-- ──────────────────────────────────────────────────────────────────────────
-- El icono asignado
--
-- El catálogo canónico de claves NO se enumera aquí: vive como constante de
-- TypeScript (`components/icons/projects/index.ts`) y lo valida la capa de
-- servicios antes de escribir. Así, sumar un icono es un cambio de código y no
-- una migración — que es justo lo que un `check` con las 30 claves impediría.
--
-- Lo que el motor sí garantiza es que hay algo y que no es una novela: el
-- `check` es de longitud. Una clave que no esté en el catálogo entra en la
-- tabla si alguien la escribe a mano, y al leerla la interfaz cae al icono por
-- defecto en vez de romperse (ver `projectIconFor`).
-- ──────────────────────────────────────────────────────────────────────────

alter table public.projects
  add column if not exists icon text not null default 'node';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_icon_length'
  ) then
    alter table public.projects
      add constraint projects_icon_length
      check (char_length(btrim(icon)) between 1 and 40);
  end if;
end;
$$;

comment on column public.projects.icon is
  'Clave del icono asignado. El catálogo vive en TypeScript, no en SQL: añadir uno es un cambio de código.';

-- ──────────────────────────────────────────────────────────────────────────
-- La lista con sus métricas
--
-- Cuatro cifras por Proyecto —Versiones, Nodos, Análisis y última actividad—
-- en una sola consulta. N+1 sobre la lista está descartado por diseño, no por
-- disciplina del llamante.
--
-- Un lateral POR MÉTRICA y no uno con tres joins: subir de `project_versions` a
-- `nodes` y a `ai_analyses` en el mismo `from` multiplica las filas, y entonces
-- «3 Versiones» pasarían a ser 3 × 24 = 72. Cada lateral agrega lo suyo y
-- devuelve exactamente una fila.
--
-- `security_invoker = true` (Postgres 15+) es lo que mantiene la privacidad:
-- sin él la vista leería con los permisos de SU DUEÑO y enseñaría los Proyectos
-- de todo el mundo. Con él, las políticas RLS de `0001` se evalúan contra quien
-- consulta, igual que si preguntara a las tablas.
-- ──────────────────────────────────────────────────────────────────────────

create or replace view public.project_overviews
with (security_invoker = true) as
select
  p.id,
  p.owner_id,
  p.title,
  p.description,
  p.icon,
  p.created_at,
  p.updated_at,
  v.version_count,
  n.node_count,
  a.analysis_count,
  -- `greatest` ignora los nulos y `p.updated_at` nunca lo es, así que un
  -- Proyecto recién creado —sin Nodos que hayan movido nada— sigue teniendo
  -- fecha. Es la clave de ordenación de la lista.
  --
  -- No se lee `p.updated_at` a secas porque `touch_updated_at` es un trigger
  -- POR TABLA: editar un Nodo no toca el Proyecto, así que esa columna se
  -- quedaría congelada mientras el usuario trabaja. Y propagar el toque con un
  -- trigger sobre `nodes` tampoco vale: el Autoguardado persiste cada cambio
  -- mínimo, así que la fila del Proyecto recibiría una escritura por pulsación.
  greatest(p.updated_at, v.versions_touched_at, n.nodes_touched_at)
    as last_activity_at
from public.projects p
left join lateral (
  select
    count(*)::int as version_count,
    max(pv.updated_at) as versions_touched_at
  from public.project_versions pv
  where pv.project_id = p.id
) v on true
left join lateral (
  select
    count(*)::int as node_count,
    max(nd.updated_at) as nodes_touched_at
  from public.nodes nd
  join public.project_versions pv on pv.id = nd.version_id
  where pv.project_id = p.id
) n on true
left join lateral (
  select count(*)::int as analysis_count
  from public.ai_analyses ai
  join public.project_versions pv on pv.id = ai.version_id
  where pv.project_id = p.id
) a on true;

comment on view public.project_overviews is
  'La lista de Proyectos con sus métricas, en una sola consulta. Hereda la RLS de las tablas: security_invoker.';

-- La vista es de solo lectura para la app: escribir se escribe en las tablas.
revoke all on public.project_overviews from public, authenticated;
grant select on public.project_overviews to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Un Proyecto nace con su Versión inicial
--
-- «Todo proyecto nace con una Versión inicial» es una invariante del dominio, y
-- una invariante que dos peticiones HTTP seguidas no pueden sostener: si la
-- segunda falla queda un Proyecto sin Versiones, que es un estado que la app no
-- sabe dibujar. Aquí las dos escrituras van en la misma transacción.
--
-- La Versión inicial no lleva etiqueta. «v1» no es un dato: es `version_number`
-- pintado, y el trigger `assign_version_number` ya lo pone en 1. Guardarlo como
-- etiqueta duplicaría el número y dejaría a la interfaz eligiendo cuál de los
-- dos enseñar.
--
-- `security invoker`, igual que `clone_project_version`: la RPC no es un atajo
-- alrededor de RLS. Sin sesión, el `with check` de `projects_insert_own`
-- rechaza el insert exactamente igual que si viniera por la tabla.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.create_project_with_version(
  p_title text,
  p_description text default null,
  p_icon text default 'node'
)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  -- `owner_id` no se pasa: lo pone el default de la tabla desde la sesión. Es
  -- la misma razón por la que no está en el puerto — un parámetro sería una
  -- invitación a crear un Proyecto a nombre de otro.
  insert into public.projects (title, description, icon)
  values (
    p_title,
    nullif(btrim(p_description), ''),
    coalesce(nullif(btrim(p_icon), ''), 'node')
  )
  returning * into v_project;

  insert into public.project_versions (project_id)
  values (v_project.id);

  return v_project;
end;
$$;

comment on function public.create_project_with_version(text, text, text) is
  'Alta de un Proyecto junto con su Versión inicial, en una transacción. Ningún Proyecto existe sin Versiones.';

revoke execute on function public.create_project_with_version(text, text, text) from public;
grant execute on function public.create_project_with_version(text, text, text) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- El rol anónimo
--
-- Mismo criterio que en `0001`: se llama distinto en cada proveedor, así que
-- los revokes van juntos al final. Un visitante sin sesión no llega a nada.
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare
  v_anon text := app.anonymous_role();
begin
  execute format('revoke all on public.project_overviews from %I', v_anon);
  execute format(
    'revoke execute on function public.create_project_with_version(text, text, text) from %I',
    v_anon
  );
end;
$$;
