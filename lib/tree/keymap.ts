/**
 * El mapa de teclado del árbol: una pulsación entra, una acción sale.
 *
 * Es UN módulo y no varios porque el mapa no se puede decidir por partes. Si
 * una tecla suelta escribiera, esa tecla no podría además ser un atajo; y si un
 * atajo ocupara una combinación, la siguiente decisión tendría que rodearla.
 * Repartido entre el que crea Nodos y el que mueve el foco, la primera colisión
 * la descubriría alguien tecleando.
 *
 * Es una función PURA a propósito: dada una pulsación y un contexto devuelve una
 * acción o nada, sin tocar el DOM ni saber qué es React. Eso es lo que permite
 * un test de tabla que afirme de una vez las dos reglas de abajo sobre TODO el
 * mapa, en vez de comprobarlas atajo por atajo montando componentes.
 *
 * ── Las dos reglas ────────────────────────────────────────────────────────
 *
 * **1. Todo atajo lleva modificador.** Sin excepción, y eso es lo que hace que
 * teclear en un Nodo enfocado funcione siempre y sin gesto previo: una tecla
 * suelta nunca significa nada más que su carácter. La alternativa —un «modo
 * comando» donde `d` borra— exige señalizar en qué modo estás, y esto es una
 * app mobile-first donde muchas veces no hay teclado que señalizar.
 *
 * **2. Ningún atajo le quita una tecla al navegador, al sistema, ni a la
 * distribución del teclado.** Por eso el mapa se construye entero sobre
 * FLECHAS, `Enter`, `Espacio` y `Retroceso` y no lleva ni una letra: casi todo
 * `Ctrl`/`Cmd`+letra está cogido por el navegador (`Ctrl+F`, `Ctrl+D`,
 * `Ctrl+P`, `Ctrl+S`…), su capa con `Shift` por las herramientas de desarrollo,
 * y `Ctrl+Alt`+letra ES `AltGr` en un teclado español — el que usa esta app
 * para escribir `@` y `€`. Un mapa de letras habría sido más fácil de recordar
 * y habría empezado a fallar en cuanto alguien escribiera un correo dentro de
 * un Nodo.
 *
 * ── Cómo se lee ───────────────────────────────────────────────────────────
 *
 * Hay una historia detrás y no una lista de asignaciones sueltas:
 *
 *   · El EJE VERTICAL es el orden de lectura: arriba y abajo.
 *   · El EJE HORIZONTAL es la jerarquía: dentro y fuera.
 *   · `Shift` significa **llévate el Nodo contigo**. Sin él la pulsación mueve
 *     la mirada; con él, mueve la cosa.
 *
 *       Mod+↑ / Mod+↓              mover el foco          (miras)
 *       Mod+Shift+↑ / Mod+Shift+↓  subir / bajar          (mueves)
 *       Mod+← / Mod+→              plegar / desplegar     (miras)
 *       Mod+Shift+←                mover a otro padre     (mueves)
 *       Mod+Enter                  el siguiente hermano
 *       Mod+Shift+Enter            un subnodo             (un nivel dentro)
 *       Mod+Shift+Espacio          terminar / reabrir
 *       Mod+Retroceso              borrar
 *
 * `Mod+Shift+→` se queda SIN asignar, y es deliberado: no hay una novena acción
 * que de verdad quepa ahí, y rellenarla por simetría es cómo se acaba con un
 * atajo que nadie recuerda haciendo algo que nadie quería.
 *
 * ── Lo que NO está aquí ───────────────────────────────────────────────────
 *
 * `Escape`, que hace las dos cosas que se esperan de él: con el campo abierto
 * lo cierra, y con un Nodo solo seleccionado quita la selección — la octava
 * acción de la barra, «Quitar».
 *
 * No es una excepción a la regla 1: `Escape` no es un atajo del árbol, es el
 * «cancelar» que ya honran los diálogos y el selector de Versiones de esta app.
 * No se puede teclear dentro de un Nodo, así que no compite con nada, y ponerle
 * un modificador lo habría hecho distinto de sí mismo en el resto de la app.
 * Por eso lo atienden la fila y `useTreeKeys`, y no este mapa.
 */

/**
 * Una pulsación, reducida a lo que decide.
 *
 * Un objeto propio y no un `KeyboardEvent`: así el resolutor se prueba sin
 * navegador y sin fabricar eventos, y no puede colarse por descuido una lectura
 * del DOM dentro de una decisión.
 */
export type KeyStroke = {
  /** `event.key`: `"a"`, `"Enter"`, `"ArrowUp"`, `" "`… */
  key: string;
  ctrl: boolean;
  /** La tecla Command en un Mac. */
  meta: boolean;
  shift: boolean;
  alt: boolean;
};

/**
 * Dónde está el árbol cuando llega la pulsación.
 *
 * `editing` implica `selected`: no se puede estar escribiendo en un Nodo que no
 * está seleccionado. Se pasan los dos de todas formas porque quien construye el
 * contexto ya tiene ambos y deducir uno del otro aquí solo escondería un
 * incumplimiento en vez de evitarlo.
 */
export type TreeKeyContext = {
  selected: boolean;
  /** El campo del Nodo seleccionado está abierto. */
  editing: boolean;
};

