-- RICE(0) — esquema inicial.
--
-- Proyecto → Versión → árbol de Nodos, más los Análisis de IA por Versión.
-- Todo es privado por dueño: cada tabla lleva RLS owner-only y no hay ninguna
-- ruta de lectura entre usuarios. No existen adjuntos ni posiciones de canvas
-- (el layout es siempre automático), por diseño del producto.

-- ──────────────────────────────────────────────────────────────────────────
-- Tablas
-- ──────────────────────────────────────────────────────────────────────────

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Contenedor raíz de una idea. Pertenece a un único usuario.';

create index projects_owner_id_updated_at_idx
  on public.projects (owner_id, updated_at desc);

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Lo asigna `assign_version_number` antes de insertar: nunca lo manda el
  -- cliente, para que la numeración sea densa y monótona por Proyecto.
  version_number integer not null,
  label text check (char_length(btrim(label)) between 1 and 120),
  -- Versión de la que se clonó ésta. `on delete set null`: borrar el origen
  -- no puede llevarse por delante un snapshot que ya es independiente.
  source_version_id uuid references public.project_versions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_versions_number_unique unique (project_id, version_number)
);

comment on table public.project_versions is
  'Línea completa e independiente del árbol de un Proyecto. Siempre editable.';

create index project_versions_project_id_number_idx
  on public.project_versions (project_id, version_number desc);

create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.project_versions (id) on delete cascade,
  -- Nullable: una Versión admite varias raíces. Cascade: borrar un Nodo se
  -- lleva su subárbol entero.
  parent_id uuid references public.nodes (id) on delete cascade,
  content text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un Nodo nunca es su propio padre. Los ciclos más largos los impide la
  -- capa de dominio; este check ataja el caso degenerado en el propio motor.
  constraint nodes_not_own_parent check (parent_id is distinct from id)
);

comment on table public.nodes is
  'Unidad de idea en texto. Un padre (o raíz) y 0..n subnodos. Solo texto.';

create index nodes_version_id_parent_id_order_idx
  on public.nodes (version_id, parent_id, order_index);

create index nodes_parent_id_idx on public.nodes (parent_id);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.project_versions (id) on delete cascade,
  -- Texto que el usuario antepuso a la generación, guardado tal cual para que
  -- un Análisis se pueda releer entendiendo con qué se pidió.
  user_guidelines text,
  provider text not null,
  model text not null,
  summary text not null,
  questions jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  master_prompt text not null,
  feature_prompts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.ai_analyses is
  'Resultado de enviar una Versión a la IA. Histórico: nunca se sobrescribe.';

create index ai_analyses_version_id_created_at_idx
  on public.ai_analyses (version_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- Triggers de mantenimiento
-- ──────────────────────────────────────────────────────────────────────────

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create trigger project_versions_touch_updated_at
  before update on public.project_versions
  for each row execute function public.touch_updated_at();

create trigger nodes_touch_updated_at
  before update on public.nodes
  for each row execute function public.touch_updated_at();

create function public.assign_version_number()
returns trigger
language plpgsql
-- `security definer`: numerar exige ver *todas* las Versiones del Proyecto.
-- Bajo RLS de invocador, una fila invisible daría un número ya usado.
security definer
set search_path = ''
as $$
begin
  -- El lock serializa las altas concurrentes del mismo Proyecto, de modo que
  -- dos clones simultáneos no pelean por el mismo número (la constraint única
  -- lo atraparía, pero fallando la petición del usuario).
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));

  select coalesce(max(v.version_number), 0) + 1
    into new.version_number
    from public.project_versions v
   where v.project_id = new.project_id;

  return new;
end;
$$;

create trigger project_versions_assign_number
  before insert on public.project_versions
  for each row execute function public.assign_version_number();

