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
| `npm run account:live`       | Registra la cuenta de usar y tirar que pide la corrida en vivo   |
| `npm run account:verify`     | Confirma su email sin buzón, con la conexión de dueño            |
| `npm run test:contract:live` | La contract suite contra el proveedor activo. Bajo demanda; falla si no hay credenciales |
| `npm run ai:live`            | Tres generaciones de verdad contra Gemini. Bajo demanda; falla si no hay API key |

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

### Probar el adaptador activo

La contract suite en memoria ejercita el núcleo compartido, que es casi todo el
código — pero no el SDK del proveedor. Eso solo se prueba en vivo, y hace falta
una cuenta con el email confirmado:

```bash
npm run account:live        # registra la cuenta y comprueba que NO deja entrar sin confirmar
npm run account:verify      # confirma el email sin buzón, con la conexión de dueño
npm run test:contract:live  # la contract suite entera contra el proveedor activo
```

`account:verify` hace lo que haría el enlace del correo. Existe para que la
cuenta de test no dependa de un buzón real; lo que no cubre es el envío del
correo, que es del ticket de auth (#7). Si prefieres el flujo completo, salta
ese paso y pincha el enlace que manda el proveedor.

Las dos necesitan `BACKEND_CONTRACT_LIVE=1`, `BACKEND_CONTRACT_EMAIL` y
`BACKEND_CONTRACT_PASSWORD`, y sin ellas salen con código 1 en lugar de fingir
que pasaron. ⚠ Esa cuenta es de usar y tirar: la suite **borra todos sus
Proyectos** entre bloques.

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

## El Proveedor de IA

Mismo patrón que el Proveedor de Backend, y por la misma razón: `CONTEXT.md` dice
que «el proyecto es indiferente a cuál se usa», y eso solo es verdad mientras
nadie importe un SDK fuera de su adaptador. `AI_PROVIDER` es el interruptor
—`gemini` o `falso`— y no tiene default: un despliegue al que se le olvidara
serviría Análisis inventados sin que nadie se enterara.

- `lib/ai/*.ts` — el **contrato**, y nada más: el schema de Zod (`schema.ts`), el
  prompt (`prompt.ts`), el render a texto (`render.ts`), el puerto (`port.ts`) y
  la taxonomía de fallos (`errors.ts`). Módulos puros: ESLint les prohíbe
  importar cualquier cosa que no sea Zod o código del repo, y leer `process.env`.
- `lib/ai/adapters/gemini/` — el único sitio del repo donde se puede importar
  `ai` y `@ai-sdk/google`, y el único que lee `GEMINI_API_KEY`. Es
  `server-only`: importarlo desde un componente de cliente rompe el build.
- `lib/ai/factory/` — el interruptor. Lee la variable y devuelve el adaptador.
  **No** se reexporta desde `lib/ai/index.ts` a propósito: por esa puerta entra
  también el navegador (el panel usa el renderer), y reexportar la fábrica
  arrastraría el SDK de Google a un bundle de cliente.
- `lib/ai/testing/contract.ts` — la contract suite, una sola para todos los
  adaptadores. Corre contra el falso en `npm test`.

Los modelos NO se configuran por entorno: son `AI_CONFIG.geminiModels` en
`lib/constants.ts`, una **lista en orden de preferencia** que se intenta de
arriba abajo.

Es una lista y no un modelo porque el free tier se congestiona de verdad: el
2026-09-04, tres de los cuatro Flash de la lista contestaban `503 — This model
is currently experiencing high demand` a la vez, y una generación se perdía
entera teniendo otros modelos libres. Quién decide si un fallo justifica pasar
al siguiente es `shouldTryAnotherModel`, y la regla es «¿tiene esto pinta de ser
culpa DE ESTE modelo?»:

| categoría | ¿pasa al siguiente? | por qué |
|---|---|---|
| `red` | sí | el 503 de «high demand» es exactamente esto |
| `cuota` | sí | los límites del free tier son por modelo, y un rechazo no gasta cuota |
| `configuracion` | sí | aquí cae el 404 del modelo retirado |
| `timeout` | sí | y apenas importa: el presupuesto ya casi no da para otro |
| `malformada` | **no** | el modelo contestó; otro no lo hará mejor. Se reintenta |
| `entrada` | **no** | el problema es el árbol, no el modelo |

El orden baja en capacidad a propósito: se acepta un Análisis peor antes que
ninguno. **La degradación no es silenciosa** — `analyze()` devuelve qué modelo
contestó de verdad y eso se guarda en `ai_analyses.model`, así que un Análisis
flojo siempre se puede explicar.

**Verificar la lista son DOS comprobaciones, no una.** La página de pricing dice
qué modelos EXISTEN con free tier; no dice cuáles lo SIRVEN hoy. La segunda es
`npm run ai:live`, y hay que hacerla. `gemini-2.5-flash` salió de la lista por un
`404 — no longer available to new users`.

El último eslabón es Gemma y no otro Flash: es el más capaz de los dos que
expone la API, no razona —así que es el que más probabilidades tiene de caber en
lo que quede del presupuesto— y admite salida estructurada, que es lo único que
lo hacía elegible. Un modelo que no sepa devolver un objeto no es un plan B, es
un eslabón roto.

Ojo al tiempo: `AI_CONFIG.timeoutMs` es el presupuesto de la generación
**entera**, cadena incluida, no de cada intento — cinco modelos a dos minutos
cada uno serían diez minutos de peor caso. Un Análisis real tarda ~40 s, así que
está en dos minutos, y la ruta que monte el panel tiene que declarar un
`maxDuration` por encima. Un plan de despliegue que corte sus funciones antes no
puede servir esta app tal cual.

### Las dos mitades de generar un Análisis

La generación está partida porque sus dos mitades corren en sitios distintos, y
`lib/services/analyses.ts` es la costura:

1. **Generar, en el servidor.** El Server Action de
   `app/(dashboard)/projects/[projectId]/[versionId]/actions.ts`. Ahí está la
   API key y ahí se queda. Es un punto de entrada público, así que exige sesión
   y valida lo que le manden antes de gastar una petición de cuota.
2. **Persistir, en el navegador.** Como todo lo demás (ADR 0001): directo a
   PostgREST y bajo las mismas políticas RLS que un Nodo.

El action DEVUELVE sus fallos en vez de lanzarlos: en producción Next sustituye
un error del servidor por un mensaje genérico, así que una taxonomía lanzada
desde ahí llegaría al panel como «An error occurred». El servicio los vuelve a
convertir en excepción al otro lado.

`ai_analyses` guarda el **objeto** del Análisis, no su texto (ADR 0003). El
Master Prompt se rendera al leerlo, así que cambiar el formato de salida es un
cambio en `lib/ai/render.ts` y no una migración.
