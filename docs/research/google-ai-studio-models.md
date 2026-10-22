# Modelos de Google AI Studio / Gemini API (octubre 2026)

Investigación del 2026-10-22. Solo fuentes primarias de `ai.google.dev`. Cada afirmación lleva al lado la página de donde sale. Fechas de «Last updated» que se vieron en las páginas:

- Models: 2026-10-22 — https://ai.google.dev/gemini-api/docs/models
- Deprecations: 2026-10-22 — https://ai.google.dev/gemini-api/docs/deprecations
- Pricing: 2026-10-22 — https://ai.google.dev/gemini-api/docs/pricing
- Rate limits: 2026-10-15 — https://ai.google.dev/gemini-api/docs/rate-limits
- Changelog — https://ai.google.dev/gemini-api/docs/changelog
- Gemma en la Gemini API: 2026-07-02 — https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api

## Resumen

1. **`gemini-3.5-flash` existe, pero quedó deprecado el 2026-10-08.** Sus peticiones se redirigen solas a `gemini-3.6-flash` ([changelog](https://ai.google.dev/gemini-api/docs/changelog), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations)). A **`gemini-3.7-flash`** le pasó lo mismo ese día, y se redirige a `gemini-3.8-flash`. Ninguno de los dos aparece ya en la página de modelos ni en la de precios.
2. Los modelos de texto vigentes con free tier son `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` y `gemini-3-flash-preview` (marcado como legacy), más Gemma 4 (`gemma-4-31b-it` y `gemma-4-26b-a4b-it`) ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
3. Los más potentes, `gemini-4-argon` (GA el 2026-10-13) y `gemini-3.1-pro-preview`, **no tienen free tier** ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
4. `gemini-3.1-flash-lite` sigue vigente, pero ya tiene fecha de retiro, el **2027-05-07**, con `gemini-3.5-flash-lite` como reemplazo ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)). Desde el 2026-09-18, la familia 2.5 solo la pueden usar quienes ya la usaban antes ([changelog](https://ai.google.dev/gemini-api/docs/changelog)).
5. En la cadena del repo, 2 de los 7 eslabones (`gemini-3.7-flash` y `gemini-3.5-flash`) están deprecados y se redirigen a modelos que ya están en la lista, así que hoy son eslabones duplicados. Los límites free tier de Gemma (RPM/TPM/RPD) **no están publicados** en la documentación: según la página de rate limits, solo se pueden ver en AI Studio.

## Catálogo vigente

Solo se incluyen los modelos de generación de texto que sirven para la cadena del repo. Imagen, audio, Live, embeddings, Lyria, Veo y agentes están en las páginas citadas. «Rango» va de más a menos capacidad. Es una inferencia que hago a partir de las frases con que Google describe cada modelo en [pricing](https://ai.google.dev/gemini-api/docs/pricing), porque Google no publica una escala ordenada.

| ID | Familia | Rango | Free tier | Estado | Fuente |
|---|---|---|---|---|---|
| `gemini-4-argon` | Gemini 4 | 1 («flagship reasoning model») | No | Stable, GA 2026-10-13 | [models](https://ai.google.dev/gemini-api/docs/models), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [changelog](https://ai.google.dev/gemini-api/docs/changelog) |
| `gemini-3.1-pro-preview` | Gemini 3 Pro | 2 | No | Preview, sin fecha de retiro | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| `gemini-3.8-flash` | Gemini 3 Flash | 3 («our most intelligent Flash model») | Sí | Stable, GA 2026-09-02, sin fecha de retiro | [models](https://ai.google.dev/gemini-api/docs/models), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| `gemini-3.6-flash` | Gemini 3 Flash | 4 («our previous generation Flash model») | Sí | Stable, GA 2026-07-21, sin fecha de retiro | ídem |
| `gemini-3-flash-preview` | Gemini 3 Flash | 5 («our legacy Flash model») | Sí | Preview, sin fecha de retiro, reemplazo sugerido `gemini-3.6-flash` | [models](https://ai.google.dev/gemini-api/docs/models), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| `gemini-3.5-flash-lite` | Gemini 3 Flash-Lite | 6 | Sí | Stable, GA 2026-07-21, sin fecha de retiro | [models](https://ai.google.dev/gemini-api/docs/models), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| `gemini-3.1-flash-lite` | Gemini 3 Flash-Lite | 7 | Sí | Stable, GA 2026-05-07, **retiro 2027-05-07** | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| `gemma-4-31b-it` | Gemma 4 (31B denso) | 8 | Sí (solo free) | Disponible, publicado el 2026-04-02 | [gemma on gemini api](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), [changelog](https://ai.google.dev/gemini-api/docs/changelog) |
| `gemma-4-26b-a4b-it` | Gemma 4 (MoE, 4B activos) | 9 | Sí (solo free) | Disponible, publicado el 2026-04-02 | ídem |

Familia 2.5 (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`): Google dice que estos modelos «are not deprecated» y que no tienen fecha de retiro, pero desde el 2026-09-18 solo los pueden usar usuarios que ya los usaban. Los proyectos nuevos deberían usar 3.5 Flash-Lite o 3.8 Flash ([models](https://ai.google.dev/gemini-api/docs/models), [changelog](https://ai.google.dev/gemini-api/docs/changelog)).

Alias: el changelog dice que `gemini-flash-latest` pasó a apuntar a `gemini-3.5-flash` el 2026-05-19 ([changelog](https://ai.google.dev/gemini-api/docs/changelog)). No encontré a qué apunta tras la deprecación del 2026-10-08, y la ficha de `gemini-3.8-flash` no lo menciona ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)).

Datos de la ficha de `gemini-3.8-flash`: admite salida estructurada. El thinking acepta los niveles `low`, `medium` y `high`; `minimal` devuelve error ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)).

## Deprecados/retiros

Estas son las que afectan a modelos de texto. Las fechas de shutdown son «la más temprana posible», y Google avisa con antelación de la fecha exacta ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)).

| ID | Qué pasa | Fecha | Reemplazo | Fuente |
|---|---|---|---|---|
| `gemini-3.7-flash` | Deprecado. Se redirige solo, y ya no se puede elegir en AI Studio | 2026-10-08 | `gemini-3.8-flash` | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [changelog](https://ai.google.dev/gemini-api/docs/changelog) |
| `gemini-3.5-flash` | Deprecado. Se redirige solo, y ya no se puede elegir en AI Studio | 2026-10-08 | `gemini-3.6-flash` | ídem |
| `gemini-3.1-flash-lite` | Vigente, con retiro programado | 2027-05-07 | `gemini-3.5-flash-lite` | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| `gemini-3.1-flash-lite-preview` | Apagado | 2026-05-25 | `gemini-3.1-flash-lite` | ídem |
| `gemini-3-pro-preview` | Apagado (ahora apunta a 3.1 Pro Preview) | 2026-03-09 | `gemini-3.1-pro-preview` | ídem, [changelog](https://ai.google.dev/gemini-api/docs/changelog) |
| `gemini-2.0-flash`, `-001`, `gemini-2.0-flash-lite`, `-001` | Apagados | 2026-06-01 | `gemini-3.6-flash` / `gemini-3.1-flash-lite` | ídem |
| `gemini-2.5-flash-lite-preview-09-2025` | Apagado | 2026-03-31 | `gemini-3.1-flash-lite` | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| `gemini-2.5-flash-preview-09-25` | Apagado | 2026-02-17 | `gemini-3.6-flash` | ídem |
| `gemini-2.5-*` (estables) | No deprecados, pero con acceso restringido a usuarios previos | desde 2026-09-18 | 3.5 Flash-Lite / 3.8 Flash | [changelog](https://ai.google.dev/gemini-api/docs/changelog) |

## Gemma vía API + límites free tier

- Según su página, la Gemini API admite estos modelos: «The Gemini API supports the following Gemma 4 models»: `gemma-4-31b-it` y `gemma-4-26b-a4b-it` ([gemma on gemini api](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)). Ojo: la propia página dice «This documentation is deprecated. Please visit the new documentation at gemma.ai».
- Los dos salieron el 2026-04-02. El changelog no recoge ningún Gemma posterior en 2026 ([changelog](https://ai.google.dev/gemini-api/docs/changelog)).
- Precio: en el free tier es «Free of charge». El paid tier aparece como «Not available» ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- **Límites free tier: no se publican.** La página de rate limits no da RPM, TPM ni RPD para ningún modelo y dice: «Rate limits depend on a variety of factors (such as your usage tier) and can be viewed in Google AI Studio» (https://aistudio.google.com/rate-limit). También deja dicho que los límites se aplican por proyecto y no por API key, y que el RPD se reinicia a medianoche hora del Pacífico ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)).
- En el foro oficial hay cifras que circulan, como 1.500 RPD o un techo de 16K TPM para Gemma 4 31B. Son posts de usuarios y no documentación, así que **no las doy por verificadas**.

## Contraste con el repo

La cadena vive en `AI_CONFIG.geminiModels` (`lib/constants.ts`, líneas 215–223). No hay una constante aparte para el modelo por defecto: el default es el primer elemento (`gemini-3.8-flash`), y el adaptador la recorre en orden (`lib/ai/adapters/gemini/index.ts:174`). El único consejo fijo en el código que menciona modelos es el mensaje genérico de `lib/ai/adapters/gemini/errors.ts:204` («Revisa el modelo configurado y la API key»). Además, `gemini-2.5-flash` aparece en tests (`components/analysis/*.test.ts`) y en comentarios como el caso histórico del 404.

| Posición | ID en el repo | Estado según la documentación | Comentario | Fuente |
|---|---|---|---|---|
| 1 | `gemini-3.8-flash` | Vigente | El Flash más capaz, con free tier | [models](https://ai.google.dev/gemini-api/docs/models) |
| 2 | `gemini-3.7-flash` | **Deprecado 2026-10-08**, se redirige a `gemini-3.8-flash` | Hoy repite el eslabón 1 | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| 3 | `gemini-3.6-flash` | Vigente | | [models](https://ai.google.dev/gemini-api/docs/models) |
| 4 | `gemini-3.5-flash` | **Deprecado 2026-10-08**, se redirige a `gemini-3.6-flash` | Hoy repite el eslabón 3 | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| 5 | `gemini-3.5-flash-lite` | Vigente | | [models](https://ai.google.dev/gemini-api/docs/models) |
| 6 | `gemini-3.1-flash-lite` | Vigente, **retiro 2027-05-07** | | [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| 7 | `gemma-4-31b-it` | Vigente | El repo dice bien que es «el más capaz de los dos Gemma» | [gemma on gemini api](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) |
| — | `gemini-2.5-flash` (tests/comentarios) | No deprecado, acceso restringido | Coincide con el 404 «no longer available to new users» que el repo vio | [changelog](https://ai.google.dev/gemini-api/docs/changelog) |
| — | `gemma-4-26b-a4b-it` (no está en la cadena) | Vigente | Posible último eslabón | ídem |

## Recomendación de orden para el selector

Uno de los requisitos del repo es que el modelo devuelva salida estructurada. Con eso en cuenta, y ordenando por capacidad de mayor a menor, solo con modelos con free tier:

1. `gemini-3.8-flash`
2. `gemini-3.6-flash`
3. `gemini-3-flash-preview`: opcional. Es legacy y preview y no tiene fecha de retiro. Añade un Flash con cuota propia (si la cuota es por modelo) antes de bajar a los Lite. Antes de incluirlo hay que verificarlo a solas con `npm run ai:live`.
4. `gemini-3.5-flash-lite`
5. `gemini-3.1-flash-lite`: vigilar el retiro del 2027-05-07.
6. `gemma-4-31b-it`
7. `gemma-4-26b-a4b-it`: opcional, y solo si pasa el schema a solas.

Quitaría `gemini-3.7-flash` y `gemini-3.5-flash`. Al redirigirse a los eslabones 1 y 3, en el mejor caso repiten un modelo que acaba de fallar y en el peor gastan presupuesto de tiempo. `gemini-4-argon` y `gemini-3.1-pro-preview` quedan fuera mientras la app dependa del free tier.

## Candidatos de reemplazo (plan gratuito)

Se buscan sustitutos para los dos eslabones deprecados (`gemini-3.7-flash` y `gemini-3.5-flash`), y solo entre modelos con free tier.

### Qué modelos tienen free tier hoy

La página de pricing marca 23 entradas como «Free of charge» ([pricing](https://ai.google.dev/gemini-api/docs/pricing)). Quitando las de audio, Live, TTS, transcripción y embeddings, que no sirven para un `generateContent` de texto con JSON, quedan estos modelos de texto: `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3-flash-preview`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-robotics-er-2-preview` y «Gemma 4». La entrada de Gemma 4 no da ID, pero la página de Gemma lista `gemma-4-31b-it` y `gemma-4-26b-a4b-it` ([gemma on gemini api](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)).

También busqué modelos que se pudieran haber escapado, y no apareció ninguno:

- **No existe `gemini-3.8-flash-lite` de texto.** El único 3.8 Flash-Lite es `gemini-3.8-flash-lite-tts` ([models](https://ai.google.dev/gemini-api/docs/models)).
- **No hay ningún modelo de texto `-exp`.** El único `-exp` es `lyria-realtime-exp` ([models](https://ai.google.dev/gemini-api/docs/models)).
- **No hay un Gemma más nuevo que Gemma 4.** Ver la [documentación de Gemma](https://ai.google.dev/gemma/docs/core), actualizada el 2026-07-08, y el [changelog](https://ai.google.dev/gemini-api/docs/changelog), cuyo último Gemma es del 2026-04-02.
- **`gemini-flash-latest`:** la documentación solo explica cómo funciona: se cambia en caliente con cada versión nueva y avisa por correo con dos semanas de antelación si el cambio rompe algo ([models](https://ai.google.dev/gemini-api/docs/models)). Su último destino documentado es `gemini-3.5-flash`, desde el 2026-05-19 ([changelog](https://ai.google.dev/gemini-api/docs/changelog)). No hay fuente primaria que diga a qué apunta hoy. Un post del foro afirma que devuelve `modelVersion: gemini-3.8-flash`, pero es un dato de usuario y no está verificado.
- **Los límites free tier en AI Studio no se pueden consultar sin sesión.** `https://aistudio.google.com/rate-limit` redirige a `accounts.google.com/ServiceLogin` (302). Ninguna página pública da cifras de RPM, TPM o RPD ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)).

### Cómo pide el repo la salida estructurada

El adaptador (`lib/ai/adapters/gemini/index.ts:107-133`) llama a `generateObject` de `ai@^7` con el proveedor de `@ai-sdk/google@4.0.63` y le pasa `schema: analysisSchema` (Zod, de `lib/ai/schema.ts`). No envía `temperature`, ni `thinkingConfig`, ni `providerOptions`.

En la versión instalada, el SDK convierte esa llamada en `generationConfig.responseMimeType: "application/json"` más `generationConfig.responseSchema`. Antes pasa el JSON Schema por `convertJSONSchemaToOpenAPISchema`, es decir, lo traduce al subconjunto OpenAPI que admite Google (`node_modules/@ai-sdk/google/dist/index.js:1996-2000`).

Con los modelos cuyo ID empieza por `gemma-`, el SDK no envía `systemInstruction` y mete las instrucciones de sistema en el primer turno del usuario (`index.js:1046-1058` y `1926`). En cambio, `responseSchema` lo envía igual a todos los modelos.

Por tanto, «compatible» significa aquí que el modelo acepta `responseMimeType: application/json` junto con `responseSchema`. La guía de salida estructurada no publica una tabla de modelos compatibles ni menciona Gemma ([structured output](https://ai.google.dev/gemini-api/docs/structured-output)). Lo que sí da es la ficha de cada modelo, con su línea «Structured outputs».

### Tabla de candidatos

| ID | Gratis | Salida estructurada compatible con el adaptador | Estado | Fecha de retiro | Contexto | Thinking | Recomendación |
|---|---|---|---|---|---|---|---|
| `gemini-3-flash-preview` | Sí ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | Sí. Su ficha dice «Structured outputs: Supported» ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview)). Falta probarlo a solas con `npm run ai:live` | Preview, descrito como «legacy Flash model» ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | Sin fecha anunciada. Reemplazo sugerido: `gemini-3.6-flash` ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)) | 1.048.576 de entrada / 65.536 de salida ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview)) | Sí ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview)) | **Añadir** en lugar de uno de los dos deprecados, detrás de `gemini-3.6-flash`. Es un Flash distinto de verdad: no se redirige a otro, como sí pasa con 3.7 y 3.5. Riesgo: al ser preview con reemplazo ya señalado, puede deprecarse, aunque las deprecaciones se anuncian con antelación. |
| `gemma-4-26b-a4b-it` | Sí («Gemma 4: Free of charge», [pricing](https://ai.google.dev/gemini-api/docs/pricing)) | **No verificado.** Ni la página de Gemma en la API ni la de salida estructurada mencionan JSON ni `responseSchema` ([gemma on gemini api](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), [structured output](https://ai.google.dev/gemini-api/docs/structured-output)). La única pista es que su hermano `gemma-4-31b-it` sí pasó el schema en el repo (comentario de `lib/constants.ts`), pero eso es evidencia empírica del repo, no documentación | La documentación no le pone etiqueta de preview ni de stable. No aparece en deprecations | Ninguna anunciada | 256K para los modelos «medium», aunque la asignación a cada variante es inferida ([gemma core](https://ai.google.dev/gemma/docs/core)) | Sí, todo Gemma 4 razona con thinking configurable ([gemma core](https://ai.google.dev/gemma/docs/core)). `"minimal"` lo desactiva ([gemma on gemini api](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)) | **Añadir solo si pasa el schema a solas**, como último eslabón (es MoE con 4B activos, más flojo que el 31B). Si no lo pasa, no añadir. |
| `gemini-2.5-flash` / `gemini-2.5-flash-lite` / `gemini-2.5-pro` | Sí en pricing ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | Sin comprobar, no viene al caso | No deprecados, pero desde el 2026-09-18 solo para usuarios que ya los usaban ([changelog](https://ai.google.dev/gemini-api/docs/changelog)) | Sin fecha anunciada ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)) | — | — | **No añadir.** El repo ya recibió un 404 «no longer available to new users» con `gemini-2.5-flash`. |
| `gemini-robotics-er-2-preview` | Sí ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | Sí. «Structured outputs: Supported» ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-robotics-er-2-preview)) | Preview | No indicada | 131.072 de entrada / 65.536 de salida ([ficha](https://ai.google.dev/gemini-api/docs/models/gemini-robotics-er-2-preview)) | Sí | **No añadir.** Es un VLM pensado para robótica, no para generar texto general, y es preview. |
| `gemini-flash-latest` | No figura en pricing como modelo propio | Sin comprobar | Alias. No hay fuente primaria que diga su destino actual ([models](https://ai.google.dev/gemini-api/docs/models)) | No aplica | — | — | **No añadir.** Lo más probable es que duplique un eslabón que ya está, y su destino cambia sin aviso salvo cuando el cambio rompe algo. |
| `gemini-3.7-flash` / `gemini-3.5-flash` (los actuales) | No figuran en pricing ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | — | Deprecados el 2026-10-08, con redirección automática a 3.8 y 3.6 ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)) | «N/A» | — | — | **Quitar.** Repiten los eslabones 1 y 3. |

Notas sobre el thinking, que en el free tier se paga en latencia y en tokens:

- **`gemini-3.6-flash`:** razona por defecto con nivel `medium`.
- **`gemini-3.5-flash-lite`:** su nivel por defecto es `minimal`.

Los dos datos salen de la misma fuente ([whats-new 3.6](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.6)). Esa página también avisa de que enviar `temperature`, `top_p` o `top_k` dará error en generaciones futuras. El adaptador no los envía.

Hay una contradicción en Gemma. El repo dice que `gemma-4-31b-it` «no razona», pero la documentación de Gemma 4 dice que todos los modelos son razonadores con thinking configurable ([gemma core](https://ai.google.dev/gemma/docs/core)). Lo más probable es que, sin `thinkingConfig`, el valor por defecto de la API sea no razonar, pero ese valor por defecto no está documentado.

### Cadena final propuesta

1. `gemini-3.8-flash`
2. `gemini-3.6-flash`
3. `gemini-3-flash-preview`: nuevo; sustituye a los dos deprecados.
4. `gemini-3.5-flash-lite`
5. `gemini-3.1-flash-lite`: retiro el 2027-05-07.
6. `gemma-4-31b-it`
7. `gemma-4-26b-a4b-it`: nuevo, condicionado a que pase el schema a solas con `npm run ai:live`. Si no lo pasa, la cadena se queda en 6.

## Preguntas abiertas

- **¿A qué cuota cuentan las peticiones redirigidas?** Una petición a `gemini-3.5-flash` que acaba en `gemini-3.6-flash` puede gastar la cuota de un modelo o la del otro. Los docs no lo dicen. Si gasta la del destino, el eslabón duplicado no aporta nada.
- **¿Qué ID devuelve la respuesta redirigida?** No sé si `modelVersion` dirá el modelo pedido o el destino. Afecta a lo que el repo guarda en `ai_analyses.model`. No está documentado.
- **¿Llegará `gemini-3.5-flash` a dar 404?** La deprecación pone «Shutdown: N/A» en lugar de una fecha, y no queda claro si algún día dejará de aceptarse el ID.
- **¿A qué apunta hoy `gemini-flash-latest`?** No está documentado tras el 2026-10-08.
- **Límites free tier exactos (RPM/TPM/RPD)** de cada modelo, Gemma incluido. Solo se ven en https://aistudio.google.com/rate-limit con la sesión del proyecto.
- **Escala de capacidad:** Google no publica un ranking. El orden de arriba sale de las descripciones de pricing y de la cronología. Dónde queda Gemma 4 31B frente a los Flash-Lite es inferencia mía.
- **Salida estructurada en `gemma-4-26b-a4b-it` y `gemini-3-flash-preview`:** no lo comprobé en sus fichas. Hay que verificarlo a solas.
