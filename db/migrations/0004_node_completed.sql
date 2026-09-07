-- RICE(0) — el Nodo guarda si está completado.
--
-- Primera columna nueva en `nodes` desde el esquema inicial, y la decisión de
-- que sea columna y no preferencia local es del Ticket #46 dentro del Spec #27.
--
-- Por qué se PERSISTE, y no se guarda en el dispositivo como el plegado: un
-- Nodo completado y su subárbol se omiten del texto que va a la IA. Guardado en
-- el navegador, la misma Versión produciría un Análisis distinto según desde
-- dónde se generara, y eso contradice la definición de Versión del glosario —
-- «una línea completa e independiente del árbol». El plegado sí es local
-- precisamente porque no cambia lo que la IA recibe.
--
-- `not null default false` y no nullable: «no lo sé» no es un tercer estado que
-- nadie haya diseñado, y con el default los Nodos que ya existen quedan
-- pendientes sin tener que tocarlos uno a uno.
--
-- Sin índice: nadie consulta por este campo. El árbol se lee entero por
-- Versión y se filtra en memoria, así que un índice aquí solo costaría
-- escrituras. Si algún día hay una vista «solo lo pendiente» que vaya al
-- motor, entonces sí.

alter table public.nodes
  add column if not exists completed boolean not null default false;

comment on column public.nodes.completed is
  'Nodo dado por terminado. Él y su subárbol se pintan tachados y no viajan a la IA.';

-- ──────────────────────────────────────────────────────────────────────────
-- Clonar una Versión se lleva el completado
--
-- `clone_project_version` enumera las columnas de `nodes` a mano, así que una
-- columna nueva NO entra sola: el clon nacía entero pendiente. El doble en
-- memoria sí la copiaba, de modo que los dos prometían cosas distintas y el
-- contrato compartido no lo veía porque ningún caso clonaba. Ahora hay uno.
--
-- El fallo importa más de lo que parece: un clon es independiente, así que lo
-- que se pierde al clonar no se recupera desde el original. Y contradice la
-- definición de Versión del glosario, que promete un snapshot — no un snapshot
-- con una columna a cero.
--
-- Va como `create or replace` y no como un `alter`: en PostgreSQL el cuerpo de
-- una función es texto, no una estructura que se pueda parchear. Se reescribe
-- entera, idéntica salvo las dos líneas de `completed`, para que la próxima
-- columna que se añada tropiece aquí igual que ha tropezado ésta.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.clone_project_version(
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
  insert into public.nodes (id, version_id, parent_id, content, order_index, completed)
  select
    remap.new_id,
    v_clone.id,
    parent_remap.new_id,
    n.content,
    n.order_index,
    n.completed
  from public.nodes n
  join remap on remap.old_id = n.id
  left join remap as parent_remap on parent_remap.old_id = n.parent_id
  where n.version_id = v_source.id;

  return v_clone;
end;
$$;
