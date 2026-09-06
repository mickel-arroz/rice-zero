# Bocetos

Los bocetos aprobados del Spec #27, contra los que se cierran sus Tickets de interfaz.

Nacieron como artefactos de Claude Design y se trajeron aquí cuando se borraron
de allí. Lo que se guardó es lo que decide: los artboards y la geometría. Se
perdió el editor visual —ya no se pueden mover cajas a mano—, y eso está bien:
un boceto aprobado no se edita, se cumple o se vuelve a aprobar.

## Cómo se miran

Cada `.dc.html` es una página suelta. Se abre en el navegador tal cual.

Cuidado con una cosa al leerlos: `<x-dc>` y `<helmet>` son del formato del
canvas, no HTML de la app. Lo que importa es lo de dentro del `<div>` grande —
ahí están las medidas reales. Las marcas rojas (`class="mk"`) señalan
exactamente lo que cada Ticket cambia; lo demás del artboard es contexto para
que se vea dónde encaja.

La NDot ya no va embebida en base64 —eran ~2 MB por artboard— sino apuntando a
`app/fonts/Ndot57-Regular.woff2`, que es la misma que usa la app.

## Qué respalda cada uno

### `shell/` — Ticket #28

Artboards: Escritorio · Barra plegada · Menú móvil · Móvil.
Medidas: barra 260/76, marca 78, filas 44/38, radio 20.

Cierra: **#31** ✅ · #32 · #33 · #34 · #35 · #36

> Hoy no existe un layout post-login: Proyectos fija max-w-5xl (1024) y el árbol
> max-w-3xl (768). El boceto elige 1024 para todo y lo mueve a un solo sitio.

> «Inicio» es la etiqueta de la lista de Proyectos, no una ruta nueva:
> `/projects` se queda donde está, y con él el punto de arranque de la PWA.

Al aprobarlo se pidió un solo cambio, ya aplicado en #31: la barra lateral
pierde su borde derecho, porque pegado al de la tarjeta se leía como un trazo
de 2 px.

### `nodos/` — Ticket #29

Artboards: Vista Registro · Vista Canvas · Registro móvil · Borrar en móvil.
Medidas: indent 22, ancla 29, caja 50, radio 16; Canvas ancho 208 y 20 px por línea.

Cierra: #37 · #39 · #40 · #42 · #43 · #44 · #45 · **#46** · #48

> El botón de plegar reutiliza el centro del punto, así que las líneas del árbol
> no se mueven cuando aparece. Plegado es preferencia de quien mira: no viaja
> entre dispositivos ni cambia lo que la IA recibe.

> Completado sí es estado del Nodo. Lo tachado en pantalla —el Nodo y todo su
> subárbol— es exactamente lo que se omite del texto que va a la IA.

> El Canvas conserva el ancho fijo de 208 px y crece en altura: el layout
> automático necesita una dimensión estable para colocar.

### `pantallas-nuevas/` — Ticket #30

Artboards: Análisis · Búsqueda en la Versión · Búsqueda global · Búsqueda global vacío.

Cierra: #52 · #53 · #54

> Las dos Búsquedas se parecen y no son la misma función. Dentro de la Versión
> el árbol ya está en memoria: filtra al instante, sin red y sin esqueleto.

> El Análisis pasa de panel lateral de 440 px a ruta propia anidada bajo la
> Versión, con el historial dentro. La vuelta al Proyecto es navegación hacia
> arriba y no un «atrás» del navegador.

## Por qué están en el repo y no solo en los Tickets

El Spec fija la regla de cierre: *«lo puramente visual no se automatiza; se
cierra contra su boceto»*, y *«ningún Ticket de interfaz se implementa antes de
que su boceto esté aprobado»*. Con dieciocho Tickets de interfaz aún abiertos,
el boceto es su criterio de aceptación — así que vive donde vive el código que
tiene que cumplirlo, y no en un enlace que puede caducar.
