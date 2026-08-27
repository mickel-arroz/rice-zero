# RICE(0)

PWA mobile-first para volcar ideas de proyectos en un árbol de nodos de texto
y transformar cada versión del árbol en prompts estructurados para agentes de
IA.

El vocabulario del producto (Proyecto, Versión, Nodo, Análisis…) vive en
[`CONTEXT.md`](CONTEXT.md).

## Puesta en marcha

La app necesita un **Proveedor de Backend** con el esquema aplicado. Neon es el
activo; Supabase se mantiene como implementación alternativa. Solo uno está
activo a la vez, y lo decide `NEXT_PUBLIC_BACKEND`
([ADR](docs/adr/0001-proveedor-de-backend-intercambiable.md)).

Un wizard por proveedor: captura las credenciales en `.env.local`, aplica el
esquema, verifica el aislamiento entre usuarios y deja el interruptor puesto.

```bash
bash scripts/setup-neon.sh       # el activo
bash scripts/setup-supabase.sh   # el alternativo
```

Los dos sourcean `scripts/wizard-lib.sh`, que es la biblioteca agnóstica: no
sabe de ningún proveedor y existe una sola vez, para que la UX no pueda
divergir entre wizards.

Son idempotentes: puedes cortarlos con Ctrl-C y volver a lanzarlos, que
recuerdan lo que ya guardaron. Al terminar:

```bash
npm install
npm run dev
```

## Comandos

| Comando                      | Qué hace                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| `npm run dev`                | Servidor de desarrollo en `localhost:3000`                      |
| `npm run build`              | Build de producción                                             |
| `npm test`                   | Tests (Vitest). Incluye la contract suite en memoria            |
| `npm run typecheck`          | TypeScript sin emitir. Es lo que mantiene vivo el adaptador dormido |
| `npm run lint`               | ESLint                                                          |
| `npm run db:apply`           | Aplica el esquema al proveedor que dice `NEXT_PUBLIC_BACKEND`. **Persiste** |
| `npm run verify:neon`        | Verifica el esquema contra Neon. Hace `rollback`                |
| `npm run verify:supabase`    | Igual, contra un Supabase local en Docker. Bajo demanda         |
| `npm run test:contract:live` | La contract suite contra el proveedor activo. Bajo demanda; falla si no hay credenciales |

## El Proveedor de Backend

```
lib/backend/
├── index.ts       el interruptor: NEXT_PUBLIC_BACKEND, mapa estático
├── ports/         entidades de dominio, repositorios, taxonomía de errores
├── adapters/
│   ├── postgrest/ núcleo compartido por los dos (no importa ningún SDK)
│   ├── neon/      @neondatabase/* + Managed Better Auth
│   └── supabase/  @supabase/*
└── testing/       adaptador en memoria + contract suite compartida
```

Dos límites, y ESLint los aplica — no son convenciones de palabra:

- un SDK de vendedor solo se importa dentro de `lib/backend/adapters/<n>/`;
- un adaptador solo se importa desde dentro de `lib/backend/`. Fuera, la app
  llama a `getBackend()` y habla con el puerto.

Los errores que el puerto puede lanzar son cinco: `NotFoundError`,
`ConflictError`, `NetworkError`, `UnauthenticatedError` y `MissingEnvError`. Una
denegación por RLS se reporta como `NotFoundError` a propósito: bajo RLS «no es
tuyo» y «no existe» son cero filas, y distinguirlas confirmaría que el recurso
existe.

## Base de datos

Una sola migración compartida y un preludio corto por proveedor. Esa es la razón
por la que las políticas llaman a `app.current_user_id()` y nunca a `auth.uid()`.

- `db/migrations/` — el esquema, sin nombrar a ningún proveedor.
- `db/preludes/<proveedor>.sql` — la identidad del usuario, la FK a su tabla de
  cuentas y el nombre del rol anónimo (`anon` en Supabase, `anonymous` en Neon).
- `db/tests/verify_rls_and_clone.sql` — comprueba contra el motor real que RLS
  aísla a cada usuario y que clonar una Versión copia el árbol entero con la
  jerarquía remapeada. Corre dentro de una transacción que se rueda atrás.
- `db/tests/<proveedor>/users.sql` — el alta de los dos usuarios de prueba, lo
  único de la verificación que sabe de qué proveedor se trata.
- `db/tests/identity.sql` — comprueba la forma de `app.current_user_id()` que
  dejó el preludio (firma, retorno, `security definer`, `stable`, quién la
  ejecuta) y la sustituye por una que lee los claims de la sesión. Hace falta
  porque en producción la identidad sale de un JWT firmado y desde psql no hay
  JWT que presentar; apoyarse en el modo de compatibilidad del motor hacía que la
  verificación fallara de forma intermitente.
- `lib/backend/adapters/<proveedor>/database.types.ts` — la forma del esquema en
  TypeScript, una copia por adaptador porque las genera cada CLI. Si tocas la
  migración, actualízalas en el mismo commit: `schema-check.ts` rompe el
  typecheck si dejan de encajar con `rows.ts`.
