# Proveedor de Backend intercambiable

El plan gratuito de Supabase solo admite 2 proyectos activos, así que RICE(0) se muda a Neon.
Como el detonante es administrativo y no técnico, el cambio se hace **detrás de un puerto**: un
`BackendProvider` que agrupa persistencia y autenticación tras una interfaz que habla en términos
de dominio (Proyecto, Versión, Nodo, Análisis) y no de tablas, con un adaptador por proveedor
elegido por `NEXT_PUBLIC_BACKEND`. Neon queda activo; Supabase queda dormido pero compilando, de
modo que volver sea cambiar una variable y redesplegar, no reescribir la capa de datos.

## Considered Options

**Migrar a Neon sin abstracción y confiar en git.** Es lo más barato hoy. Se rechazó porque el
motivo del cambio (un cupo de plataforma) puede volver a moverse en la dirección contraria, y
porque en el momento de decidir no había ni una línea de CRUD escrita: el puerto no es trabajo
añadido, es la capa de servicios que había que escribir igual, con un nombre y un límite.

**Puerto a nivel de cliente**, devolviendo algo con forma PostgREST. Supabase y el Data API de Neon
*son* ambos PostgREST, así que habría sido casi gratis. Se rechazó porque filtra PostgREST a cada
call site: el puerto solo sería agnóstico mientras los dos proveedores compartan protocolo, que es
justo la condición que un puerto existe para no depender de ella. Por lo mismo, `database.types.ts`
vive dentro de cada adaptador y nunca en la firma del puerto.

**Puertos separados para datos y autenticación**, que habrían permitido combinar Supabase Auth con
Neon como base de datos y esquivar así que Managed Better Auth esté en Beta. Se rechazó a favor de
un proveedor único porque el objetivo es un solo interruptor.

## Consequences

**Las políticas RLS no llaman a `auth.uid()`.** Llaman a `app.current_user_id()`, que define el
preludio de cada adaptador. Así la migración SQL es una sola, compartida, y la incógnita sobre el
tipo del id de usuario que emite Managed Better Auth (¿uuid o texto?) queda absorbida por una
función en vez de propagarse por 417 líneas. El preludio de cada proveedor aporta además la FK a su
propia tabla de usuarios y los nombres de rol (`anon` en Supabase, `anonymous` en Neon).

**Una denegación por RLS se reporta como `NotFoundError`, no como un error de permisos.** Bajo RLS
"no es tuyo" y "no existe" son el mismo resultado —cero filas—, así que la distinción no existe en
el motor. Además, distinguirlas le confirmaría a un atacante que el recurso existe. Es deliberado:
no es un caso sin cubrir.

**El proveedor incluye la autenticación, así que las cuentas de usuario no viajan al cambiar de
adaptador.** Aceptable en un producto de un solo usuario por proyecto; sería un bloqueante en
cualquier otro escenario.

**Managed Better Auth está en Beta** y queda en el camino crítico de los user stories 3–6 del spec.
El puerto es también la mitigación: si la Beta se rompe, el adaptador es el único código a tocar.
