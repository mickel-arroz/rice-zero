# La Limpieza no sigue al Subárbol completado

La Vista Registro gana un botón que borra de una vez lo terminado de la Versión abierta: la
**Limpieza**. La pregunta que este ADR contesta es qué cuenta como terminado a la hora de borrar, y
por qué la respuesta NO es el Subárbol completado que el ADR 0004 usa para el Análisis.

Se registra como ADR y no como comentario por dos motivos. Es **irreversible**: el Autoguardado
persiste el borrado en el acto, no hay deshacer, y la base de datos borra en cascada
(`parent_id ... on delete cascade`). Y **parece un error**: dos reglas que se parecen —lo tachado y
lo borrable— divergen a propósito, y sin esto escrito el siguiente en leer el código las
«unificaría» creyendo arreglar un bug.

**Un Nodo entra en la Limpieza solo si él y todos sus descendientes tienen su propio `completed`.**
El caso que lo decide es el mismo del ADR 0004:

    - Tienda online
      - Catálogo            ← completado
        - Filtros por talla ← pendiente
      - Carrito

«Filtros por talla» se pinta tachado y no viaja a la IA, porque cuelga de un padre completado. Pero
su propia marca sigue en falso, y el glosario ya dice por qué importa: desmarcar «Catálogo» lo
devuelve entero sin recordar nada. Es trabajo pendiente que está dormido, no trabajo hecho. Ocultarlo
del Análisis es reversible —basta desmarcar—; borrarlo no. Con lo irreversible, la regla tiene que
ser la más estrecha de las dos, así que aquí «Catálogo» y «Tienda online» sobreviven.

**Se borran los subárboles enteros más altos que cumplan la regla.** Si «Catálogo» tuviera además un
hijo completado sin nada pendiente debajo, ése sí se va aunque su padre se quede. Y como el borrado
de un padre arrastra a sus hijos en la base de datos, lo que se manda borrar son exactamente esas
raíces de subárbol, nunca un Nodo que tenga debajo algo que deba quedarse.

**El número que confirma es el número que borra.** El diálogo de confirmación enseña cuántos Nodos
se van a ir, y lo calcula la misma función que decide qué se borra. Si fueran dos cálculos podrían
divergir, y un diálogo que promete 4 y borra 9 es peor que no tener diálogo.

**Raíces incluidas, y la Versión puede quedar vacía.** Si todo está terminado, todo se va. Es lo que
se pidió, y una Versión sin Nodos ya es un estado que la app conoce.

## Lo que este ADR no decide

- **Deshacer.** Reinsertar subárboles con sus ids y su orden es un trabajo propio; de momento la
  confirmación es la única red.
- **Limpieza en otras Versiones o desde la Vista Canvas.** Solo la Versión abierta, solo desde
  Registro, que es la vista de edición.
