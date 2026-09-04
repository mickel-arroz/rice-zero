-- RICE(0) — `ai_analyses` guarda el OBJETO del Análisis, no su texto.
--
-- La decisión es del ADR 0003 y esta migración es su parte de motor. Lo que
-- había —`summary`, `features`, `master_prompt`, `feature_prompts`— era la
-- forma que el spec (#1) supuso antes de saber que un árbol no siempre
-- describe un proyecto nuevo. En su sitio va una sola columna `jsonb` con el
-- Análisis entero tal y como lo valida `lib/ai/schema.ts`: Intención, resumen,
-- preguntas, Spec y Tickets con sus Checks.
--
-- Por qué el objeto y no el texto: el Master Prompt se rendera AL LEERLO
-- (`lib/ai/render.ts`). Cambiar el formato de salida deja de ser una migración
-- y pasa a ser un cambio de renderer, con los Análisis viejos re-renderizados
-- solos. El coste asumido es que un Análisis histórico no conserva
-- literalmente el texto que se copió aquel día; su contenido sí.
--
-- Por qué UNA columna y no una por campo: la forma del Análisis la fija el
-- schema de Zod, y ese schema va a cambiar. Un `intent_kind text`, un
-- `spec jsonb` y un `tickets jsonb` serían tres sitios que hay que migrar cada
-- vez que el contrato se mueva, para nada: nadie consulta por dentro de un
-- Análisis. Se lee entero, por su Versión, y se rendera.
--
-- Como `0002`, no nombra a ningún proveedor y es idempotente donde puede
-- serlo. A diferencia de `0002`, NO es aditiva: se lleva cuatro columnas por
-- delante. De ahí el guardia de abajo.

-- ──────────────────────────────────────────────────────────────────────────
-- El guardia
--
-- Ninguna fila puede existir todavía: nada en la app escribe Análisis hasta
-- este mismo ticket (#15) y el panel que los pide es el #16. Aun así se
-- comprueba en vez de suponerse, porque las cuatro columnas viejas NO se
-- pueden convertir en un Análisis válido — no traen Intención, ni Spec, ni
-- Tickets, ni Checks, y esos campos son `not null` en el schema. No hay
-- conversión posible, así que la alternativa a pararse es escribir filas que
-- fallarían al leerse.
--
-- Se para con un error y no borra: si esto salta, hay datos que alguien tiene
-- que decidir qué hacer con ellos, y una migración no es quién.
-- ──────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from public.ai_analyses) then
    raise exception
      'ai_analyses tiene filas y la forma vieja no se puede convertir en un Análisis válido (falta Intención, Spec y Tickets). Vacía la tabla a mano si esos Análisis son desechables, y vuelve a aplicar.';
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- El objeto
-- ──────────────────────────────────────────────────────────────────────────

alter table public.ai_analyses
  add column if not exists analysis jsonb not null;

comment on column public.ai_analyses.analysis is
  'El Análisis entero tal cual lo devolvió la IA, ya validado contra lib/ai/schema.ts. Se lee entero y se rendera a texto al leerlo; el motor no consulta por dentro.';

-- Un `jsonb` acepta `'"hola"'` y `'null'` tan felizmente como un objeto, y una
-- de esas dos cosas dentro de esta columna es un Análisis que el renderer no
-- sabe pintar. La validación de verdad la hace Zod antes de escribir; esto es
-- el suelo del motor, para que ni un script ni una mano lo dejen imposible.
alter table public.ai_analyses
  drop constraint if exists ai_analyses_analysis_is_object;

alter table public.ai_analyses
  add constraint ai_analyses_analysis_is_object
  check (jsonb_typeof(analysis) = 'object');

-- ──────────────────────────────────────────────────────────────────────────
-- Lo que se retira
--
-- `features` y `feature_prompts` se van con el término: el ADR 0003 retira
-- «features estructuradas» y «Feature Prompt», y en su sitio van el Spec y los
-- Tickets, que viven dentro de `analysis`.
--
-- `summary` también, aunque siga existiendo como campo: ahora es
-- `analysis->'summary'`. Dejarlo duplicado en su propia columna sería tener el
-- mismo dato en dos sitios esperando a que alguien escriba uno y no el otro.
-- ──────────────────────────────────────────────────────────────────────────

alter table public.ai_analyses drop column if exists summary;
alter table public.ai_analyses drop column if exists questions;
alter table public.ai_analyses drop column if exists features;
alter table public.ai_analyses drop column if exists master_prompt;
alter table public.ai_analyses drop column if exists feature_prompts;

-- El índice por Versión y fecha no se toca: sigue siendo como se lee la lista
-- de Análisis de una Versión, y `analysis` no entra en ninguna consulta.
