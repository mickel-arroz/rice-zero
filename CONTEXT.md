# RICE(0)

PWA mobile-first para volcar ideas de proyectos en un árbol de nodos de texto y transformar cada versión del árbol en prompts estructurados para agentes de IA. El nombre: "Rice" (apodo del creador) + "(0)" (el inicio de algo — aquí nacen los proyectos). Escritura canónica: **RICE(0)**.

## Language

### Estructura

**Proyecto**:
Contenedor raíz de una idea de producto/software. Pertenece a un único usuario; solo su creador puede verlo y editarlo.

**Versión**:
Una línea completa e independiente del árbol de un Proyecto. Todas las versiones son editables siempre; clonar una crea un snapshot independiente (sin merge posible, nunca). Borrable salvo la última que quede.
_Avoid_: branch, rama

**Nodo**:
Unidad de idea en texto dentro del árbol de una Versión. Tiene exactamente un padre (o es raíz) y 0..n subnodos; todo nodo puede tener hijos. Solo texto — no existen adjuntos.
_Avoid_: elemento, tarjeta, adjunto

### Vistas

**Vista Canvas**:
El árbol como diagrama interactivo (@xyflow/react) con layout **siempre automático**: arrastrar re-parenta, nunca decora. En móvil es solo consulta (pan/zoom/leer), sin edición.
_Avoid_: grafo, mapa

**Vista Registro**:
Edición del árbol mediante inputs de texto relacionados visualmente por líneas, operada únicamente con botones (crear, mover, re-parentar, borrar). Es la vista de edición en móvil.
_Avoid_: outliner, vista lista, vista simple

### Comportamiento

**Autoguardado**:
Todo cambio mínimo se persiste de inmediato; no existe botón "guardar". Editar requiere conexión: sin ella la edición se bloquea con aviso y reintento automático de reconexión, quedando la consulta de lo ya creado disponible offline. Lo tecleado justo antes del corte queda **Pendiente** —retenido en la pantalla, nunca dado por guardado— y se escribe solo al volver la red; no hay cola de sincronización, así que cerrar la pestaña sin conexión lo pierde.

### IA

**Análisis**:
Resultado de enviar una Versión (texto serializado del árbol) a la IA: Intención, resumen, preguntas de clarificación, Spec y Tickets. La IA lo devuelve estructurado y validado; lo que se lee y se pega siempre es su render a texto.
_Avoid_: features estructuradas

**Intención**:
Qué clase de trabajo pide el árbol, deducida por la IA del propio contenido y de las Directrices del Usuario: `proyecto-nuevo`, `feature`, `fix`, `refactor`, `ui`, `infra`, `docs` u `otro`. Un árbol no siempre describe un proyecto desde cero — puede ser un arreglo sobre algo ya construido — y la Intención es lo que impide que el Análisis lo dé por supuesto. No se elige en la UI: se corrige escribiendo Directrices.
_Avoid_: tipo, modo, categoría

**Spec**:
La parte del Análisis que fija el porqué antes del qué: problema, solución, decisiones de implementación, decisiones de testing y out of scope, con sus propios Checks. Uno por Análisis.

**Ticket**:
Unidad ejecutable derivada del Spec: título, qué construir, sus Checks y los Tickets que lo bloquean. Todo Nodo del árbol —padre e hijo por igual— queda representado en algún Ticket, y ningún Ticket existe sin Checks.
_Avoid_: feature, tarea, historia

**Check**:
Criterio de aceptación binario y verificable de un Spec o de un Ticket. Se renderiza como `- [ ]`. Son la prueba de que la tarea se cumplió: sin Checks nada se da por terminado.
_Avoid_: criterio, AC, checkbox

**Master Prompt**:
El Análisis entero renderizado a texto para pegar en un agente de código (p. ej. Claude Code): Intención, resumen, preguntas, Spec y todos los Tickets con sus Checks. Markdown mínimo funcional —`- `, `1. `, `- [ ]` y líneas de título— y nada más: sin negritas, cursivas, tablas, emojis ni code fences. Sin límite de longitud. Copiable al portapapeles y descargable como `.md`.

**Ticket Prompt**:
El mismo render acotado a un solo Ticket, con el contexto mínimo del Spec para que valga por sí solo.
_Avoid_: Feature Prompt

**Historial**:
Todos los Análisis de una Versión, del más nuevo al más viejo. El primero es el **vigente**: el que el panel enseña por defecto. Cualquiera se puede abrir y exportar —un Análisis viejo se re-rendera con el renderer de hoy— y borrar a mano con confirmación, pero ninguno se edita nunca. Es el otro lado de la hoja del Panel de IA, no otra pantalla.
_Avoid_: versiones del Análisis, revisiones

**Directrices del Usuario**:
Texto opcional que el usuario escribe antes de generar un Análisis; se inyecta con máxima precedencia en la llamada a la IA. Es también la única palanca para corregir la Intención que la IA dedujo.

**Proveedor de IA**:
Implementación intercambiable detrás de la capa de IA (entrada y salida normalizadas). Gemini es el primero; el proyecto es indiferente a cuál se usa.

### Backend

**Proveedor de Backend**:
Implementación intercambiable de almacenamiento y autenticación, detrás de una interfaz que habla en términos de dominio (Proyecto, Versión, Nodo, Análisis) y no de tablas. Neon es el activo; Supabase se mantiene como implementación alternativa. Solo uno está activo a la vez, y cambiarlo no toca código de la aplicación.
_Avoid_: base de datos, BD, Supabase (como sinónimo de "el backend")
