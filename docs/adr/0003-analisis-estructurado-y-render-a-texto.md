# El Análisis sale estructurado, y el texto plano lo escribimos nosotros

El Análisis nació en el spec (#1) suponiendo una sola cosa: que el árbol describe un proyecto que
todavía no existe. No es cierto. Un árbol de RICE(0) puede ser el arranque de un producto, pero
también un arreglo de UI sobre algo ya desplegado, una feature que se cuelga de un módulo existente
o un refactor. Un Análisis que siempre dice «crea este proyecto» es un Análisis equivocado en la
mayoría de los casos.

Este ADR fija tres decisiones que salen de ahí y que son caras de deshacer, porque las tres tocan el
contrato de salida de la IA — y ese contrato lo comparten el schema, la base de datos, el panel y
la exportación.

**La Intención la deduce la IA, no la elige el usuario.** El Análisis empieza declarando qué clase
de trabajo pide el árbol (`proyecto-nuevo`, `feature`, `fix`, `refactor`, `ui`, `infra`, `docs`,
`otro`) y una línea de por qué. Es un enum cerrado: el panel puede etiquetarlo y un test puede
afirmarlo.

**La IA devuelve un objeto validado; el texto plano lo escribimos nosotros.** El modelo responde
estructurado (`generateObject` + Zod) y un renderer puro convierte ese objeto en el Master Prompt y
en cada Ticket Prompt.

**Las «features estructuradas» se retiran y en su sitio va Spec + Tickets con Checks.** El destino
del Master Prompt es un agente que corre las skills de Matt Pocock, y ese flujo se alimenta de un
spec y de tickets con criterios de aceptación, no de una lista de features. Todo Ticket lleva sus
Checks, y todo Nodo —padre e hijo por igual— queda representado en alguno.

## Considered Options

**Que el usuario elija la Intención en un selector del panel.** Es lo primero que se piensa y se
rechazó por coste contra beneficio: obliga a un campo nuevo en `ai_analyses`, a un control en el
panel (#16) y a un catálogo que mantener en la UI, y todo eso para una señal que el propio árbol ya
lleva escrita. Las Directrices del Usuario cubren el caso de corrección —«esto es un fix sobre un
proyecto existente»— con máxima precedencia y cero superficie nueva. Si algún día la deducción
falla lo bastante como para molestar, el selector se añade encima sin tirar nada: la Intención ya
es un campo del Análisis.

**Pedirle a la IA el texto plano directamente, en vez del objeto.** Es la lectura literal de
«la respuesta debe ser texto plano» y es la que peor cumple el requisito. Confía en que el modelo
obedezca las reglas de formato en cada generación, cuando lo que hace un modelo con «no uses
negritas» es obedecer casi siempre; deja sin cumplir la validación con Zod que el spec ya exige
(historia 45: una respuesta malformada nunca se persiste); y hace imposible copiar un Ticket
suelto (historia 41), porque para partir el texto habría que parsear de vuelta lo que el modelo
escribió. Con objeto + renderer, el formato deja de ser una petición y pasa a ser código: las
negritas no aparecen porque no hay ninguna línea que las escriba.

**Conservar features y añadir Spec y Tickets encima.** Rechazado por redundante: serían dos
representaciones del mismo trabajo en la misma respuesta, más tokens de salida en un free tier que
ya va justo de cuota, y una pregunta permanente para quien lea el Análisis sobre cuál de las dos
manda.

**Tickets sin Spec.** Lo más barato en tokens y lo que peor le sienta al destino. Un agente que
recibe tickets sin el porqué detrás implementa la letra y se salta la intención; el paso
`/to-spec` existe justo para que eso no pase.

## Consequences

**El renderer es un módulo puro y testeable, y ahí es donde vive la promesa de «sin adorno».** Vive
en `lib/ai/`, no toca red y se prueba con Vitest contra objetos a mano. La lista negra de formato
—negritas, cursivas, tablas, emojis, code fences, encabezados con `#`— se verifica sobre su salida,
no sobre la del modelo.

**El prompt deja de ser una plantilla y pasa a ser un módulo con reglas.** Ensamblar el prompt es
ahora trabajo con suficiente sustancia propia —deducción de Intención, contrato de salida, regla de
Checks obligatorios, precedencia de Directrices— como para no ir de propina dentro del adaptador de
Gemini. Por eso se separa en su propio ticket y el adaptador queda bloqueado por él: el adaptador
necesita el schema contra el que validar.

**`ai_analyses` guarda el objeto, no el texto.** El Master Prompt se rendera al leerlo. Cambiar el
formato de salida deja de ser una migración y pasa a ser un cambio en el renderer, con los
Análisis viejos re-renderizados solos. El coste es que un Análisis histórico no conserva
literalmente el texto que se copió aquel día; se asume, porque el objeto sí conserva su contenido.

**Se retira el término Feature Prompt.** Lo sustituye Ticket Prompt. Los issues #15, #16 y #17 y
las historias 38–45 del spec hablaban en el vocabulario viejo y quedan enmendados.

**La regla de los Checks es una afirmación verificable, no un consejo.** «Ningún Ticket sin al menos
un Check» es un `refine` del schema: un Análisis que la incumpla se rechaza como malformado, con el
mismo camino de error que una respuesta corrupta.
