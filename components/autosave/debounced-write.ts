"use client";

import { useCallback, useEffect, useState } from "react";

import {
  movePending,
  pendingState,
  type PendingSlot,
} from "@/components/connection/pending";

/**
 * El cableado del Autoguardado: el rebote, la retención sin red y las salidas.
 *
 * Lo comparten `TreeProvider` y `VersionsProvider`, que hasta #24 tenían la
 * misma máquina transcrita línea a línea. Lo que NO se comparte, y sigue en
 * tres archivos separados a propósito, son las POLÍTICAS —
 * `components/projects/autosave.ts`, `components/tree/autosave.ts` y
 * `components/versions/autosave.ts`—: cada una decide una regla distinta
 * (¿se recorta?, ¿puede quedar vacío?, ¿lo guardado puede ser nulo?) y
 * juntarlas obligaría a un parámetro «¿recorto?», que es la forma de esconder
 * dos decisiones dentro de una. Lo que se repetía era esto de aquí, que esos
 * mismos comentarios ya llamaban «cableado».
 *
 * ── Por qué son dos cosas, la factoría y el hook ──────────────────────────
 *
 * `createDebouncedWrite` no sabe nada de React: es un temporizador, un hueco
 * y una promesa en vuelo. Está aparte para poder comprobarlo con
 * temporizadores falsos sin montar un componente, que es exactamente el mismo
 * motivo por el que las políticas son funciones puras. `useDebouncedWrite` es
 * el envoltorio: crea uno por pantalla, le pasa la conexión y engancha las
 * salidas del navegador. Todo lo que DECIDE vive en la factoría; el hook solo
 * lo conecta.
 */

/**
 * Con qué se escribe y con qué se avisa.
 *
 * Van juntos y en un tipo propio porque son lo que CAMBIA en cada repintado
 * —los tres salen de la pantalla que monta el rebote— frente a `delayMs`, que
 * lo pone una política y no se mueve. Ver `setHandlers`.
 */
export type DebouncedWriteHandlers = {
  /**
   * Escribe lo que haya pendiente para ese id.
   *
   * Devuelve si quedó A SALVO: `true` también cuando no había nada que
   * escribir. Quien lo llama lo NECESITA — un cambio de estructura encima de
   * un texto que no se guardó acabaría diciendo «Guardado» sobre una idea
   * perdida.
   *
   * No puede lanzar: los fallos se cuentan devolviendo `false`, porque quien
   * escribe es también quien sabe con qué palabras contarlo en el pie.
   */
  write(id: string): Promise<boolean>;

  /** Se acaba de RETENER algo por falta de red. El pie dice «Pendiente». */
  onHold(): void;

  /** Lo retenido acaba de salir. El pie vuelve a decir «Guardando…». */
  onRelease(): void;
};

export type DebouncedWriteOptions = DebouncedWriteHandlers & {
  /** Cuánto se espera desde la última tecla. Lo pone cada política. */
  delayMs: number;
};

export type DebouncedWrite = {
  /** Programa la escritura de lo que se está tecleando. */
  schedule(id: string): void;

  /**
   * Deja lo pendiente a salvo antes de tocar otra cosa. Devuelve si lo logró.
   *
   * @param blocked lo que la conexión dice EN ESTE INSTANTE. Se pasa y no se
   *   lee del espejo porque esto lo llama un clic, y un clic decide con lo que
   *   tenía el repintado que lo pintó.
   */
  flushPending(blocked: boolean): Promise<boolean>;

  /** Cambió la conexión: retener lo que iba a salir, o soltar lo retenido. */
  setBlocked(blocked: boolean): void;

  /**
   * Cambia con qué se escribe y con qué se avisa, sin tocar lo pendiente.
   *
   * Existe porque quien escribe vive en un componente y se rehace en cada
   * repintado, mientras que el hueco pendiente y la escritura en vuelo tienen
   * que sobrevivirlos. Hoy los dos providers pasan cierres estables y esto
   * corre una sola vez; está de todas formas porque el día que uno de ellos
   * añada una dependencia a su `useCallback` —`versionId`, por ejemplo— el
   * fallo sin esto no sería un error sino silencio: el rebote seguiría
   * escribiendo con el árbol de antes de la última relectura, y nadie se
   * enteraría hasta ver una fila donde no toca.
   */
  setHandlers(next: DebouncedWriteHandlers): void;

  /** Se sale de la pantalla: escribir YA lo que quede, si hay red. */
  leave(): void;

  /**
   * La pantalla ya no existe: apagar lo que quede armado.
   *
   * Aparte de `leave` y no dentro, porque son dos cosas distintas. De
   * `pagehide` o de una pestaña oculta se VUELVE —hay bfcache, y volver a
   * mirar una pestaña es lo más normal del mundo—, así que allí parar el
   * temporizador sin escribir sería tirar en silencio lo que el usuario
   * tecleó. Del desmontaje no se vuelve, y un temporizador que sobreviva a él
   * despierta medio segundo después para hacerle `setState` a un provider que
   * ya no está. Pasa de verdad: sin red, `schedule` arma el temporizador igual
   * —quien retiene es `setBlocked`, y puede no haber corrido todavía—, y
   * entonces `leave` no lo toca porque no hay red a la que mandar nada.
   */
  dispose(): void;
};

