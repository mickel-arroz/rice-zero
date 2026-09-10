/**
 * El preámbulo que comparten las doce rutas de datos.
 *
 * Sesión, origen, la operación, y la traducción de la taxonomía del puerto a
 * HTTP. En un solo sitio porque son doce archivos: repetirlo doce veces es
 * repetir doce veces la oportunidad de olvidarse de la sesión en uno.
 *
 * Habla `Request` y `Response` estándar y no toca `next/headers` ni
 * `NextResponse`, igual que el resto de `lib/backend/`. Quien traduce el
 * contexto de un Route Handler es cada archivo de `app/api/`, y no hace más
 * que eso.
 *
 * Ver `docs/adr/0006-los-datos-pasan-por-la-api-propia.md`.
 */

import "server-only";

import { getServerBackend } from "@/lib/backend/server";
import { canAct, UnauthenticatedError, type Repositories } from "@/lib/backend/ports";
import {
  decodeJson,
  encodeBackendError,
  encodeJson,
  OPAQUE_FAILURE,
  statusForWireError,
  type WireError,
} from "@/lib/backend/wire";

/**
 * Una petición mal formada: falta un parámetro, o el cuerpo no es JSON.
 *
 * No es del puerto y no debe serlo. La taxonomía tiene cinco categorías porque
 * son las cinco decisiones que la INTERFAZ puede tomar, y «el cliente mandó una
 * petición imposible» no es ninguna: nuestro propio adaptador no puede
 * producirla, así que si llega es una petición a mano. Se contesta opaca.
 */
class MalformedRequest extends Error {}

const jsonHeaders = { "content-type": "application/json" } as const;

function fail(error: WireError, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: jsonHeaders,
  });
}

/**
 * ¿Viene esta petición de nuestra propia página?
 *
 * Existe porque elegimos Route Handlers y no Server Actions: **Next valida
 * `Origin`/`Host` automáticamente en las Actions y no lo hace en los Route
 * Handlers**, así que esta comprobación es el precio de la forma que se eligió.
 *
 * Y hace falta de verdad. Antes del ADR 0006 las escrituras se autorizaban con
 * un bearer token, que un formulario de otro sitio no puede añadir: eran
 * inmunes a CSRF por construcción. Ahora se autorizan con una cookie, que el
 * navegador manda sola.
 *
 * La cookie de sesión es `SameSite=Lax` —comprobado en el SDK, que hace
 * `cookieConfig.sameSite ?? "lax"` pese a que sus tipos anuncien `strict`—, y
 * `Lax` ya bloquea el POST cross-site. Esto es la segunda vuelta de llave, y no
 * es redundante: *same-site* no es *same-origin*, así que bajo un dominio
 * propio un subdominio hermano comprometido pasaría el filtro de la cookie y no
 * pasa éste.
 *
 * Sin cabecera `Origin` se deja pasar: la mandan todas las peticiones que nos
 * importan —`fetch` la pone en cualquier método— y exigirla rompería a un
 * cliente que no sea un navegador sin ganar nada, porque el que no la manda
 * tampoco arrastra la cookie de nadie.
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

/**
 * ¿Puede un formulario de otro sitio producir esta petición sin preflight?
 *
 * Solo POST. Un `<form>` cross-site admite `GET` y `POST` y nada más, y un
 * `fetch` con PATCH o DELETE dispara un preflight que CORS ya rechaza. Por eso
 * el tipo de contenido se EXIGE en POST y solo se comprueba en los demás.
 */
function isFormReachable(method: string): boolean {
  return method === "POST";
}

/**
 * Corre una operación del puerto y la devuelve como respuesta.
 *
 * @param work qué hacer con los repositorios de ESTA petición. Recibe el puerto
 *   y nada más: la ruta ya extrajo el id o la query antes de llamar.
 */
