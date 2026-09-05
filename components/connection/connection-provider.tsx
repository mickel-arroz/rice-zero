"use client";

import { useOffline } from "next/offline";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BACK_MS,
  blocksMutations,
  nextPhase,
  settlePhase,
  type ConnectionPhase,
} from "@/components/connection/connection";

/**
 * Si hay red, y qué hay que hacer con la interfaz mientras no la haya.
 *
 * ── Por qué un provider encima de un hook que ya existe ───────────────────
 *
 * `useOffline()` de Next ya se puede llamar desde cualquier sitio, así que un
 * provider parece de más. Lo que añade es la FASE (`connection.ts`): el «de
 * vuelta» dura unos segundos y tiene que apagarse a la vez en todas partes.
 * Con el hook suelto en cada componente, cada uno arrancaría su propio
 * temporizador al hidratar y el aviso se iría en doce momentos distintos.
 *
 * ── De dónde sale la señal ────────────────────────────────────────────────
 *
 * De `useOffline()`, y de nada más. Con `experimental.useOffline` puesto (ver
 * `next.config.ts`, lo encendió #18), Next escucha los eventos `online` y
 * `offline` del navegador Y sondea con `HEAD` mientras no hay red, con espera
 * escalonada de hasta 3 s. Ese sondeo ES el «reintento automático cada pocos
 * segundos» que pide el ticket, y por eso aquí no hay ningún `setInterval`
 * propio: escribir un segundo latido sería tener dos definiciones de «hay red»
 * que pueden discrepar.
 *
 * Lo que esa señal NO ve es un fallo de nuestras propias escrituras. Por el
 * ADR 0001 el navegador habla DIRECTO con el Proveedor de Backend, y esas
 * peticiones no pasan por el detector de Next, que solo instrumenta las suyas
 * —navegación, prefetch, Server Actions—. O sea: con el backend caído y el
 * wifi bien, esto dice que hay red, la escritura falla, y el fallo se enseña
 * donde ocurrió (el pie del Autoguardado, la tarjeta de error) en vez de
 * bloquear la app entera. Es lo correcto: la app no está sin conexión, el
 * backend está roto, y decir «sin conexión» ahí sería mentir sobre qué
 * arreglar. Se documenta en la enmienda del spec #1.
 */

type ConnectionValue = {
  phase: ConnectionPhase;
  /** ¿Está prohibido escribir ahora mismo? Lo que pregunta cada botón. */
  blocked: boolean;
};

const ConnectionContext = createContext<ConnectionValue>({
  phase: "online",
  blocked: false,
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const offline = useOffline();
  const [phase, setPhase] = useState<ConnectionPhase>("online");
  const [seen, setSeen] = useState(false);

  // Se ajusta DURANTE el render y no en un efecto: `nextPhase` es una función
  // de lo que dice el detector, no una sincronización con nada de fuera. En un
  // efecto, React pintaría primero el estado viejo y el banner llegaría un
  // fotograma tarde —y en la vuelta, el fotograma de más lo pasaría la persona
  // mirando una pantalla que ya acepta teclas y sigue diciendo que no—.
  //
  // El patrón es el que documenta React para «ajustar estado cuando cambia una
  // entrada»: se compara con lo último visto y se repite el render sin pintar.
  // Con un `setPhase` a secas sería un bucle, porque `back` no es función solo
  // de `offline`.
  //
  // `useOffline` devuelve `false` en el servidor y hasta que hidrata, así que
  // el primer render siempre sale «online»: sin salto de layout al cargar con
  // red, y sin un banner que parpadea en el HTML de todo el mundo.
  if (seen !== offline) {
    setSeen(offline);
    setPhase((current) => nextPhase(current, offline));
  }

  useEffect(() => {
    if (phase !== "back") return;
    const timer = setTimeout(() => setPhase(settlePhase), BACK_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const value = useMemo(
    () => ({ phase, blocked: blocksMutations(phase) }),
    [phase],
  );

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

/**
 * La fase de la conexión. La pinta el banner y poco más.
 *
 * NO lanza fuera del provider, al revés que `useTree` o `useProjects`: su
 * valor por defecto —hay red— es el estado degradado correcto. Una app que se
 * bloquease sola porque a alguien se le olvidó montar un provider sería peor
 * que una que no bloquea.
 */
export function useConnection(): ConnectionValue {
  return useContext(ConnectionContext);
}

/**
 * ¿Está bloqueada la edición? Lo que preguntan los botones.
 *
 * Existe aparte de `useConnection` porque es la pregunta que hacen veinte
 * sitios y solo el banner necesita la fase entera. Que sea un hook y no
 * `blocksMutations(useConnection().phase)` en cada uno es lo que impide que
 * alguien escriba `phase === "offline"` a mano y se deje una fase futura.
 */
export function useBlocked(): boolean {
  return useContext(ConnectionContext).blocked;
}