export function createDebouncedWrite(options: DebouncedWriteOptions): DebouncedWrite {
  const { delayMs } = options;

  /** Con qué se escribe y con qué se avisa AHORA. Ver `setHandlers`. */
  let { write, onHold, onRelease } = options;

  /**
   * Lo pendiente de escribir. Solo puede haber UNO: ver `schedule`.
   *
   * Con el temporizador a `null` está RETENIDO por falta de red. Quién lo
   * retiene y cuándo se suelta lo decide `movePending`; aquí solo se ejecuta.
   * No es una cola de sincronización —eso sigue fuera de alcance en el spec
   * #1—: es el mismo único borrador que el rebote ya sostenía, esperando más
   * de la cuenta.
   */
  let pending: PendingSlot<ReturnType<typeof setTimeout>> | null = null;

  /** La escritura que ya salió y todavía no ha vuelto. */
  let inFlight: Promise<boolean> | null = null;

  /**
   * Espejo de la conexión para lo que dispara FUERA del render.
   *
   * Solo dos sitios lo leen: el temporizador del rebote y el vuelco al salir
   * de la pantalla. Los dos corren mucho después del repintado que lo escribe
   * —medio segundo el uno, un evento del navegador el otro—, así que ahí el
   * espejo es la lectura correcta. Lo que decide dentro de un clic recibe la
   * conexión por parámetro (`flushPending`).
   */
  let blocked = false;

  /** Escribe, dejando constancia de que hay una escritura EN VUELO. */
  function flush(id: string): Promise<boolean> {
    const work = write(id).finally(() => {
      if (inFlight === work) inFlight = null;
    });
    inFlight = work;
    return work;
  }

  /**
   * Programa la escritura de lo que se está tecleando.
   *
   * Solo hay UN rebote vivo, y cambiar de id vacía el anterior en el acto en
   * vez de cancelarlo: sin eso, escribir en A y saltar a B perdería lo
   * tecleado en A si B se guarda antes y el usuario cierra la pantalla en
   * medio.
   */
  function schedule(id: string): void {
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      if (pending.id !== id) void flush(pending.id);
    }
    pending = {
      id,
      timer: setTimeout(() => {
        // La red se fue mientras el rebote esperaba: se RETIENE en vez de
        // disparar la escritura contra el vacío. `setBlocked` la soltará al
        // volver la conexión. Se comprueba aquí además de allí porque los dos
        // pueden caer en el mismo repintado, y de los dos éste es el que ya
        // tiene el temporizador en la mano.
        if (blocked) {
          pending = { id, timer: null };
          onHold();
          return;
        }
        pending = null;
        void flush(id);
      }, delayMs),
    };
  }

  /**
   * Retener lo tecleado al perder la red, y soltarlo solo al recuperarla.
   *
   * Es lo que cumple «ninguna mutación se pierde ni se envía a medias durante
   * la transición». Sin esto, el rebote disparaba su escritura contra una red
   * que ya no estaba: la petición fallaba, el pie decía «No se guardó» y lo
   * escrito se quedaba únicamente en la pantalla hasta que alguien volviera a
   * teclear — que es exactamente la idea perdida que el Autoguardado promete
   * que no existe.
   *
   * Al volver la red SALE SOLA, sin que nadie pulse nada: la reactivación
   * automática de la edición no vale de mucho si el usuario tiene que
   * acordarse de retocar el campo para que lo suyo se guarde.
   *
   * El límite conocido, y es el que el spec ya asume al dejar fuera las colas
   * de sincronización: lo retenido vive en memoria. Cerrar la pestaña sin red
   * lo pierde, y por eso el pie dice «Pendiente» y no «Guardado».
   */
  function setBlocked(next: boolean): void {
    blocked = next;
    const current = pending;
    const move = movePending(pendingState(current), next);
    if (!current || move === "keep") return;

    if (move === "hold") {
      if (current.timer) clearTimeout(current.timer);
      pending = { id: current.id, timer: null };
      onHold();
      return;
    }

    pending = null;
    onRelease();
    void flush(current.id);
  }

  /**
   * Deja lo pendiente a salvo antes de tocar otra cosa. Devuelve si lo logró.
   *
   * Espera DOS cosas y no una: el rebote que aún no ha disparado, y la
   * escritura que el temporizador pudo lanzar hace un instante. Sin esperar la
   * segunda, su respuesta aterrizaría después de la relectura y pisaría lo
   * recién leído con la fila de antes.
   *
   * Sin red no se adelanta nada: se retiene y se dice que NO quedó a salvo.
   * Devolver `true` ahí sería lo que hace que quien llama siga adelante y
   * acabe diciendo «Guardado» sobre algo que sigue solo en la pantalla.
   *
   * Solo se responde por lo que todavía se está esperando. Una escritura que
   * ya volvió con fallo dejó de estar en vuelo, y a partir de ahí quien lo
   * cuenta es el pie con su «No se guardó»: recordarla aquí para siempre
   * bloquearía la pantalla incluso después de que el usuario reescribiera y
   * aquello se guardara bien.
   */
  async function flushPending(blockedNow: boolean): Promise<boolean> {
    // `null` no es un fallo: es que no había nada volando.
    const settled = (await inFlight) ?? true;

    const current = pending;
    if (!current) return settled;

    if (blockedNow) {
      // La misma tabla que en `setBlocked`, y no una copia a mano: lo ya
      // retenido se queda como está. Retenerlo otra vez volvería a marcar
      // «Pendiente» sobre un estado que ya lo decía — la fila «held + sin red
      // → keep» que `movePending` existe para evitar.
      if (movePending(pendingState(current), true) === "hold") {
        if (current.timer) clearTimeout(current.timer);
        pending = { id: current.id, timer: null };
        onHold();
      }
      return false;
    }

    if (current.timer) clearTimeout(current.timer);
    pending = null;
    // Las DOS escrituras, no solo la última: la anterior pudo fallar mientras
    // ésta salía bien, y lo que se pregunta es si quedó todo a salvo.
    return (await flush(current.id)) && settled;
  }

  /**
   * Las tres salidas de la pantalla, y lo que hay que escribir al usarlas.
   *
   * El rebote es la única ventana en la que algo escrito puede no estar
   * guardado, y «recargar nunca pierde un cambio confirmado» es un criterio
   * del spec. Sin red la petición no llega a ninguna parte, así que no se
   * manda: lo retenido se queda retenido.
   */
  function leave(): void {
    const current = pending;
    if (!current) return;
    if (blocked) return;
    if (current.timer) clearTimeout(current.timer);
    pending = null;
    void flush(current.id);
  }

  function setHandlers(next: DebouncedWriteHandlers): void {
    ({ write, onHold, onRelease } = next);
  }

  function dispose(): void {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
  }

  return { schedule, flushPending, setBlocked, setHandlers, leave, dispose };
}