/**
 * Lo que una pulsación puede pedir. Los nombres son los de las operaciones del
 * árbol, no los de las teclas: quien lea `moveUp` no tiene que saber que salió
 * de una flecha.
 */
export type TreeKeyAction =
  | "createSibling"
  | "createChild"
  | "focusPrev"
  | "focusNext"
  | "moveUp"
  | "moveDown"
  | "collapse"
  | "expand"
  | "reparent"
  | "toggleCompleted"
  | "remove";

/**
 * El modificador de mando: `Ctrl` fuera de un Mac, `Cmd` dentro.
 *
 * Se acepta cualquiera de los dos en cualquier sistema en vez de detectar la
 * plataforma. Detectarla querría decir mirar el `userAgent` —que miente— o el
 * `platform` —que está obsoleto—, y equivocarse ahí deja a alguien con la mitad
 * del teclado muerta sin ninguna pista de por qué. Aceptar los dos no crea
 * ningún conflicto: en Windows nadie tiene una tecla Meta que pulsar sin querer,
 * y en un Mac `Ctrl+flecha` ya está cogido por el sistema, así que quien lo
 * intente no llegará ni a este módulo.
 */
function hasCommandModifier(stroke: KeyStroke): boolean {
  return stroke.ctrl || stroke.meta;
}

/**
 * ¿Esta pulsación es TEXTO y no una orden?
 *
 * Es la otra mitad de la regla 1, y por eso vive aquí al lado y no en el
 * componente: «teclear escribe» y «los atajos llevan modificador» son la misma
 * decisión mirada por sus dos caras, y separadas se desincronizarían.
 *
 * Un carácter y solo uno: `event.key` vale `"a"`, `"7"` o `"ñ"` cuando se ha
 * tecleado algo, y `"Enter"`, `"ArrowUp"` o `"Dead"` cuando no. Con cualquier
 * modificador de mando o `Alt` deja de ser texto — es una orden, la entienda
 * este mapa o no.
 *
 * El espacio queda FUERA. La fila de un Nodo es un `<button>`, y en un botón
 * enfocado el espacio es «púlsame»: dejarlo pasar como texto rompería esa
 * convención para todo el mundo, y lo que hace pulsar la fila —abrir el campo—
 * es de todas formas lo que quería quien lo tecleó. Además, un Nodo que empieza
 * por un espacio no es una idea que nadie haya querido escribir.
 */
export function isTypingStroke(stroke: KeyStroke): boolean {
  if (hasCommandModifier(stroke) || stroke.alt) return false;
  return stroke.key.length === 1 && stroke.key !== " ";
}

/**
 * Qué hay que hacer con esta pulsación, o `null` si el árbol no la reclama.
 *
 * `null` es la respuesta más importante del módulo: significa «no es mía», y es
 * lo que deja que la tecla siga su camino hasta el campo de texto o hasta el
 * navegador. Todo lo que este mapa no nombra tiene que salir por aquí intacto.
 *
 * ── Escribiendo, el teclado es del texto ──────────────────────────────────
 *
 * Con el campo abierto solo sobreviven los dos atajos de CREAR. Todo lo demás
 * —mover el foco, plegar, reordenar— devuelve `null` y se lo queda el
 * `textarea`, que es quien tiene que atender `Ctrl+←` para saltar de palabra o
 * `Ctrl+Shift+↑` para seleccionar hacia arriba. Robarle esas teclas sería pisar
 * lo que alguien está escribiendo, que es justo lo que la historia 20 prohíbe.
 *
 * Los dos que sí pasan son los que significan «ya está»: crear el siguiente
 * hermano cierra este Nodo y abre el nuevo, que es el gesto con el que se
 * encadena una idea detrás de otra sin soltar las manos.
 */
export function resolveTreeKey(
  stroke: KeyStroke,
  context: TreeKeyContext,
): TreeKeyAction | null {
  if (!hasCommandModifier(stroke)) return null;
  // `Alt` no participa en ningún atajo: en un teclado español `Ctrl+Alt` ES
  // `AltGr`, así que una combinación con los tres se teclea sin querer cada vez
  // que alguien escribe una arroba con el Nodo enfocado.
  if (stroke.alt) return null;

  // Mover el foco es lo único que tiene sentido sin nada seleccionado: es cómo
  // se ENTRA al árbol desde el teclado.
  if (!context.selected) {
    if (stroke.shift) return null;
    if (stroke.key === "ArrowDown") return "focusNext";
    if (stroke.key === "ArrowUp") return "focusPrev";
    return null;
  }

  if (stroke.key === "Enter") {
    return stroke.shift ? "createChild" : "createSibling";
  }

  // A partir de aquí, el campo abierto manda: ver la cabecera.
  if (context.editing) return null;

  if (stroke.shift) {
    switch (stroke.key) {
      case "ArrowUp":
        return "moveUp";
      case "ArrowDown":
        return "moveDown";
      case "ArrowLeft":
        return "reparent";
      case " ":
        return "toggleCompleted";
      default:
        return null;
    }
  }

  switch (stroke.key) {
    case "ArrowUp":
      return "focusPrev";
    case "ArrowDown":
      return "focusNext";
    case "ArrowLeft":
      return "collapse";
    case "ArrowRight":
      return "expand";
    case "Backspace":
      return "remove";
    default:
      return null;
  }
}
