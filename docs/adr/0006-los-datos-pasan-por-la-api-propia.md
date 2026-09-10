# Los datos pasan por la API propia antes de llegar al motor

El ADR 0001 decidió que el navegador hablara DIRECTO con PostgREST y que la autorización se
quedara en RLS. El ADR 0002 metió un salto propio para la autenticación —`/api/auth`— y, en sus
opciones consideradas, **rechazó por escrito** mover también los repositorios al servidor:
«contradice el ADR 0001 sin motivo nuevo… lo único que cambia es de dónde sale el JWT».

Este ADR reabre esa decisión, así que lo primero que debe hacer es nombrar el motivo nuevo. Son dos,
y ninguno estaba sobre la mesa entonces:

**El JWT deja de existir en el navegador.** No estaba en `localStorage` —vivía en un closure de
`buildClient()`— pero eso daba igual, porque `/api/auth/token` estaba abierto: cualquier script del
origen canjeaba la cookie httpOnly por un JWT firmado con una línea. Eso convertía un XSS en
**exfiltración de credencial**: un token portátil, usable desde otra máquina, sin la pestaña de la
víctima abierta, hasta su `exp`, contra toda la superficie del Data API. Después del cambio —y solo
porque ese endpoint también se cierra— un XSS queda reducido a actuar a través del navegador de la
víctima, mientras la página esté abierta, por las operaciones que el puerto declare. Pierde
portabilidad y persistencia, no alcance.

**El cable pasa de todo PostgREST a 23 operaciones de dominio.** Con el token en la mano se podía
pedir cualquier columna de cualquier tabla, con cualquier filtro, sin tope y con relaciones
embebidas. Eso no era un problema de confidencialidad —RLS acota cada consulta a las filas propias—
sino de integridad: cuatro reglas del dominio viven solo en código de navegador (que un Proyecto no
se quede sin Versiones, que el árbol no tenga ciclos, que un Análisis inválido no se persista, que
el contenido de un Nodo tenga un tamaño), y con un cliente HTTP cualquiera y un JWT propio eran
saltables.

La decisión: el navegador llama a rutas REST de esta aplicación bajo `app/api/`, y son ellas las que
hablan con el Data API **con el JWT del usuario**. El puerto no cambia; aparece un adaptador más
(`adapters/http/`) que lo cumple, y el `ServerBackendProvider` crece una tercera mitad (`data`), de
modo que `NEXT_PUBLIC_BACKEND` sigue siendo un solo interruptor.

## Considered Options

**Dejarlo como está.** La opción nula, y ya ganó una vez. Se rechaza por los dos motivos de arriba,
que no existían cuando ganó: entonces no se había visto que `/api/auth/token` convertía la cookie en
credencial portátil, y no había cuatro reglas de dominio escritas en el navegador porque casi no
había dominio escrito.

**Usar `DATABASE_URL` desde el servidor, «ya que estamos en el servidor».** Rechazada de plano, y hay
que escribirlo porque es el argumento que va a reaparecer. `neondb_owner` tiene BYPASSRLS: con él,
cada uno de los 23 handlers pasa a ser un sitio donde falta un `where owner_id` a un descuido de
distancia, y **ningún test lo cazaría** —la contract suite es monousuario por construcción, porque
el harness abre una sola sesión—. Todo lo que el ADR 0001 encadenó (`app.current_user_id()`, el
`security definer`, «una denegación por RLS se reporta como `NotFoundError`») quedaría de adorno. La
autorización tiene que seguir estando en el motor.

**Un endpoint genérico `{tabla, filtros, valores}`.** Rechazada: sería PostgREST bajo nuestro
dominio, con dos agravantes. No compra ninguna de las dos reducciones de superficie que motivan
esto, y encima pasa a estar autenticado por cookie, que es alcanzable por CSRF. Es además lo que el
ADR 0001 rechazó como puerto, pagando ahora un salto de red por hacerlo.

**Cortar por `RowStore` en vez de por los repositorios.** Ocho métodos en vez de veintitrés, pero el
cable seguiría diciendo «lee de esta tabla con este filtro» —el mismo poder con otro nombre— y
multiplicaría los viajes: `versions.delete` son tres llamadas al `RowStore`, y cada una pasaría a
ser un viaje completo.

**Server Actions en vez de Route Handlers.** Tiene dos ventajas reales que las rutas no tienen, y
por eso se deja escrito. Con `experimental.useOffline` puesto (`next.config.ts`), Next reintenta
solo un Server Action que se queda sin red — media implementación del Autoguardado. Y **Next valida
`Origin`/`Host` automáticamente en las Actions y no lo hace en los Route Handlers**. Se rechaza
porque lo pedido es una superficie HTTP legible y versionable bajo `app/api/`, y porque una Action
solo sabe POST, que es mal encaje para veintitrés operaciones de las que la mitad son lecturas. El
coste queda asumido: la comprobación de origen se escribe a mano, en un solo sitio
(`lib/backend/http/route.ts`), y un `fetch` a nuestras rutas no hereda el reintento automático
—igual que no lo heredaba el SDK de Neon.

**Endpoints con forma de repositorio en vez de servicio.** No se rechaza: se acepta a sabiendas, y
es la deuda de esta decisión. Ver la última consecuencia.

**Apagar el Data API en Neon, o revocarle los grants a `authenticated`.** Es la ÚNICA opción que
haría literalmente cierto «el usuario no puede acceder directo al motor». Se rechaza por coste:
obligaría al servidor a hablar SQL con `pg_session_jwt`, añade una dependencia que el repo no tiene
y toca la migración compartida con Supabase. Su rechazo es la razón por la que la frase de arriba
sigue sin ser cierta, y por eso está aquí y no en un comentario.

