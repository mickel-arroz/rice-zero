/**
 * El prompt de Análisis, ensamblado.
 *
 * Función pura: mismas entradas, mismo texto, siempre. Eso no es una virtud
 * abstracta — el árbol que entra ya es determinista (`lib/tree/serialize.ts`),
 * y si el prompt no lo fuera, dos Análisis del mismo árbol saldrían distintos
 * y nadie sabría si la culpa fue del modelo o nuestra.
 *
 * Aquí NO se re-serializa nada: entra el texto que produjo `serializeTree` y
 * se inserta tal cual. Dos serializaciones del mismo árbol en dos sitios son
 * dos formatos esperando a divergir.
 *
 * Es un módulo con reglas y no una plantilla (ADR 0003): la deducción de
 * Intención, la precedencia de las Directrices y la regla de los Checks tienen
 * sustancia propia, y por eso no van de propina dentro del adaptador de Gemini.
 */

import { INTENT_KINDS } from "@/lib/ai/schema";

export type AnalysisPromptInput = {
  /** La salida de `serializeTree`. Se inserta tal cual. */
  serializedTree: string;
  /** Directrices del Usuario, si las escribió. */
  guidelines?: string | null;
};

/**
 * Los delimitadores del contenido que viene de fuera.
 *
 * Etiquetas y no comillas ni guiones: el árbol es texto libre del usuario y
 * puede contener cualquier cosa, incluido lo que se hubiera elegido como
 * marca de cierre. Una etiqueta con barra es lo que un modelo reconoce como
 * frontera sin que el contenido la imite por accidente.
 */
const TREE_TAG = "arbol";
const GUIDELINES_TAG = "directrices";

/**
 * El bloque de máxima precedencia.
 *
 * Va PRIMERO, antes del árbol y antes de cualquier regla, y lo dice de sí
 * mismo. Es la única palanca del usuario para corregir una Intención mal
 * deducida (ADR 0003: no hay selector en el panel), así que tiene que ganarle
 * también al paso que deduce la Intención — no solo al tono.
 */
function guidelinesBlock(guidelines: string): string {
  return `⚠️ PRIORIDAD ALTA / DIRECTRICES DEL USUARIO

Estas Directrices las escribió la persona dueña del árbol y ganan a cualquier
otra regla de este prompt, incluida la deducción de la Intención. Si algo de
más abajo las contradice, obedece a las Directrices.

<${GUIDELINES_TAG}>
${guidelines}
</${GUIDELINES_TAG}>`;
}

/** Las reglas, sin el árbol ni las Directrices. Constante: no dependen de la entrada. */
const RULES = `A dónde va tu respuesta

No escribes para una persona. Escribes el material que un agente de código va a
ejecutar corriendo las skills /to-spec, /to-tickets e /implement. Eso manda
sobre el tono: cero preámbulo, cero cortesía, cero resumen de lo que acabas de
decir, cero cierre.

Paso 1 — Deduce la Intención

Elige un valor de esta lista cerrada: ${INTENT_KINDS.join(", ")}.

No supongas que esto es un proyecto nuevo. Un árbol puede describir un arreglo
de UI sobre algo ya desplegado, una feature que se cuelga de un módulo que ya
existe, un refactor o una migración. Si el árbol menciona pantallas, módulos,
rutas o despliegues como si YA existieran, la Intención no es proyecto-nuevo.
Ante duda real elige otro, y que la razón lo diga.

Acompáñala de una línea diciendo de qué parte del árbol la dedujiste.

Paso 2 — Resume y pregunta

Resume en prosa corta el árbol que entendiste.

Las preguntas son huecos que BLOQUEAN la implementación. Si no bloquea, no se
pregunta. Un árbol completo no necesita preguntas: devolver la lista vacía es
la respuesta correcta cuando no falta nada.

Paso 3 — El Spec

Problema, solución, decisiones de implementación, decisiones de testing y out
of scope. La forma no cambia con la Intención; el contenido sí. Para un fix, el
problema es el bug y la solución es la causa raíz. Para proyecto-nuevo es el
spec completo del producto. Para un refactor, el problema es lo que estorba hoy
y el out of scope incluye explícitamente el cambio de comportamiento.

Paso 4 — Los Tickets

Tracer bullets: cada Ticket entregable y verificable por sí solo, en el orden
en que se construyen, con sus bloqueos declarados en blockedBy.

Todo Nodo del árbol —padre e hijo por igual— tiene que quedar representado en
algún Ticket. Un Nodo padre suele ser un Ticket y sus hijos suelen ser sus
Checks, pero puede ser al revés si el padre es solo un rótulo. Ninguno se
queda fuera.

Los ids son t1, t2, t3… en el orden en que los escribes, y blockedBy solo
apunta a ids que existan. No cierres ciclos: si t2 espera a t1, t1 no espera a
t2.

LA REGLA DE LOS CHECKS

Todo Ticket lleva sus Checks, y el Spec lleva los suyos. Sin excepción: un
Ticket sin Checks es una respuesta malformada y se rechaza entera.

Un Check es binario —se cumple o no, sin término medio—, se verifica desde
fuera (comportamiento observable, nunca detalles internos) y está escrito de
forma que otro agente pueda marcarlo sin preguntarle nada a nadie.

El idioma

Escribe en el idioma del contenido del árbol, no en el de este prompt.

La economía

No repitas el árbol. No expliques lo que vas a hacer antes de hacerlo. No
cierres con conclusiones. Cada token que escribas lo va a leer una máquina.`;

/**
 * El prompt entero.
 *
 * El orden lo fija el ticket y no es cosmético: las Directrices tienen que
 * estar leídas ANTES de que empiecen las reglas que pueden contradecir, y el
 * árbol antes de los pasos que operan sobre él.
 */
export function buildAnalysisPrompt({
  serializedTree,
  guidelines,
}: AnalysisPromptInput): string {
  // Un campo opcional que llega en blanco es no haber escrito Directrices. Sin
  // el trim, un usuario que dejó un salto de línea en el campo se ganaría un
  // bloque de PRIORIDAD ALTA vacío diciéndole al modelo que obedezca a nada.
  const trimmed = guidelines?.trim() ?? "";

  const blocks = [
    ...(trimmed ? [guidelinesBlock(trimmed)] : []),
    `El árbol de ideas a analizar:

<${TREE_TAG}>
${serializedTree}
</${TREE_TAG}>`,
    RULES,
  ];

  return blocks.join("\n\n");
}