export async function handleData<T>(
  request: Request,
  work: (repositories: Repositories) => Promise<T>,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return fail({ kind: "unknown", message: OPAQUE_FAILURE }, 403);
  }

  // El tipo de contenido es la segunda cerradura contra el POST de un
  // formulario ajeno: los tres que un `<form>` sabe mandar
  // (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`)
  // se caen aquí, y `application/json` no se puede poner sin preflight.
  //
  // No se le exige a un DELETE, y no es una rendija: un DELETE no lleva cuerpo,
  // así que no declara tipo, y ningún formulario puede emitirlo. Exigírselo
  // rechazaría las peticiones de nuestro propio adaptador.
  const type = request.headers.get("content-type");
  const declaresJson = type?.startsWith("application/json") ?? false;
  if (isFormReachable(request.method) ? !declaresJson : Boolean(type) && !declaresJson) {
    return fail({ kind: "unknown", message: OPAQUE_FAILURE }, 415);
  }

  const backend = getServerBackend();

  try {
    // La sesión se comprueba aquí ADEMÁS de en el proxy, y no es paranoia: la
    // documentación de Next dice que el proxy no debe ser la única línea, y
    // `canAct` exige el email confirmado, que `gate` no garantiza por sí solo.
    const session = await backend.session.sessionFor(request.headers);
    if (!canAct(session)) throw new UnauthenticatedError();

    const value = await work(await backend.data.repositoriesFor(request));

    // `encodeJson` y no `JSON.stringify`: las entidades del puerto llevan
    // `Date`, y sin encajonarlas llegarían al navegador como cadenas tipadas
    // como fechas — un tipo que el compilador promete y el runtime no cumple.
    return new Response(encodeJson({ value: value ?? null }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    if (error instanceof MalformedRequest) {
      return fail({ kind: "unknown", message: OPAQUE_FAILURE }, 400);
    }

    const wire = encodeBackendError(error);
    // Lo que no es del puerto se loguea AQUÍ y no viaja: un error inesperado
    // puede llevar dentro el nombre de una columna, un fragmento de SQL o el
    // contenido de un Nodo. Es la misma regla que `actions.ts` fijó para la
    // capa de IA — el texto de una persona no acaba en el log de la plataforma
    // por accidente, ni en la respuesta.
    if (wire.kind === "unknown") console.error("[api/data]", error);

    return fail(wire, statusForWireError(wire));
  }
}

/**
 * Un parámetro de la query que tiene que estar.
 *
 * @throws MalformedRequest si falta o viene en blanco.
 */
export function requiredParam(request: Request, name: string): string {
  const value = new URL(request.url).searchParams.get(name)?.trim();
  if (!value) throw new MalformedRequest(name);
  return value;
}

/**
 * Un parámetro de la query que puede venir vacío.
 *
 * Existe por la Búsqueda: el puerto promete que un término en blanco devuelve
 * la lista vacía, y eso es una respuesta, no una petición mal formada. Quien
 * decide qué significa «en blanco» es el puerto, no esta ruta.
 */
export function optionalParam(request: Request, name: string): string {
  return new URL(request.url).searchParams.get(name) ?? "";
}

/** Un parámetro numérico de la query. @throws MalformedRequest */
export function requiredNumber(request: Request, name: string): number {
  const value = Number(requiredParam(request, name));
  if (!Number.isFinite(value)) throw new MalformedRequest(name);
  return value;
}

/**
 * El cuerpo, como objeto.
 *
 * No valida su FORMA, y es deliberado: quien decide qué es un título válido o
 * qué parche tiene sentido es `lib/services/` y los `check` de las migraciones,
 * que valen para todos los adaptadores. Comprobarlo también aquí sería tener la
 * misma regla en dos sitios, que es lo que este repo evita en todas partes.
 *
 * @throws MalformedRequest si no es un objeto JSON.
 */
export async function jsonBody<T>(request: Request): Promise<T> {
  let parsed: unknown;
  try {
    // `decodeJson` y no `request.json()`: es la inversa exacta de lo que manda
    // el adaptador. Hoy ninguna entrada del puerto lleva `Date` —los parches y
    // las altas son texto, ids y banderas—, así que en la práctica hacen lo
    // mismo; usar la inversa es lo que hace que siga siendo cierto el día que
    // una entrada la lleve, sin que nadie tenga que acordarse de esta línea.
    parsed = decodeJson(await request.text());
  } catch {
    throw new MalformedRequest("body");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new MalformedRequest("body");
  }
  return parsed as T;
}