-- Un Nodo y su padre viven siempre en la misma Versión. Es la invariante que
-- hace que las Versiones sean líneas independientes: sin ella un clon podría
-- quedar colgando del árbol original (y, de paso, del árbol de otro usuario).
--
-- Va como constraint trigger diferido, no como política RLS ni como check:
-- clonar inserta el árbol entero en una sola sentencia, así que mientras ésta
-- corre un hijo puede llegar antes que su padre. Diferido al commit, el orden
-- dentro de la sentencia deja de importar.
create function public.enforce_node_parent_same_version()
returns trigger
language plpgsql
-- `security definer`: la invariante se comprueba sobre el árbol real, no
-- sobre lo que RLS deje ver al invocador.
security definer
set search_path = ''
as $$
declare
  v_parent_version uuid;
begin
  if new.parent_id is null then
    return null;
  end if;

  select n.version_id into v_parent_version
    from public.nodes n
   where n.id = new.parent_id;

  -- Ausente = el padre se borró en esta misma transacción, y el cascade ya se
  -- habrá llevado a este Nodo con él.
  if found and v_parent_version is distinct from new.version_id then
    raise exception 'El Nodo % y su padre deben estar en la misma Versión.', new.id
      using errcode = 'foreign_key_violation';
  end if;

  return null;
end;
$$;

create constraint trigger nodes_parent_same_version
  after insert or update of parent_id, version_id on public.nodes
  deferrable initially deferred
  for each row execute function public.enforce_node_parent_same_version();

-- ──────────────────────────────────────────────────────────────────────────
-- Propiedad
--
-- Las políticas de `nodes` y `ai_analyses` tendrían que subir dos joins hasta
-- `projects` en cada fila. Estos helpers `security definer` cortan por lo
-- sano: resuelven la propiedad sin volver a evaluar las políticas de las
-- tablas intermedias, y son la única puerta por la que se decide "esto es
-- mío". `stable` permite a Postgres cachearlos dentro de la consulta.
-- ──────────────────────────────────────────────────────────────────────────

create function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.projects p
     where p.id = p_project_id
       and p.owner_id = (select auth.uid())
  );
$$;

create function public.is_version_owner(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.project_versions v
      join public.projects p on p.id = v.project_id
     where v.id = p_version_id
       and p.owner_id = (select auth.uid())
  );
$$;

-- Las funciones de trigger no son invocables a mano de forma útil, pero se
-- les quita el EXECUTE por defecto igual que a las demás: son `security
-- definer` y la superficie se cierra entera o no se cierra.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.assign_version_number() from public, anon, authenticated;
revoke execute on function public.enforce_node_parent_same_version() from public, anon, authenticated;

revoke execute on function public.is_project_owner(uuid) from public, anon;
revoke execute on function public.is_version_owner(uuid) from public, anon;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.is_version_owner(uuid) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: owner-only en todas las tablas
--
-- Una política por operación y `to authenticated`: un visitante anónimo no
-- llega a evaluar nada. `with check` va siempre en insert/update para que
-- nadie pueda mover una fila propia al espacio de otro usuario.
-- ──────────────────────────────────────────────────────────────────────────

alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.nodes enable row level security;
alter table public.ai_analyses enable row level security;

create policy projects_select_own on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy projects_insert_own on public.projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy projects_update_own on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy projects_delete_own on public.projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy project_versions_select_own on public.project_versions
  for select to authenticated
  using (public.is_project_owner(project_id));

-- El origen se valida además del Proyecto: la procedencia de una Versión solo
-- puede apuntar a otra Versión propia.
create policy project_versions_insert_own on public.project_versions
  for insert to authenticated
  with check (
    public.is_project_owner(project_id)
    and (source_version_id is null or public.is_version_owner(source_version_id))
  );

create policy project_versions_update_own on public.project_versions
  for update to authenticated
  using (public.is_project_owner(project_id))
  with check (
    public.is_project_owner(project_id)
    and (source_version_id is null or public.is_version_owner(source_version_id))
  );

create policy project_versions_delete_own on public.project_versions
  for delete to authenticated
  using (public.is_project_owner(project_id));

create policy nodes_select_own on public.nodes
  for select to authenticated
  using (public.is_version_owner(version_id));

-- La Versión basta para decidir la propiedad de un Nodo: el padre no se
-- comprueba aquí porque `nodes_parent_same_version` ya lo ata a esta misma
-- Versión, y una Versión propia no contiene Nodos ajenos.
create policy nodes_insert_own on public.nodes
  for insert to authenticated
  with check (public.is_version_owner(version_id));

