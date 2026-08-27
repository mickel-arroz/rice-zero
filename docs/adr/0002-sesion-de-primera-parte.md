# Sesión de primera parte, y una mitad de servidor en el puerto

El spec exige que `proxy.ts` mande a login toda ruta protegida sin sesión. Para eso el servidor
tiene que poder VER la sesión, y hasta el #21 no podía: el cliente Better Auth hablaba directo con
`NEXT_PUBLIC_NEON_AUTH_URL`, así que la cookie de sesión pertenecía al dominio de Neon y nuestro
servidor no la recibía nunca.

La decisión es meter un salto propio en medio. El navegador habla con **`/api/auth`**, un Route
Handler de esta aplicación que proxea a Managed Better Auth y convierte la sesión en una cookie
**httpOnly de primera parte**, firmada con `NEON_AUTH_COOKIE_SECRET`. Y el puerto del Proveedor de
Backend crece una **mitad de servidor** (`SessionGuard`, `AuthRoute`) para que el interruptor siga
siendo uno: `NEXT_PUBLIC_BACKEND` mueve las dos mitades a la vez.

El ADR 0001 ya lo había anotado como deuda del ticket de autenticación: «renderizar en servidor con
la sesión de la petición es otra pieza —el handler de auth, el refresco de cookies, `proxy.ts`— y la
trae el ticket de autenticación (#7)». Esto es esa pieza.

## Considered Options

**Dejar la sesión en el navegador y proteger las rutas en el cliente.** Lo más barato: cero
servidor. Se rechazó porque incumple el criterio del spec tal y como está escrito, y porque el
usuario vería el armazón de la ruta protegida un instante antes del redirect, en cada carga.

**Una cookie «pista» no httpOnly, escrita por el cliente, que el proxy mire.** También barato, y la
documentación de Next bendice explícitamente las comprobaciones optimistas en el proxy. Se rechazó
porque la pista es falsificable con una línea en la consola del navegador: no habría fuga de datos
—las políticas RLS siguen siendo la autorización de verdad— pero sí acceso aparente a rutas
protegidas, y «el proxy redirige a quien no tiene sesión» dejaría de ser cierto.

**Usar `neonAuthMiddleware` y `createNeonAuth().handler()`, las piezas que el SDK trae hechas para
Next.** Se rechazaron por dos razones distintas. El middleware protege todo lo que no esté en SU
lista de exclusiones, y la lista de rutas públicas de RICE(0) es de la app (`PUBLIC_ROUTES` en
`lib/constants.ts`), no del SDK. Y el handler llega por `@neondatabase/auth/next/server`, que importa
`next/headers`: eso ataba el adaptador —guardia incluido— a correr dentro de un servidor de Next, y
lo dejaba sin poder probarse. Se usan en su lugar las primitivas agnósticas de
`@neondatabase/auth/server`, `processAuthMiddleware` y `handleAuthProxyRequest`, que reciben un
`Request` estándar y devuelven una decisión o una `Response`. Por eso ni `NextResponse` ni
`next/headers` aparecen en `lib/backend/`.

**Mover también los repositorios al servidor.** Habría hecho innecesario el `getToken` del cliente
de datos. Se rechazó porque contradice el ADR 0001 sin motivo nuevo: el navegador sigue hablando
directo con PostgREST y la autorización sigue en RLS. Lo único que cambia es de dónde sale el JWT.

## Consequences

**La confirmación de email se exige en el SERVIDOR, no en el navegador.** Cuando el handler de auth
proxea un `sign-in/email`, el SDK convierte la respuesta en cookies de primera parte ANTES de que el
adaptador del navegador pueda mirar `emailVerified`. Si el toggle «Verify at Sign-up» de la consola
del proveedor se apagara, el navegador se quedaría con una sesión viva mientras la interfaz muestra
un error, y el proxy la dejaría entrar. Por eso la regla es `canAct(session)` en
`lib/backend/ports/session.ts`, y la comprueban el guardia y cada ruta protegida.

**La comprobación del proxy es optimista, y eso es deliberado.** La documentación de Next es
explícita: el proxy «no debería ser tu única línea de defensa». Aquí la defensa real son las
políticas RLS, que no devuelven una fila ajena aunque alguien llegue a la página. Por eso
`app/projects/page.tsx` vuelve a comprobar la sesión con `requestSession()` aunque el proxy ya lo
haya hecho: si el `matcher` del proxy se equivoca algún día, la página no renderiza igualmente.

**Cuánto cuesta `sessionFor` depende del adaptador.** En Neon lee la cookie de datos de sesión que
nosotros mismos firmamos, así que un render no cuesta una llamada de red; en Supabase sí la cuesta,
porque esas cookies no las firma esta aplicación (ver más abajo). Quien la siembra y la
refresca es `gate`, que corre antes en el proxy — y `proxy.ts` sienta esas cookies en la respuesta Y
en la petición que sigue hacia abajo, porque sin la segunda mitad el Server Component de esa misma
petición leería la cookie vieja.

**Los dos adaptadores son asimétricos, y la asimetría es información.** Supabase NO monta ninguna
ruta (`authRoute: null`): su cliente de navegador ya escribe cookies de primera parte. En cambio su
guardia sí hace una llamada de red (`getUser`), porque esas cookies no las firma esta aplicación y
no hay otra forma de saber si valen. Que el puerto declare `authRoute` opcional no es una concesión
a un adaptador a medias: es la forma de la realidad.

**Cada proveedor completa OAuth en un sitio distinto**, así que el puerto tiene que preguntar en vez
de suponer. `needsGateOnPublicPath(request)` existe por eso: la vuelta de un login social puede caer
en una ruta pública y hay que canjearla, pero el nombre del parámetro es detalle del proveedor
—Managed Better Auth manda un verificador propio, Supabase manda el `code` de PKCE—. Sin esa
pregunta, entrar con Google terminaba sin sesión.

**La corrida en vivo no atraviesa `/api/auth`.** En Node no hay servidor de Next que montar, así que
`npm run test:contract:live` apunta el cliente al origen de Neon directamente. Es honesto porque
`handleAuthProxyRequest` reenvía ruta, cuerpo y cookies tal cual: el contrato entre el SDK y el proveedor
—lo único que esa corrida puede probar— es el mismo a los dos lados del proxy. Lo que queda sin
cubrir es el salto por nuestra ruta, y eso hay que verlo en `next dev`.

**Hay una variable secreta más, y perderla cierra la sesión de todo el mundo.**
`NEON_AUTH_COOKIE_SECRET` no sale de la consola de Neon: se genera con `openssl rand -base64 32`, y
tiene que existir en Vercel además de en `.env.local`. Si cambia, todas las sesiones abiertas
caducan. En cambio `NEXT_PUBLIC_NEON_AUTH_URL` dejó de ser pública y pasó a llamarse
`NEON_AUTH_URL`: ya no la usa el navegador.

**El fondo de puntos subió al layout raíz.** No es parte de esta decisión, pero es su consecuencia
práctica: con dos páginas nuevas, montar `DotPattern` en cada una era la tercera y cuarta copia de
la misma línea. En `app/layout.tsx` ninguna ruta futura puede salir sin él.