/**
 * El rebote de una pantalla, ya enchufado a React.
 *
 * Crea UN `createDebouncedWrite` por montaje y lo mantiene vivo entre
 * repintados: el hueco pendiente y la escritura en vuelo son estado, y
 * rehacerlos en cada render sería perderlos. Lo que sí cambia entre
 * repintados —`write`, `onHold`, `onRelease`— se lee por referencia, para que
 * el rebote de hace medio segundo escriba con el cierre de AHORA y no con el
 * de entonces.
 */
export function useDebouncedWrite({
  delayMs,
  write,
  blocked,
  onHold,
  onRelease,
}: DebouncedWriteOptions & {
  /** Lo que contesta `useBlocked()` en este repintado. */
  blocked: boolean;
}): {
  schedule(id: string): void;
  flushPending(): Promise<boolean>;
} {
  // En estado y no en una `ref` porque el rebote no es un dato del render sino
  // el dueño de lo pendiente: hace falta que se cree UNA vez y viva hasta el
  // desmontaje, y `useState` con inicializador perezoso es la forma de decir
  // eso sin leer una `ref` al pintar.
  const [debounced] = useState(() =>
    createDebouncedWrite({ delayMs, write, onHold, onRelease }),
  );

  // Los cierres de ESTE repintado, para que el rebote de dentro de medio
  // segundo no escriba con los de hace medio segundo. En un efecto: nada de
  // esto se llama al pintar, solo desde un temporizador, un evento del
  // navegador o un clic.
  useEffect(() => {
    debounced.setHandlers({ write, onHold, onRelease });
  }, [debounced, write, onHold, onRelease]);

  useEffect(() => {
    debounced.setBlocked(blocked);
  }, [debounced, blocked]);

  /**
   * Las tres salidas de la pantalla:
   *
   *   · `visibilitychange` a oculto — cambiar de app o de pestaña en el móvil,
   *     que es lo que pasa justo antes de cerrar el navegador.
   *   · `pagehide` — recargar, cerrar, o navegar fuera del sitio.
   *   · el desmontaje — navegar DENTRO de la app, donde no ocurre ninguno de
   *     los dos anteriores.
   *
   * Lo que no se puede prometer es una recarga forzada con el dedo todavía
   * escribiendo: la petición sale, pero la navegación puede cancelarla. Por
   * eso además se escribe al cerrar el campo, que es lo que pasa de verdad
   * antes de tocar cualquier otra cosa.
   */
  useEffect(() => {
    function leaving() {
      debounced.leave();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") leaving();
    }

    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", onVisibility);
      leaving();
      // Y después de intentar escribirlo, apagar lo que siga armado: de aquí
      // no se vuelve. Ver `dispose`.
      debounced.dispose();
    };
  }, [debounced]);

  const schedule = useCallback((id: string) => debounced.schedule(id), [debounced]);

  // `blocked` a secas y no el espejo: esto lo llama un clic, y un clic decide
  // con lo que tenía el repintado que lo pintó.
  const flushPending = useCallback(
    () => debounced.flushPending(blocked),
    [debounced, blocked],
  );

  return { schedule, flushPending };
}
