# La relectura del árbol deja de ser automática

Hasta aquí, cada escritura de estructura del árbol —crear, mover, re-parentar, borrar— terminaba
releyendo el árbol entero desde el motor. Era correcto por fuerza bruta: lo que se pinta viene
siempre de la base de datos, así que no había forma de que la pantalla enseñara algo que allí no
estuviera.

Este ADR registra que eso cambia, y por qué es caro de deshacer: **a partir de aquí la consistencia
del árbol depende de una política**, y una política mal escrita se ve exactamente como la fuerza
bruta evitaba — un árbol que enseña algo que el motor no tiene. Vive en `lib/tree/write-policy.ts`,
que es puro y tiene test.

## Lo que forzó el cambio no fue el gasto

El gasto estaba ahí —una lectura del árbol completo por cada Nodo creado— pero no es el motivo. El
motivo es el **Nodo optimista**: crear pinta el Nodo antes de que la escritura salga, para que
crear no se sienta como esperar. Con la relectura automática, esa relectura llegaba medio segundo
después y borraba el Nodo optimista para devolverlo acto seguido. Aparecer y desaparecer es peor que
tardar, así que o se quitaba la relectura de donde estorba o no había Nodo optimista.

Conviene dejarlo escrito porque el plan original de la pasada apuntaba a otro sitio: proponía
identificadores temporales como si el obstáculo fuera nombrar el Nodo. No lo era. El obstáculo era
la relectura, y los identificadores temporales son solo la consecuencia de haberla quitado.

## La regla

**Se relee cuando la escritura puede cambiar filas que quien llamó no nombró.**

Lo que cambia filas sin nombrarlas son las que reparten puestos entre hermanos:

- `reorder` corre el `orderIndex` de todos los que van detrás.
- `createSibling` son **dos** escrituras: el Nodo nace el último y después se le trae a su sitio, lo
  que renumera a los demás. Es la distinción más fácil de perder de todo este archivo, porque desde
  fuera «crear» y «crear un hermano» parecen lo mismo.
- `reparent` mueve un Nodo de una lista de hermanos a otra.
- `createQuestion` crea dos Nodos —la pregunta y el hueco para contestarla— y solo devuelve uno.

Ninguna de ellas devuelve las filas que tocó de paso. Deducirlas en la pantalla sería reimplementar
el plan del dominio (`reorderPlan`) en un segundo sitio, y dos copias de una regla de orden
divergen sin que nadie lo note hasta que un Nodo aparece donde no va.

**El resto se resuelve en local**, con lo que el motor ya devolvió: crear a secas, editar el texto,
completar. Y borrar, que no devuelve nada pero cuya consecuencia sí se conoce entera: `on delete
cascade` sobre `parent_id` es exactamente «y todo lo que cuelgue», y eso se reproduce con la misma
función que deshace un Nodo optimista fallido — son la misma operación, así que se escribe una vez.

## El Nodo optimista

Nace con un id temporal reconocible por su prefijo (`optimista:`), y con **el mismo puesto que le va
a dar el motor**: el último de sus hermanos. Si no coincidiera, el Nodo daría un salto al llegar la
respuesta, que es la forma más clara de decir «lo que te enseñé no era verdad».

Se sustituye por el real **en su sitio** dentro de la lista plana. El orden de esa lista no decide
nada del dibujo —`buildTree` ordena por `orderIndex`— pero sí decide en qué orden reconcilia React,
y mover la fila la desmonta y la vuelve a montar. Con el campo abierto dentro, eso es perder el foco
justo cuando alguien empieza a escribir.

Lo tecleado mientras el alta viaja **se muda al id real** antes de tocar el árbol. Los borradores
viven en un mapa por id, así que sin esa mudanza el rebote del Autoguardado despertaría medio segundo
después buscando un Nodo que ya no existe con ese nombre, y tiraría el texto en silencio.

**Si la escritura falla, el Nodo se retira y el motivo se enseña.** Es el límite de lo optimista: se
puede adelantar lo que va a pasar, no fingir lo que no pasó.

## Lo que este ADR no decide

- **Cola de sincronización sin conexión.** Sigue fuera de alcance: sin red no se escribe, y lo
  Pendiente se sigue perdiendo al cerrar la pestaña. El Nodo optimista no cambia nada de eso —
  `run` sigue cerrando la puerta antes de pintar nada.
- **Optimismo en las demás operaciones.** Mover, re-parentar y completar siguen esperando. Crear es
  el caso que se pidió porque es el que se hace en ráfaga; los otros son de uno en uno y esperar no
  se nota.
- **Reordenar sin releer.** Se podría, exportando el plan del dominio. No se hace todavía: mientras
  el plan no se devuelva, la única alternativa es copiarlo, y este ADR existe precisamente para no
  tener dos copias de una regla de orden.
