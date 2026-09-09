# El Análisis omite el Nodo completado y todo su subárbol

Un Nodo puede darse por terminado (#46). La pregunta que este ADR contesta es qué hace eso con el
texto que viaja a la IA, y por qué la respuesta no puede ser «nada» ni «omitir ese Nodo».

Se registra como ADR y no como comentario porque es **cara de deshacer**: un Análisis es historia
que no se edita, y los que se generen bajo esta regla quedan generados así para siempre. Cambiarla
mañana no reescribe lo ya producido — deja una biblioteca de Análisis en la que dos entradas
consecutivas hablan de árboles distintos sin decirlo.

**Un Nodo completado no llega a la IA.** Marcar como terminado es la forma que tiene la app de decir
«de esto ya no hay que hablar». Si el texto siguiera llevándolo, el Análisis volvería a proponer
Tickets sobre trabajo hecho, y el contexto —que es finito y se paga— se gastaría en ello. Es la
diferencia entre un árbol que es una lista de todo lo que se pensó alguna vez y uno que es lo que
falta.

**Y tampoco llega su subárbol, aunque sus hijos sigan pendientes.** Ésta es la mitad que fuerza el
ADR, y el caso que la fuerza es concreto:

    - Tienda online
      - Catálogo            ← completado
        - Filtros por talla ← pendiente
      - Carrito

Omitir únicamente «Catálogo» y seguir bajando dejaría «Filtros por talla» pintado un nivel más
arriba, colgando de «Tienda online». El texto enviado describiría entonces una jerarquía que no
existe en la base de datos ni en la pantalla, y el modelo razonaría sobre ella: propondría Tickets
para un filtro que cuelga de la tienda y no del catálogo, sin ninguna forma de saber que se lo
inventamos nosotros. Un dato ausente es un hueco; un dato reordenado es una mentira.

La consecuencia se acepta a sabiendas: **terminar un padre esconde trabajo pendiente que cuelga de
él**. Es lo correcto de todas formas —dar por hecho un padre es decir que la rama está cerrada— y la
interfaz no lo oculta: el subárbol entero se ve tachado, no desaparece.

**Lo tachado en pantalla y lo omitido del envío son el mismo conjunto, por construcción.** Es el
**Subárbol completado** del glosario, y lo calculan dos recorridos distintos —`treeRows`, que baja
heredando `struck`, y `serializeTree`, que corta la rama— desde la misma regla: completado hacia
abajo. No se sincronizan a mano y no hay una lista que mantener; lo que los mantiene de acuerdo es
que ninguno de los dos puede expresar otra cosa. Si algún día divergieran, el síntoma sería el peor
posible de esta app: alguien mirando una pantalla que promete un Análisis distinto del que va a
recibir.

**Se persiste, y por eso está en la tabla y no en el navegador.** El plegado de un Nodo
(`lib/tree/collapsed.ts`) es preferencia de quien mira y vive en `localStorage`; el completado no
puede, precisamente porque cambia lo que la IA recibe. El glosario define una Versión como una línea
completa e independiente, y de ahí se sigue que la misma Versión tiene que producir el mismo
Análisis desde cualquier dispositivo. Guardado en local, no lo produciría.

## Lo que este ADR no decide

- **Completar Checks dentro de un Análisis.** Sigue fuera de alcance: un Análisis es historia que no
  se edita, y el completado es del Nodo, no del Check.
- **Qué pasa si se completa el árbol entero.** El texto sale vacío, y eso se deja pasar tal cual: no
  queda nada pendiente de lo que hablar, y la pantalla ya lo dice con todo tachado.
