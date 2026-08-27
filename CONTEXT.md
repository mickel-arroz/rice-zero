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
Todo cambio mínimo se persiste de inmediato; no existe botón "guardar". Editar requiere conexión: sin ella la edición se bloquea con aviso y reintento automático de reconexión, quedando la consulta de lo ya creado disponible offline.

### IA

**Análisis**:
Resultado de enviar una Versión (texto serializado del árbol) a la IA: resumen, preguntas de clarificación, features estructuradas, Master Prompt y Feature Prompts.

**Master Prompt**:
Prompt técnico completo del proyecto generado por la IA, destinado a un agente de código (p. ej. Claude Code). Texto plano, mínimo e indispensable, sin adorno estético; sin límite de longitud. Se puede copiar al portapapeles o descargar como `.md`.

**Feature Prompt**:
Prompt acotado a una feature individual, derivado del mismo Análisis.

**Directrices del Usuario**:
Texto opcional que el usuario escribe antes de generar un Análisis; se inyecta con máxima precedencia en la llamada a la IA.

**Proveedor de IA**:
Implementación intercambiable detrás de la capa de IA (entrada y salida normalizadas). Gemini es el primero; el proyecto es indiferente a cuál se usa.

### Backend

**Proveedor de Backend**:
Implementación intercambiable de almacenamiento y autenticación, detrás de una interfaz que habla en términos de dominio (Proyecto, Versión, Nodo, Análisis) y no de tablas. Neon es el activo; Supabase se mantiene como implementación alternativa. Solo uno está activo a la vez, y cambiarlo no toca código de la aplicación.
_Avoid_: base de datos, BD, Supabase (como sinónimo de "el backend")
