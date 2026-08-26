# RICE(0)

PWA mobile-first para volcar ideas de proyectos en un árbol de nodos de texto
y transformar cada versión del árbol en prompts estructurados para agentes de
IA.

El vocabulario del producto (Proyecto, Versión, Nodo, Análisis…) vive en
[`CONTEXT.md`](CONTEXT.md).

## Puesta en marcha

La app necesita un proyecto de Supabase con el esquema aplicado. El wizard lo
monta entero — crea el proyecto, captura las credenciales en `.env.local`,
aplica la migración, verifica el aislamiento entre usuarios y configura Vercel:

```bash
bash scripts/setup-wizard.sh
```

Es idempotente: puedes cortarlo con Ctrl-C y volver a lanzarlo, que recuerda lo
que ya guardó. Al terminar:

```bash
npm install
npm run dev
```

## Comandos

| Comando             | Qué hace                                  |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en `localhost:3000` |
| `npm run build`     | Build de producción                       |
| `npm test`          | Tests (Vitest)                            |
| `npm run typecheck` | TypeScript sin emitir                     |
| `npm run lint`      | ESLint                                    |

## Base de datos

- `supabase/migrations/` — las migraciones, en orden. Se aplican pegándolas en
  el SQL Editor de Supabase (el wizard lo hace por ti).
- `supabase/tests/verify_rls_and_clone.sql` — comprueba contra el motor real
  que RLS aísla a cada usuario y que clonar una Versión copia el árbol entero
  con la jerarquía remapeada. Hace `rollback`: no deja rastro.
- `lib/supabase/database.types.ts` — la forma del esquema en TypeScript.
  Regenerable con `npx supabase gen types typescript --project-id <ref>
  --schema public`. Si tocas una migración, actualízalo en el mismo commit.

Solo `lib/supabase/` y `lib/services/` pueden importar los SDKs de Supabase;
todo lo demás recibe datos ya resueltos por servicios tipados. ESLint lo
impide, no es una convención de palabra.