create policy nodes_update_own on public.nodes
  for update to authenticated
  using (public.is_version_owner(version_id))
  with check (public.is_version_owner(version_id));

create policy nodes_delete_own on public.nodes
  for delete to authenticated
  using (public.is_version_owner(version_id));

create policy ai_analyses_select_own on public.ai_analyses
  for select to authenticated
  using (public.is_version_owner(version_id));

create policy ai_analyses_insert_own on public.ai_analyses
  for insert to authenticated
  with check (public.is_version_owner(version_id));

create policy ai_analyses_delete_own on public.ai_analyses
  for delete to authenticated
  using (public.is_version_owner(version_id));

-- Un Análisis es el registro de lo que la IA respondió: se crea, se lee y se
-- borra, pero no se edita. Por eso no hay política de update.

-- ──────────────────────────────────────────────────────────────────────────
-- Privilegios de tabla
--
-- RLS filtra filas, pero solo después de que el rol tenga el privilegio. Los
-- default privileges de Supabase reparten permisos a `anon` y `authenticated`
-- en cuanto se crea una tabla, así que aquí se revoca todo y se concede
-- exactamente lo necesario: sin sesión no hay datos, y un Análisis no se
-- edita ni por accidente.
-- ──────────────────────────────────────────────────────────────────────────

revoke all on public.projects from public, anon, authenticated;
revoke all on public.project_versions from public, anon, authenticated;
revoke all on public.nodes from public, anon, authenticated;
revoke all on public.ai_analyses from public, anon, authenticated;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_versions to authenticated;
grant select, insert, update, delete on public.nodes to authenticated;
grant select, insert, delete on public.ai_analyses to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Clonar una Versión
-- ──────────────────────────────────────────────────────────────────────────

create function public.clone_project_version(
  p_version_id uuid,
  p_label text default null
)
returns public.project_versions
language plpgsql
-- `security invoker`: la RPC no es un atajo alrededor de RLS. Clonar una
-- Versión ajena falla igual que leerla, porque el select de abajo no la ve.
security invoker
set search_path = ''
as $$
declare
  v_source public.project_versions;
  v_clone public.project_versions;
begin
  select * into v_source
    from public.project_versions
   where id = p_version_id;

  if not found then
    raise exception 'La Versión % no existe o no es tuya.', p_version_id
      using errcode = 'no_data_found';
  end if;

  insert into public.project_versions (project_id, label, source_version_id)
  values (v_source.project_id, nullif(btrim(p_label), ''), v_source.id)
  returning * into v_clone;

  -- Un solo INSERT para todo el árbol: las FK de `nodes` se comprueban al
  -- cerrar la sentencia, así que un hijo puede insertarse antes que su padre
  -- sin que el orden importe. El mapa old_id → new_id se genera antes para
  -- poder remapear `parent_id` en la misma pasada.
  -- `materialized` no es decorativo: el CTE se referencia dos veces (el Nodo y
  -- su padre) y hay que ver el MISMO uuid en ambas. Inlinearlo generaría uno
  -- distinto por referencia y el remapeo saldría mal.
  with remap as materialized (
    select n.id as old_id, gen_random_uuid() as new_id
      from public.nodes n
     where n.version_id = v_source.id
  )
  insert into public.nodes (id, version_id, parent_id, content, order_index)
  select
    remap.new_id,
    v_clone.id,
    parent_remap.new_id,
    n.content,
    n.order_index
  from public.nodes n
  join remap on remap.old_id = n.id
  left join remap as parent_remap on parent_remap.old_id = n.parent_id
  where n.version_id = v_source.id;

  return v_clone;
end;
$$;

comment on function public.clone_project_version(uuid, text) is
  'Snapshot profundo e independiente del árbol de una Versión, con la jerarquía remapeada. No copia Análisis.';

revoke execute on function public.clone_project_version(uuid, text) from public, anon;
grant execute on function public.clone_project_version(uuid, text) to authenticated;