## Consequences

**Esto NO es una frontera de autorización nueva, y hay que decirlo en voz alta.** La autorización
sigue siendo RLS, y quien tenga la sesión del usuario llega exactamente a los mismos datos, ahora a
través de nuestras rutas. Los dos hosts del proveedor siguen alcanzables desde internet. Lo que se
compra es reducción de superficie y de la vida útil de lo que un atacante se lleva; llamarlo de otra
forma sería mentirle a quien lea esto dentro de seis meses.

**Y NO arregla las cuatro reglas de integridad, solo las esconde mejor.** Mientras el Data API siga
encendido, `nodes.content` sigue sin tope, los ciclos siguen siendo insertables y un Proyecto sigue
pudiendo quedarse sin Versiones para quien llegue con un JWT propio. Eso se arregla en la migración
—`check`, trigger, RPC—, donde vale para los dos caminos y no cuesta un salto. Este ADR lo deja
apuntado, no resuelto.

**`/api/auth/token` se cierra, y sin eso la ganancia principal es cero.** La ruta de auth reenvía
cualquier segmento al proveedor; ahora `isBlockedAuthPath` deja `token` fuera. Se puede cerrar
porque quien pide ese JWT es el servidor y lo hace en proceso. Es un 404 y no un 403: «esta ruta no
existe aquí» es la verdad y es lo que menos información da.

**Aparece una superficie CSRF que antes no existía.** El camino de datos se autorizaba con un bearer
token, que un formulario ajeno no puede añadir: era inmune por construcción. Ahora se autoriza con
una cookie, que el navegador manda sola. La cookie es `SameSite=Lax` —el SDK hace
`cookieConfig.sameSite ?? "lax"` pese a que sus tipos anuncien `strict`, y este proyecto no la
configura—, y `Lax` ya bloquea el POST cross-site. Encima va una comprobación explícita de `Origin`
y del tipo de contenido, porque *same-site* no es *same-origin*: bajo un dominio propio, un
subdominio hermano comprometido pasaría el filtro de la cookie y no pasa el nuestro.

**El service worker cachearía las lecturas si nadie lo impidiera.** `defaultCache` de
`@serwist/turbopack` atrapa TODO GET de nuestro origen bajo `/api/` con `NetworkFirst`, dieciséis
entradas, veinticuatro horas y diez segundos de espera. Con las lecturas como GET, el árbol de una
Versión acabaría ahí, y una red lenta serviría una copia de ayer con `useOffline()` sin enterarse y
el editor desbloqueado — el fallo que el ADR 0005 declara inaceptable. Por eso el punto de montaje
entero está en `NEVER_CACHED` (`lib/pwa/cache.ts`), y va el montaje y no las cuatro rutas para que
una ruta futura nazca fuera.

**Una ruta de datos sin sesión responde 401 en JSON, no 302 a HTML.** Un `fetch` sigue un redirect y
se encuentra el login donde esperaba datos. La decisión del guardia es la misma; solo se dibuja en
el protocolo que quien pregunta entiende. NO se resuelve metiendo las rutas en `PUBLIC_ROUTES`, y no
solo porque mentiría: esa lista viaja al proveedor como `skipRoutes`, así que una ruta de ahí **no
refresca la cookie de sesión**, y en esta app se pueden pasar veinte minutos emitiendo solo
peticiones de datos.

**Todo lo que era un viaje son dos, más el arranque de la función.** Conviene alinear la región de
las funciones con la del proyecto de Neon (`us-east-2` en el `.env.example`), o se paga la travesía
dos veces. Y el autoguardado deja de ser gratis en compute: cada escritura es una invocación, así
que el debounce pasa a ser también una decisión de facturación.

**El servidor necesita un JWT por petición, y su caché es lo más delicado del cambio.** Se cachea
con la COOKIE DE SESIÓN como clave y nunca con el id de usuario: así un token solo vuelve a quien lo
consiguió, y una sesión nueva falla la caché sola. Con el id habría que invalidar al cerrar sesión
desde un sitio que ya no puede avisar —el navegador no alcanza la memoria del servidor—, y olvidarlo
sería servirle a la sesión nueva el token de la vieja. La caché se acota podando lo caducado antes
de desalojar por antigüedad, para que el trasiego de sesiones muertas no eche a una que está
trabajando.

**El adaptador dormido sigue vivo, y esta vez casi gratis.** `clientFor` ya existía para el guardia y
`createSupabaseRowStore` ya aceptaba ese cliente, así que su mitad de datos son tres líneas. Es la
promesa del ADR 0001 puesta a prueba: volver sigue siendo cambiar una variable.

**La corrida en vivo deja de cubrir el camino de datos de la app.** Sigue probando el contrato
SDK↔proveedor, que es lo único que puede probar sin un servidor de Next, igual que el ADR 0002
escribió para `/api/auth`. Quien cubre el salto es `lib/backend/testing/loopback.ts`, que corre la
contract suite entera contra los doce handlers de verdad sobre el adaptador en memoria, y
Playwright, que lo corre contra un servidor real y además vigila que ninguna petición salga del
origen (`e2e/aislamiento.spec.ts`).

**La deuda que se acepta: los endpoints tienen forma de repositorio, no de servicio.** `reorder` es
una lectura más N escrituras secuenciales —secuenciales a propósito— y `createSibling` las encadena,
así que un arrastre en una lista de veinte hermanos puede ser una docena de viajes, y ahora cada uno
es un doble salto. La salida, si molesta, no es optimizar el transporte: es que cada endpoint sea
una operación de dominio con la orquestación en el servidor. Eso cambia lo que la interfaz optimista
puede predecir (ADR 0005), así que es otro ticket. Queda escrito para que no haya que
redescubrirlo.
