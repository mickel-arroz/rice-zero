# Backend para RICE(0): Supabase vs Firebase vs Neon (planes gratuitos)

## Cómo usar este doc

El detonante es administrativo, no técnico: la cuenta gratuita de Supabase no deja crear un tercer
proyecto activo. Este documento averigua si eso obliga a cambiar de backend, y qué costaría hacerlo.

Toda cifra viene de documentación, pricing o changelog **oficiales**, con la URL al lado. Verificado el
**2026-08-27**. Donde una fuente oficial no confirma un dato, este doc lo dice en lugar de rellenarlo:
ver §7, "Lo que no pude confirmar". Los blogs de terceros y las respuestas de foros se usaron solo para
localizar la página oficial, y entonces se cita la oficial.

Los cuatro requisitos contra los que se mide todo salen del spec (#1) y de `CONTEXT.md`:

1. **RLS owner-only** — "solo yo pueda ver y editar mis proyectos", con la propiedad resuelta
   atravesando Proyecto → Versión → Nodo y aplicada por el motor, no por la app.
2. **Clonado profundo transaccional** — clonar una Versión copia el árbol entero con `parent_id`
   remapeado, atómicamente, en una sola operación.
3. **Autoguardado** — "todo cambio mínimo se persiste de inmediato; no existe botón guardar".
   Mutaciones estructurales al instante, texto con debounce corto.
4. **Auth Google + email con confirmación obligatoria**.

---

## 1. Resumen ejecutivo

**Recomendación: quedarse en Supabase.** El límite del plan Free son **2 proyectos activos**, y
**los proyectos pausados no cuentan** para esa cuota
([Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)) — así que el problema se
resuelve liberando un hueco (borrar un proyecto muerto, o dejar que uno inactivo se autopause a la
semana), no cambiando de backend. Ojo: crear una segunda organización **no** sirve; el límite se cuenta
sobre todas las organizaciones donde eres Owner o Admin.

Las otras dos opciones se pagan caras. **Firebase (Spark) es la peor de las tres para este producto**:
Firestore da **20.000 escrituras/día** ([pricing](https://firebase.google.com/pricing)), y el
Autoguardado del spec es precisamente una máquina de escrituras pequeñas; las Security Rules no
pueden expresar la jerarquía owner-only sin `get()`, que **se factura como lectura** y está topado a
**10 llamadas por operación / 20 por batch**
([rules-conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)); y las
1.200 líneas de SQL, RLS, RPC y verificación del commit `45a2a28` se tiran enteras.

**Neon es el plan B creíble**: Postgres real, **100 proyectos** en el plan Free
([plans](https://neon.com/docs/introduction/plans)), RLS nativa y una función `auth.uid()` que
devuelve `uuid` igual que la de Supabase
([pg_session_jwt](https://neon.com/docs/extensions/pg_session_jwt)). La migración SQL porta con
cirugía puntual. El precio: Neon Auth ("Managed Better Auth") está **en Beta**
([overview](https://neon.com/docs/neon-auth/overview)) y `lib/supabase/server.ts` se reescribe.

Un dato que conviene no malinterpretar: **Cloud Functions exige Blaze**, confirmado
([get-started](https://firebase.google.com/docs/functions/get-started)) — pero eso **no** impide el
clonado transaccional en servidor, porque en este proyecto el servidor es Vercel, no Firebase. Ver §3.4.

---

## 2. Tabla comparativa contra los 4 requisitos

| Requisito | Supabase (Free) | Firebase (Spark) | Neon (Free) |
|---|---|---|---|
| **RLS owner-only jerárquica** | Nativa. Ya implementada y verificada con dos usuarios contra el motor real | Solo vía `get()` en rules, **facturado como lectura** y topado a 10/op y 20/batch. La alternativa (denormalizar `ownerId` en cada Nodo) deja una invariante que el motor no puede imponer | Nativa (mismo Postgres). `auth.user_id()` / `auth.uid()` vía `pg_session_jwt` |
| **Clonado profundo transaccional** | RPC `clone_project_version`, un `INSERT ... SELECT` con CTE `materialized`, atómico, ya escrito y probado | Posible con `WriteBatch`/transacción del Admin SDK desde Vercel (atómico), topado por 10 MiB de request y por la cuota diaria de escrituras. Colisiona con el tope de `get()` de las rules | La misma RPC, sin cambios. Invocable por `.rpc()` del Data API o por conexión directa |
| **Autoguardado** | Sin cuota diaria de escrituras en el plan Free; el límite es de tamaño (500 MB) y egress (5 GB) | **20.000 escrituras/día**, tope duro que devuelve error al agotarse. Riesgo directo | Sin cuota diaria de escrituras; el límite es 0,5 GB/proyecto y 100 CU-hours/mes |
| **Auth Google + email confirmado** | Ambos de serie, 50.000 MAU, email de confirmación incluido | Ambos de serie, 50.000 MAU. La confirmación **no bloquea** el login por defecto: se impone en rules con `request.auth.token.email_verified` (gratis) o con blocking functions (**Blaze**) | Managed Better Auth: ambos, hasta 60.000 MAU, `requireEmailVerification`. **En Beta** |
| **Qué sobrevive del commit `45a2a28`** | **Todo** | Prácticamente **nada** de la capa de datos (~1.200 líneas de SQL + tipos + clientes) | La migración con cirugía puntual, los tipos, el test de RLS adaptado; se reescriben los clientes |

---

## 3. Los límites, uno por uno

### 3.1 Supabase — plan Free

Fuente principal: [supabase.com/pricing](https://supabase.com/pricing).

| Concepto | Valor citado |
|---|---|
| Proyectos activos | "Limit of 2 active projects" |
| Proyectos pausados | "you can have as many paused projects as you want. Just pause and unpause them as needed" |
| Tamaño de BD | "500 MB database size (Shared CPU • 500 MB RAM)" |
| Auth MAU | "50,000 monthly active users" |
| Egress | "5 GB egress" + "5 GB cached egress" |
| Pausa por inactividad | "Free projects are paused after 1 week of inactivity" |

**Por cuenta o por organización.** Este es el punto que decide si abrir una segunda organización
resuelve el problema. La respuesta es **no**. La
[Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) dice: *"You are entitled to two
active free projects"*, que *"Within an organization, we count the free project limits from all members
that are either Owner or Admin"* y que *"Paused projects do not count towards your quota"*. La
[misma FAQ](https://supabase.com/docs/guides/platform/billing-faq) y el
[troubleshooting de pausado](https://supabase.com/docs/guides/troubleshooting/pausing-pro-projects-vNL-2a)
son consistentes: se admiten dos organizaciones Free y "unlimited amount of paused ones", pero el
cupo de **2 activos se cuenta en total**, no por organización.

Traducción operativa: repartir dos proyectos entre dos organizaciones es legal, pero no da un tercero.

**Mecánica de pausa y reanudación.**
[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing):

- Disparador: *"A Free plan project is considered inactive if it does not receive sufficient user
  database activity over the past week."* Basta con "a few user requests to the database each day"
  para evitarlo. Supabase avisa por email antes de pausar.
- Reanudar: desde el Dashboard, seleccionar el proyecto pausado → **"Resume project"** → confirmar.
- Integridad: *"The project will return to its previous state, including data and configurations."*
  No hay en la documentación ninguna advertencia de pérdida de datos al reanudar.
- Ventana de restauración: *"Once the project is paused, there is a 1-year window to restore the
  project on the platform from within Supabase Studio."* Pasado eso, el
  [troubleshooting](https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause)
  dice que el proyecto ya no se restaura desde Studio, que se pueden descargar backup de BD y objetos
  de Storage *"before the project is deleted"*, y que *"Once a project is deleted, all associated data
  including backups is permanently removed."*

**El "90 días" es historia, no política vigente.** El
[changelog del 2024-06-24](https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days)
anunció que *"paused Free projects are restorable for 90 days following their pause date"*. La página
de docs actual dice **1 año**, aunque conserva el ancla `#90-day-window-to-restore` — resto del cambio.
Tomo el texto vigente de la doc (1 año) como fuente y anoto la inconsistencia en §7.

**Riesgo real de pausar/reanudar: bajo.** Reanudar es un botón, conserva datos y configuración, y la
ventana es de un año. Lo único que no está documentado es **cuánto tarda** la reanudación (§7).

**Cómo desbloquear el tercer proyecto, sin pagar y sin cambiar de backend:**

1. **Borrar un proyecto muerto.** Instantáneo. Irreversible: borra también los backups.
2. **Dejar que uno se autopause.** Gratis y reversible, pero tarda ~1 semana de inactividad y no hay
   una pausa manual documentada (§7).
3. **Segunda organización.** No sirve: el cupo es global. Descartado por la propia FAQ.

Para el tamaño de RICE(0), los otros límites del Free no aprietan: un árbol de Nodos es texto, 500 MB
son muchísimos Nodos, y 5 GB de egress no se rozan con una PWA personal.

### 3.2 Firebase — plan Spark (gratis)

Fuente principal: [firebase.google.com/pricing](https://firebase.google.com/pricing).

| Producto | Límite Spark citado |
|---|---|
| Authentication | "50K MAUs"; SAML/OIDC "50 MAUs" |
| Cloud Firestore — datos | "1 GiB total" |
| Cloud Firestore — lecturas | "50K reads/day" |
| Cloud Firestore — escrituras | **"20K writes/day"** |
| Cloud Firestore — borrados | "20K deletes/day" |
| Cloud Firestore — egress | "10 GiB/month" |
| Hosting | "10 GB" almacenamiento, "360 MB/day" transferencia |
| Cloud Functions | **"Not applicable"** en toda la columna del tier gratuito |

Sin tarjeta: [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
— *"No payment information needed to get started or to use only the no-cost Firebase products."*

#### Auth

Google y email/contraseña son proveedores estándar de Firebase Authentication
([password-auth](https://firebase.google.com/docs/auth/web/password-auth)), dentro de los 50K MAU sin
coste. La verificación de email existe (`sendEmailVerification`, propiedad `emailVerified`,
[manage-users](https://firebase.google.com/docs/auth/web/manage-users)) pero **la documentación no dice
en ningún sitio que Firebase bloquee el login de un email no verificado**: no lo hace por defecto. Para
convertirlo en obligatorio hay dos caminos:

- **Gratis**: exigirlo en las Security Rules. `request.auth.token` incluye `email_verified`
  ([rules-and-auth](https://firebase.google.com/docs/rules/rules-and-auth)), así que las reglas pueden
  denegar todo a quien no lo tenga. El usuario puede iniciar sesión, pero no ve ni escribe nada.
- **Blaze**: blocking functions de Identity Platform, que son Cloud Functions y por tanto de pago.

Es decir: el requisito 4 se cumple gratis, pero con una semántica distinta a la de Supabase (login
permitido, datos denegados) y con la regla replicada en cada colección.

#### Cloud Functions: sí, exigen Blaze — y no, no es lo que bloquea el clonado

Este era el punto con información contradictoria en la web. Está confirmado por **dos** fuentes
oficiales independientes:

- [Get started: write, test, and deploy your first functions](https://firebase.google.com/docs/functions/get-started):
  *"to deploy functions, your project must be on the Blaze pricing plan"*, con la aclaración de que
  *"you can emulate functions in any Firebase project"* — emular sí, desplegar no.
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans):
  *"Paid Google Cloud products and features (like Pub/Sub, Cloud Run, or BigQuery streaming for
  Analytics) are not available for projects on the Spark pricing plan"*, y al degradar de Blaze a Spark
  *"you cannot do new deploys of any new or any existing Cloud Functions"*.
- La [tabla de pricing](https://firebase.google.com/pricing) marca "Not applicable" en toda la columna
  Spark de Cloud Functions.

**Pero el spec (#1) despliega en Vercel**, y exige una capa de servicios con Server Actions. El código
de servidor de RICE(0) no vive en Firebase: vive en Vercel. Desde ahí se puede usar el **Firebase Admin
SDK** con una service account contra Firestore, que **sí** está en Spark. Por tanto el clonado
transaccional en servidor **es posible gratis** — lo que Blaze bloquea son los triggers de Firestore,
las scheduled functions y las blocking functions de Auth, ninguno de los cuales pide el spec.

Conclusión honesta: el "Cloud Functions exige Blaze" es cierto y es un límite real de la plataforma,
pero **no es el motivo por el que Firebase sale mal parado aquí**. Los motivos son los tres siguientes.

#### Modelado del árbol en Firestore y clonado profundo

El modelo natural es de subcolecciones:

```
projects/{projectId}                       { ownerId, title, description, ... }
projects/{p}/versions/{v}                  { versionNumber, label, sourceVersionId, ... }
projects/{p}/versions/{v}/nodes/{n}        { parentId | null, content, orderIndex, ... }
projects/{p}/versions/{v}/analyses/{a}     { ... }
```

`parent_id` y `order_index` se traducen tal cual a campos del documento; la consulta del árbol es un
`where versionId == v` (o el listado de la subcolección) y el ensamblado se hace en cliente, igual que
en el diseño actual.

**Atomicidad y tamaño del clonado.** Los batched writes y las transacciones **son atómicos**:
[Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)
— *"In a set of atomic operations, either all of the operations succeed, or none of them are applied"*
y *"Transactions never partially apply writes."*

El histórico "500 operaciones por batch" **ya no aparece** en la página oficial de cuotas
([Firestore quotas](https://firebase.google.com/docs/firestore/quotas)). Lo que sí está documentado ahí
y acota de verdad un clonado:

- *"Maximum API request size: 10 MiB"* — el techo real de un `WriteBatch`.
- *"Maximum number of field transformations that can be performed on a single document in a Commit
  operation or in a transaction: 500"* — por documento, no por batch; irrelevante aquí.
- *"Time limit for a transaction: 270 seconds, with a 60-second idle expiration time"*.
- *"Transactions will fail when the client is offline"* (transactions, no batched writes).

Con un Nodo de texto típico (unos cientos de bytes), 10 MiB dan del orden de decenas de miles de
documentos por batch: **el tamaño del árbol no es el problema**. El problema es el segundo párrafo.

#### El choque real: 20.000 escrituras/día contra el Autoguardado

`CONTEXT.md` define Autoguardado como *"todo cambio mínimo se persiste de inmediato; no existe botón
guardar"*, y el spec lo desglosa en mutaciones estructurales inmediatas y texto con debounce corto.
En Firestore, cada una de esas persistencias es **una escritura facturada contra un tope diario duro de
20.000** ([pricing](https://firebase.google.com/pricing)). Y un clonado de una Versión de 300 Nodos
consume 300 escrituras de golpe: 66 clonados agotan el día. Al agotarse la cuota, Firestore devuelve
error hasta el reinicio diario — es decir, la app deja de guardar.

En Supabase y en Neon no existe una cuota diaria de escrituras en el plan gratuito: el límite es de
tamaño y de cómputo, que se degradan suavemente y no se agotan por teclear.

Este es, de lejos, el argumento cuantitativo más fuerte contra Firebase para **este** producto.

#### Security Rules y la jerarquía owner-only

La propiedad en RICE(0) es transitiva: un Nodo es mío porque su Versión es mía porque su Proyecto es
mío. En Postgres eso son los helpers `is_project_owner` / `is_version_owner`, `security definer`, que
resuelven la cadena sin coste por fila. En Firestore la única forma de hacer un "join" en reglas es
`get()`/`exists()`, y la documentación es explícita sobre lo que cuesta
([rules-conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)):

> *"Using these functions executes a read operation in your database, which means you will be billed
> for reading documents even if your rules reject the request."*

Y los topes:

- Peticiones de un solo documento y queries: **máximo 10** llamadas de acceso por evaluación de regla.
- Lecturas multidocumento, **transacciones y batched writes: máximo 20 en total**, con el límite de 10
  aplicándose a cada operación individual del batch.
- *"Exceeding either limit results in a permission denied error."*

Un clonado de 300 Nodos por batch, con una regla que llame a `get()` sobre la Versión o el Proyecto,
choca de frente con ese 20. La doc menciona que *"some document access calls may be cached, and cached
calls do not count towards the limits"* — como el documento consultado sería siempre el mismo, es
plausible que el caché salve el caso, pero **la documentación no garantiza cuándo cachea** (§7). Apostar
la operación central del producto a un caché no especificado es mal negocio.

La salida estándar es **denormalizar `ownerId` en cada documento de Nodo** y escribir reglas sin
`get()`. Funciona y es barato, pero degrada la garantía: un cliente malicioso puede crear un Nodo con
*su propio* `ownerId` colgando de la Versión de otro, y la regla lo aceptará porque no mira hacia
arriba. La invariante que hoy impone `nodes_parent_same_version` en el motor pasaría a ser una promesa
de la aplicación. Para un producto cuyo user story 11 es "solo yo pueda ver y editar mis proyectos",
es un retroceso.

#### Firebase Data Connect / SQL Connect (Postgres sobre Cloud SQL)

Es la vía para tener Postgres dentro de Firebase, y no es gratis a medio plazo
([SQL Connect pricing](https://firebase.google.com/docs/sql-connect/pricing)):

- Producción: **plan Blaze**. En Spark la funcionalidad está limitada a ~**8.300 operaciones/día**.
- Trial en Spark: **90 días**, una instancia, ~8.000 operaciones/día. Al expirar, la instancia queda
  **archivada** y se **borra 90 días después** si no se sube a Blaze.
- Trial en Blaze: **3 meses** con una `db-f1-micro`; *"After 3 months, you are charged according to
  standard Cloud SQL pricing."* Máximo 5 trials por cuenta de facturación y 1 instancia de trial por
  proyecto. Cualquier cambio de configuración durante el trial sale del periodo gratuito y empieza a
  facturar.

Es decir: Data Connect es un trial con fecha de caducidad, no un free tier. No compite con Supabase ni
con Neon en este escenario.

### 3.3 Neon — plan Free

Fuente: [Neon plans](https://neon.com/docs/introduction/plans).

| Concepto | Valor citado |
|---|---|
| Proyectos | **100** |
| Almacenamiento | "0.5 GB/project" |
| Cómputo | "100 CU-hours/project" al mes (≈400 h de una instancia de 0,25 CU) |
| Autoescalado | "Up to 2 CU (8 GB RAM)" |
| Ramas | "10/project" |
| Scale-to-zero | "After 5 min" de inactividad; *"cannot disable"* en el plan Free |
| Egress | "5 GB included" |
| Snapshots | "1 manual snapshot"; retención de monitorización "1 day" |
| Auth (MAU) | "Up to 60k MAU" |

**Los 100 proyectos son la respuesta directa al problema del usuario.** El scale-to-zero a los 5
minutos es el análogo del pausado de Supabase, pero automático, reversible sin intervención y sin
ventana de caducidad: el proyecto no se "pausa" administrativamente, solo se apaga el cómputo.

#### RLS y el sustituto de `auth.uid()`

Neon soporta RLS de Postgres porque **es** Postgres. Lo que aporta Neon es la pieza que falta:
cómo llega la identidad del usuario a la política. Esa pieza es la extensión **`pg_session_jwt`**
([docs](https://neon.com/docs/extensions/pg_session_jwt)), que expone en el esquema `auth`:

| Función | Qué devuelve |
|---|---|
| `auth.user_id()` | El claim `sub` del JWT de la sesión, como texto |
| `auth.uid()` | Lo mismo **tipado como `uuid`**; `NULL` si `sub` no es un UUID válido |
| `auth.session()` / `auth.jwt()` | El payload completo del JWT como `jsonb` |
| `auth.jwt_session_init(token)` | Fija el JWT de la sesión en implementaciones propias |

`auth.uid()` con firma `() -> uuid` es **literalmente la misma función que usan hoy las políticas de
`20260826120000_initial_schema.sql`**. Ese es el hallazgo que hace portable la migración.

La extensión tiene dos modos:

- **Con JWK configurado**: valida la firma del JWT. Es como opera el Data API de Neon.
- **Modo compatible con PostgREST**: sin JWK, lee los claims del parámetro `request.jwt.claims`, el
  mismo GUC de sesión que usa Supabase y que ya usa `supabase/tests/verify_rls_and_clone.sql`.

Advertencia oficial sobre el segundo modo, importante para no montarlo mal:

> *"When using the fallback mode without JWK validation, `request.jwt.claims` is a regular Postgres
> parameter that can be modified by any database user. Ensure your application sets these claims
> securely before executing user queries."*

**El patrón de GUC de sesión sí está soportado con el pooler**, y además es el patrón que Neon
documenta para backends ([rls-query-execution](https://neon.com/docs/guides/rls-query-execution)):

> *"When setting up connection pooling over WebSockets or TCP using `@neondatabase/serverless` and
> `Pool`, you must open a transaction and manually inject the verified claims using `set_config`."*

Concretamente: abrir transacción → `set_config('request.jwt.claims', <claims verificados>, true)` (el
`true` lo hace local a la transacción, que es lo que aísla la sesión entre peticiones del pool) →
ejecutar las queries. La conexión debe usar un rol restringido (`DATABASE_AUTHENTICATED_URL`, p. ej.
`authenticated_backend`), **nunca** `neondb_owner`, que tiene `BYPASSRLS` y se salta todas las
políticas. La misma página advierte que *"The `$withAuth` method in Drizzle is deprecated; instead, set
JWT claims in the transaction context."*

Nota de encaje: `pg_session_jwt` *"is automatically installed when you enable the Neon Data API for a
branch"*, y la doc dice *"Do not install this extension manually."* O sea, para tener `auth.uid()` hay
que habilitar el Data API en la rama aunque después se hable con Postgres por conexión directa (§7).

#### Roles y Data API

El Data API expone Postgres como REST **compatible con PostgREST**
([get-started](https://neon.com/docs/data-api/get-started)), con `.rpc('function_name', {...})` entre
sus operaciones — es decir, `clone_project_version` se invoca igual que hoy. Los roles por defecto son
`authenticated` y `anonymous`, ambos `NOLOGIN`, por lo que no sirven para conexiones directas de
backend; para eso se crea un rol propio restringido. Frente al `anon` de Supabase, el cambio es de
nombre (`anon` → `anonymous`).

#### Auth: qué sustituye a Supabase Auth

**Neon Auth**, hoy renombrado **"Managed Better Auth"**
([overview](https://neon.com/docs/neon-auth/overview)):

- Qué es: *"the managed authentication service in the Neon backend for apps and agents. It stores
  users, sessions, and auth configuration directly in your Neon database."*
- Estado: **Beta**. *"The Managed Better Auth is in Beta."*
  ([best-practices](https://neon.com/docs/neon-auth/best-practices)).
- Proveedores: Google OAuth y email/contraseña, con flujos de reset de contraseña.
- Datos: *"All authentication data is stored in the `neon_auth` schema. It's queryable with SQL and
  compatible with Row Level Security (RLS) policies."* Y *"Built-in Data API integration: JWT token
  validation for the Data API has native support for Managed Better Auth."*
- Plan: *"included in all Neon plans based on Monthly Active Users (MAU): Free (up to 60,000 MAU)…"*

La confirmación de email obligatoria existe en Better Auth como opción de primera clase
([email-password](https://www.better-auth.com/docs/authentication/email-password)):
`emailAndPassword: { requireEmailVerification: true }`, con la semántica exacta que pide el spec —
*"users must verify their email before they can log in"*, y en cada intento de login sin verificar se
reenvía el correo.

Frente a Supabase, dos diferencias prácticas: es **Beta**, y no encontré en la documentación de Neon
si el servicio gestionado incluye el envío de correos o hay que enchufar un proveedor (Resend, SMTP)
— en Better Auth autohospedado, `sendVerificationEmail` es un callback que implementas tú (§7).

La alternativa madura es **Better Auth autohospedado** (o Auth.js) contra la misma BD de Neon, con
adaptador Postgres; se pierde la integración nativa con el Data API y hay que emitir/verificar el JWT
a mano antes del `set_config`, que es exactamente el flujo que documenta `rls-query-execution`.

---

## 4. Qué sobrevive del ticket #6 (commit `45a2a28`), archivo por archivo

Inventario del commit (18 archivos, 6.629 inserciones). Se excluye `package-lock.json`.

### 4.1 Si se queda en Supabase

**Sobrevive todo, sin tocar una línea.** Ni la migración, ni el test SQL, ni los clientes, ni el
wizard, ni la regla de ESLint, ni los tipos. La única acción es administrativa: liberar un hueco de
proyecto activo (§3.1) y ejecutar `scripts/setup-wizard.sh`.

Este es el argumento de coste: cambiar de backend hoy tira entre 500 y 1.200 líneas ya escritas,
revisadas y verificadas contra el motor real, para resolver un problema de cupo de plataforma.

### 4.2 Si se migra a Neon

| Archivo | Veredicto | Qué hay que hacer |
|---|---|---|
| `supabase/migrations/20260826120000_initial_schema.sql` | **Adaptar** (mayoría intacta) | Ver detalle abajo. Renombrar el directorio a `db/migrations/` |
| `supabase/tests/verify_rls_and_clone.sql` | **Adaptar** | El cuerpo del test vale entero: `set local request.jwt.claims` es el mismo mecanismo en ambos. Cambia solo el alta de los dos usuarios de prueba (`auth.users` → tabla de usuarios de `neon_auth`, o inserción directa si se quita la FK) y `set local role anon` → `anonymous` |
| `lib/supabase/database.types.ts` | **Sobrevive** | Mismo Postgres, mismas tablas, mismas columnas. Solo se mueve a `lib/db/database.types.ts`. Si el id de usuario deja de ser `uuid` (§7), cambia el tipo de `owner_id` |
| `lib/supabase/client.ts` + `client.test.ts` | **Adaptar** | La forma (cliente perezoso, memoizado, una instancia por pestaña, construido desde `readEnv`) se conserva; cambia el constructor a `@neondatabase/neon-js` contra el Data API. El test apenas cambia |
| `lib/supabase/server.ts` + `server.test.ts` | **Tirar y reescribir** | No hay `@supabase/ssr`. La sesión la lleva Better Auth y las cookies las gestiona él. Lo que sí se conserva es la **decisión de diseño** documentada en el archivo: un cliente nuevo por render, nunca compartido entre peticiones. El nuevo módulo abre la transacción y hace el `set_config('request.jwt.claims', …, true)` |
| `lib/env.ts` + `lib/env.test.ts` | **Sobrevive casi entero** | `MissingEnvError`, `requireEnv` y la política de no filtrar el valor en el error valen igual. Se reescribe solo `readSupabasePublicEnv` |
| `lib/constants.ts` | **Sobrevive** | Cambian `ENV_KEYS` (nombres de variables) y el texto de `SETUP_WIZARD_PATH`. El resto (rutas, enlaces, tema, dot pattern) no se entera |
| `eslint.config.mjs` | **Adaptar** | La regla vale tal cual; cambian los patrones: `@supabase/*` → `@neondatabase/*` (+ el cliente de auth), y `@/lib/supabase/*` → `@/lib/db/*` |
| `scripts/setup-wizard.sh` | **Adaptar** | La biblioteca del wizard (líneas 1–~160) es agnóstica y sobrevive intacta. Se reescriben las etapas: crear proyecto Neon, habilitar Data API, configurar Google OAuth en Better Auth, aplicar la migración, env vars de Vercel |
| `vitest.config.ts` | **Sobrevive** | |
| `.env.example` | **Adaptar** | Nuevas claves |
| `.gitignore` | **Sobrevive** | |
| `README.md` | **Adaptar** | Sección de setup |
| `package.json` | **Adaptar** | Fuera `@supabase/ssr` y `@supabase/supabase-js`; dentro `@neondatabase/neon-js` / `@neondatabase/serverless` y Better Auth |

**Portabilidad de la migración SQL, punto por punto.** Casi todo el archivo es Postgres estándar y no
se toca: `gen_random_uuid()`, `pg_advisory_xact_lock`, `hashtextextended`, los `check`, los índices,
`touch_updated_at`, `assign_version_number`, el CTE `materialized` del clonado y `set search_path = ''`
funcionan igual en Neon. Lo que hay que cambiar es exactamente esto:

1. **`references auth.users (id) on delete cascade`** — `auth.users` es una tabla de Supabase Auth y no
   existe en Neon. Dos salidas: apuntar la FK a la tabla de usuarios del esquema `neon_auth`, o quitar
   la FK y dejar `owner_id` sin referencia (perdiendo el borrado en cascada al eliminar la cuenta, que
   habría que hacer explícito). El nombre exacto de esa tabla no lo pude confirmar (§7).
2. **`auth.uid()`** — **no cambia**. `pg_session_jwt` expone `auth.uid() -> uuid` con la misma
   semántica. Las 12 políticas y los dos helpers quedan como están… **siempre que el id de usuario sea
   un UUID**; si Better Auth emite ids de texto, hay que pasar a `auth.user_id()` y `owner_id text`
   (§7). Es el único cambio que se propaga por todo el archivo.
3. **Rol `anon`** — se llama `anonymous` en Neon. Afecta a los `revoke ... from public, anon,
   authenticated` y a los `revoke execute ... from public, anon`. Renombrado mecánico.
4. **Rol `authenticated`** — existe con el mismo nombre. Los `grant` no cambian. Ojo: es `NOLOGIN`, así
   que la conexión de backend necesita **además** un rol propio (p. ej. `authenticated_backend`) que
   herede esos privilegios y **no** tenga `BYPASSRLS`.
5. **Helpers `security definer`** (`is_project_owner`, `is_version_owner`) — Postgres puro, funcionan
   igual. Se mantienen `stable` y con `search_path` vacío.
6. **Constraint trigger diferido** (`nodes_parent_same_version`) — `deferrable initially deferred` es
   estándar y Neon lo soporta. **No cambia.** Sigue siendo lo que permite que el clonado inserte el
   árbol entero en una sentencia sin importar el orden padre/hijo.
7. **RPC `clone_project_version`** — **no cambia**, ni su cuerpo ni su `security invoker`. Se invoca
   por `.rpc()` del Data API o por conexión directa dentro de la transacción con los claims puestos.
8. **Privilegios por defecto** — el bloque de `revoke all` existe porque Supabase reparte privilegios a
   `anon`/`authenticated` al crear tablas. En Neon ese reparto automático no ocurre igual, pero el
   bloque es inofensivo y conviene conservarlo: expresa la intención y es idempotente.

Resumen: de 417 líneas de migración, cambian del orden de 10–15, todas concentradas en la FK a
`auth.users` y en el renombrado de `anon`.

### 4.3 Si se migra a Firebase

| Archivo | Veredicto | Qué hay que hacer |
|---|---|---|
| `supabase/migrations/20260826120000_initial_schema.sql` | **Tirar entero** (417 líneas) | Firestore no tiene esquema, ni RLS, ni triggers, ni funciones. Se sustituye por `firestore.rules` + `firestore.indexes.json` y por invariantes movidas a la capa de servicios |
| `supabase/tests/verify_rls_and_clone.sql` | **Tirar entero** (387 líneas) | Se rehace con el emulador de Firestore y `@firebase/rules-unit-testing`. La cobertura equivalente (dos usuarios, escritura cruzada, anónimo) es reproducible, pero es código nuevo |
| `lib/supabase/database.types.ts` | **Tirar entero** (163 líneas) | Firestore no genera tipos desde el esquema. Se sustituye por tipos escritos a mano + validación en runtime (Zod), que el spec ya usa para la IA |
| `lib/supabase/client.ts` + `client.test.ts` | **Tirar y reescribir** | `initializeApp` + `getFirestore`. Se conserva la idea de cliente memoizado |
| `lib/supabase/server.ts` + `server.test.ts` | **Tirar y reescribir** | No hay equivalente de `@supabase/ssr` (cookies de sesión gestionadas por el SDK). Se reescribe con Firebase Admin SDK + session cookies; la protección de rutas en `proxy.ts` cambia de mecanismo |
| `lib/env.ts` + `lib/env.test.ts` | **Sobrevive casi entero** | `MissingEnvError` y `requireEnv` valen. `readSupabasePublicEnv` pasa a leer 6 claves de config de Firebase + la service account del servidor |
| `lib/constants.ts` | **Sobrevive** | Solo cambian `ENV_KEYS` y el texto del wizard |
| `eslint.config.mjs` | **Adaptar** | Misma regla, patrones `firebase/*`, `firebase-admin/*` |
| `scripts/setup-wizard.sh` | **Adaptar** | Biblioteca intacta; etapas reescritas (crear proyecto Firebase, habilitar Auth Google + email, crear service account, desplegar reglas) |
| `vitest.config.ts` | **Sobrevive** | Habría que añadir el emulador para los tests de reglas |
| `.env.example`, `README.md`, `package.json` | **Adaptar** | |
| `.gitignore` | **Sobrevive** | Y hay que añadir la service account key |

Además, fuera del commit pero dentro del spec, se reabren decisiones ya cerradas: el modelo de datos
(§3.2), la invariante "un Nodo y su padre viven en la misma Versión" (que deja de ser imponible por el
motor), y el presupuesto de escrituras del Autoguardado.

---

## 5. Recomendación

**Quedarse en Supabase y liberar un hueco de proyecto activo.**

El razonamiento, en orden de peso:

1. **El bloqueo es administrativo y tiene salida gratuita documentada.** 2 proyectos activos, pausados
   ilimitados y que no cuentan para la cuota. Borrar un proyecto muerto lo resuelve hoy; dejar uno
   inactivo lo resuelve en una semana. Lo único que **no** funciona —y merecía comprobarse— es abrir
   una segunda organización.
2. **El coste de cambiar es alto y el beneficio, cero funcional.** Ni Firebase ni Neon aportan una sola
   capacidad que el spec necesite y Supabase no tenga. Neon aporta *cupo*, no funcionalidad.
3. **Firebase está peor alineado con este producto en concreto**, y no por Cloud Functions: por las
   20.000 escrituras/día contra un producto cuyo contrato explícito es "todo cambio mínimo se persiste
   de inmediato", y por unas reglas que no saben hacer joins baratos sobre una jerarquía de tres
   niveles.

**Plan B, si el cupo vuelve a estorbar o Supabase deja de convenir: Neon.** 100 proyectos gratis,
Postgres real, `auth.uid()` idéntico, la migración porta con ~15 líneas de cambio y la RPC de clonado
no se toca. El coste concentrado está en la autenticación (Managed Better Auth en Beta) y en reescribir
`lib/supabase/server.ts`.

**Firebase: descartado** para RICE(0) mientras el plan sea Spark.

Si se decide migrar a Neon, el orden sensato es: (1) crear el proyecto y habilitar el Data API para que
aparezca `pg_session_jwt`; (2) verificar en una rama de usar y tirar el tipo del id de usuario que emite
Managed Better Auth (§7) — de eso depende si la migración cambia 15 líneas o 40; (3) portar la
migración; (4) adaptar `verify_rls_and_clone.sql` y ejecutarlo, que es la prueba de que la migración
está bien hecha.

---

## 6. Riesgos

- **Supabase.** El proyecto se autopausa a la semana de inactividad; un proyecto personal que se toca a
  ratos puede acabar pausado varias veces al año, y reanudarlo es un clic pero introduce latencia
  imprevista. Mitigación: cualquier tráfico diario contra la BD lo evita.
- **Supabase.** Borrar un proyecto para liberar cupo es **irreversible y se lleva los backups**
  ([delete-project](https://supabase.com/docs/guides/platform/delete-project) vía el troubleshooting
  citado). Antes de borrar, descargar backup.
- **Neon.** Managed Better Auth está **en Beta**: puede cambiar de API o de comportamiento sin
  compatibilidad hacia atrás. Es el componente del que cuelgan los user stories 3–6 del spec.
- **Neon.** El modo PostgREST de `pg_session_jwt` sin validación de JWK confía en que la aplicación
  ponga los claims correctamente: si un rol de aplicación pudiera ejecutar SQL arbitrario, podría
  suplantar a otro usuario. Con la conexión directa desde Vercel el riesgo es contenido, pero exige
  disciplina (rol restringido, `set_config` local a la transacción, JWT verificado antes).
- **Neon.** Scale-to-zero a los 5 minutos no se puede desactivar en el plan Free; la primera petición
  tras el reposo paga un arranque en frío cuya duración no está documentada (§7).
- **Firebase.** El tope de 20.000 escrituras/día no degrada: corta. Y el clonado consume tantas
  escrituras como Nodos tenga el árbol.
- **Firebase.** Denormalizar `ownerId` para evitar `get()` en reglas convierte una invariante del motor
  en una promesa de la aplicación.
- **Transversal.** Precios y cuotas de los tres proveedores cambian sin previo aviso. Todo lo de aquí
  está verificado el 2026-08-27; antes de decidir por dinero, revisar las páginas citadas.

## 7. Lo que no pude confirmar en fuente oficial

1. **Cuánto tarda Supabase en reanudar un proyecto pausado.** La doc describe el botón "Resume
   project" y garantiza que los datos y la configuración vuelven, pero **no da ninguna cifra de
   tiempo**. No la invento.
2. **Si existe una pausa manual en Supabase para proyectos Free.** La documentación de pausado solo
   describe la pausa **automática** por inactividad; el troubleshooting de proyectos Pro dice que "Pro
   projects at the moment cannot be paused" y sugiere transferirlos a una organización Free para que se
   pausen, lo que **implica** que la pausa la dispara la plataforma, no el usuario. No encontré ninguna
   página oficial que documente un botón de pausar.
3. **La ventana de restauración: 90 días o 1 año.** El
   [changelog de 2024-06-24](https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days)
   dice 90 días; la [doc actual](https://supabase.com/docs/guides/platform/free-project-pausing) dice
   1 año y conserva el ancla `#90-day-window-to-restore`. Tomo la doc como vigente, pero la
   contradicción está sin resolver en las fuentes oficiales.
4. **Si Firestore cachea de forma garantizada los `get()` repetidos al mismo documento dentro de un
   batch.** La doc dice "some document access calls **may** be cached" — "may", sin especificar cuándo.
   De ello depende que un clonado grande pase o falle con "permission denied".
5. **Si el límite histórico de 500 operaciones por `WriteBatch` sigue vigente.** **No aparece** en la
   página oficial de cuotas de Firestore consultada hoy; el límite que sí está documentado es el de
   10 MiB de tamaño de petición. No afirmo que el 500 se haya eliminado, solo que no lo encontré
   documentado.
6. **El tipo del id de usuario que emite Managed Better Auth en Neon** (UUID o texto). Es la diferencia
   entre que `auth.uid()` funcione tal cual en las políticas actuales o haya que pasar todo a
   `auth.user_id()` y `owner_id text`. Verificable en 10 minutos contra una rama de prueba.
7. **El nombre exacto de la tabla de usuarios del esquema `neon_auth`**, necesaria para la FK que hoy
   apunta a `auth.users`. La doc confirma que existe el esquema y que es consultable por SQL, pero no
   vi el nombre de la tabla.
8. **Si Managed Better Auth incluye el envío de correos de verificación o exige un proveedor externo.**
   La doc de Neon que revisé no menciona SMTP, remitente ni límites de envío. En Better Auth
   autohospedado, el envío es un callback que implementa la aplicación.
9. **El estado GA/beta del Neon Data API.** Ninguna de las páginas del Data API que consulté lleva
   etiqueta de estado, a diferencia de Managed Better Auth, que sí dice "Beta" explícitamente.
10. **La duración del arranque en frío de Neon tras el scale-to-zero.** La doc confirma el
    comportamiento y el umbral de 5 minutos, no la latencia de despertar.

## 8. Fuentes

**Supabase**
- [Pricing & Fees](https://supabase.com/pricing)
- [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
- [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Troubleshooting: How To Restore a Project Paused for More Than 1 Year](https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause)
- [Troubleshooting: Pausing Pro-Projects](https://supabase.com/docs/guides/troubleshooting/pausing-pro-projects-vNL-2a)
- [Changelog: Paused Free Plan projects are restorable for 90 days (2024-06-24)](https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days)

**Firebase**
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Cloud Functions: Get started](https://firebase.google.com/docs/functions/get-started)
- [Firestore: Usage and limits (quotas)](https://firebase.google.com/docs/firestore/quotas)
- [Firestore: Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules: Writing conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Security Rules and Firebase Authentication](https://firebase.google.com/docs/rules/rules-and-auth)
- [Auth: Password authentication (Web)](https://firebase.google.com/docs/auth/web/password-auth)
- [Auth: Manage users (Web)](https://firebase.google.com/docs/auth/web/manage-users)
- [SQL Connect / Data Connect: Pricing and billing](https://firebase.google.com/docs/sql-connect/pricing)

**Neon**
- [Neon plans](https://neon.com/docs/introduction/plans)
- [The pg_session_jwt extension](https://neon.com/docs/extensions/pg_session_jwt)
- [Row-Level Security with Neon](https://neon.com/docs/guides/row-level-security)
- [Secure your app with RLS (tutorial)](https://neon.com/docs/guides/rls-tutorial)
- [Run RLS queries from your backend](https://neon.com/docs/guides/rls-query-execution)
- [Data API: Get started](https://neon.com/docs/data-api/get-started)
- [Data API: Custom authentication providers](https://neon.com/docs/data-api/custom-authentication-providers)
- [Neon Auth overview (Managed Better Auth)](https://neon.com/docs/neon-auth/overview)
- [Neon Auth best practices & FAQ](https://neon.com/docs/neon-auth/best-practices)

**Better Auth**
- [Email & Password](https://www.better-auth.com/docs/authentication/email-password)
