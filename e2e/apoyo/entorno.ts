/**
 * Qué le hace falta a la suite E2E para poder correr, y de dónde lo saca.
 *
 * Es el equivalente de `requireLiveEnv` en `scripts/live-runner.mjs`, y existe
 * por el mismo motivo escrito allí: un corredor de tests al que le faltan las
 * credenciales sale en VERDE habiendo ejecutado cero pruebas, y eso parece una
 * suite superada. Aquí se decide antes, en un módulo puro, para que la regla se
 * pueda comprobar sin levantar un navegador.
 *
 * Módulo puro a propósito: recibe el entorno como argumento en vez de leer
 * `process.env`. Es lo que deja que `entorno.test.ts` pruebe «las credenciales
 * sueltas no bastan» sin ensuciar el proceso de nadie.
 */

// La lista de variables vive en un `.mjs` porque la comparte el guardia que
// corre ANTES de arrancar Playwright, que es Node a pelo. Ver `e2e-env.mjs`.
import { E2E_KEYS, E2E_SWITCH } from "../../scripts/e2e-env.mjs";

export { E2E_KEYS, E2E_SWITCH };

/** El entorno, tal y como lo ve este módulo. */
export type Entorno = Record<string, string | undefined>;

/**
 * Dónde vive la app de la suite cuando nadie dice otra cosa.
 *
 * Las dos mitades de esta constante están pagadas con una tarde:
 *
 *   · `localhost` y NO `127.0.0.1`. Son la misma máquina y son ORÍGENES
 *     distintos, y Managed Better Auth solo confía en los que tiene
 *     registrados: contra `127.0.0.1` toda petición de auth vuelve con
 *     `INVALID_ORIGIN`, así que la suite entraba a un login que nunca podía
 *     dejar entrar a nadie. Neon acepta `localhost` en CUALQUIER puerto, que es
 *     lo que hace viable la otra mitad.
 *   · El 3100 y no el 3000, que es el de `next dev`. La suite construye la app
 *     antes de levantarla, y un `next build` escribe sobre el mismo `.next` que
 *     está sirviendo el servidor de desarrollo: compartir puerto significaba
 *     que correr las pruebas dejaba al `npm run dev` de al lado devolviendo 403
 *     en sus propios chunks, con la página cargada y React sin hidratar.
 */
const BASE_URL_POR_DEFECTO = "http://localhost:3100";

function leer(env: Entorno, key: string): string {
  return env[key]?.trim() ?? "";
}

/** Le quita la barra final: `baseURL` de Playwright ya la pone al unir rutas. */
function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Las variables que faltan, o una lista vacía si no falta ninguna. */
export function faltantes(env: Entorno): string[] {
  return E2E_KEYS.filter((key) => leer(env, key) === "");
}

/**
 * La cuenta de usar y tirar.
 *
 * @throws si el entorno no está completo, nombrando lo que falta. Se lanza en
 * vez de devolver `null` porque quien llama a esto ya decidió correr: seguir
 * con una cuenta a medias acabaría en un fallo de login diez pasos más tarde,
 * y ahí el mensaje ya no diría cuál fue la causa.
 */
export function credenciales(env: Entorno): { email: string; password: string } {
  const ausentes = faltantes(env);
  if (ausentes.length > 0) {
    throw new Error(
      `La suite E2E no está configurada. Faltan en .env.local o en el entorno: ${ausentes.join(", ")}.`,
    );
  }
  return {
    email: leer(env, "E2E_EMAIL"),
    password: leer(env, "E2E_PASSWORD"),
  };
}

/**
 * Contra qué origen corre la suite.
 *
 * `E2E_BASE_URL` existe para reaprovechar un servidor ya levantado — un `npm
 * run dev` abierto en otra terminal — sin esperar a que Playwright construya la
 * app entera para cada iteración.
 */
export function baseUrl(env: Entorno): string {
  const propia = leer(env, "E2E_BASE_URL");
  return propia === "" ? BASE_URL_POR_DEFECTO : sinBarraFinal(propia);
}

/**
 * El despliegue contra el que corre el smoke, o `null` si no se pide.
 *
 * @throws si la variable está puesta pero no es una URL http(s). Un `SMOKE_URL`
 * mal escrito NO puede saltarse el smoke en silencio: sería otra vez el verde
 * vacío contra el que existe este módulo. Se rompe al cargar la configuración,
 * que es cuando alguien todavía está mirando la terminal.
 */
export function objetivoDeHumo(env: Entorno): string | null {
  const crudo = leer(env, "SMOKE_URL");
  if (crudo === "") return null;

  let url: URL;
  try {
    url = new URL(crudo);
  } catch {
    throw new Error(`SMOKE_URL no es una URL: «${crudo}».`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`SMOKE_URL tiene que ser http o https, y es «${url.protocol}».`);
  }
  return sinBarraFinal(url.toString());
}

/**
 * Dónde se guarda la sesión ya iniciada.
 *
 * Vive aquí y no suelto en cada archivo porque lo nombran TRES sitios que
 * tienen que coincidir: quien la escribe (`e2e/preparar/cuenta.setup.ts`),
 * quien la lee (`playwright.config.ts`) y `.gitignore`. Un tercero mal escrito
 * daría una suite que entra como nadie.
 */
export const ESTADO_SESION = "e2e/.auth/estado.json";
