/**
 * La mitad de SERVIDOR del Proveedor de Backend.
 *
 * El puerto de `auth.ts` es el que usa el navegador. Este es el que usa el
 * servidor cuando llega una petición: leer la sesión de ESA petición y decidir
 * si pasa. Son dos superficies porque son dos sitios distintos con dos fuentes
 * distintas —el navegador tiene un cliente memoizado; el servidor solo tiene las
 * cookies que le llegan— y fingir que son una sola obligaría a que `getBackend()`
 * corriera en los dos lados.
 *
 * Habla `Request`, `Headers` y `Set-Cookie`: estándares web, no de Next. Quien
 * traduce a `NextResponse` es `proxy.ts`, y quien traduce el contexto de un Route
 * Handler es `app/api/auth/[...path]/route.ts`. Así el puerto sigue sin saber en
 * qué framework vive, igual que no sabe qué SDK hay debajo.
 *
 * Ver `docs/adr/0002-sesion-de-primera-parte.md`.
 */

import type { AuthSession } from "@/lib/backend/ports/entities";

/**
 * Dónde se monta la superficie HTTP de auth.
 *
 * Vive aquí, del lado del backend, y no en `lib/constants.ts`: la ruta existe
 * porque el proveedor la necesita, así que es él quien la nombra. La app la
 * consume desde `ROUTES.authApi`, no al revés.
 */
export const AUTH_ROUTE_MOUNT = "/api/auth";

/**
 * Cookies que el adaptador quiere sentar, ya serializadas como cabeceras
 * `Set-Cookie`. Son opacas a propósito: qué cookies existen, cómo se llaman y
 * cuánto viven es detalle del proveedor.
 */
export type SetCookies = readonly string[];

/** Lo que el servidor decide sobre una petición. */
export type SessionGate =
  | {
      readonly kind: "allow";
      readonly setCookies: SetCookies;
      /** Cabeceras que el adaptador quiere añadir a la petición aguas abajo. */
      readonly requestHeaders: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: "redirect";
      /** Absoluta, porque un redirect HTTP la necesita así. */
      readonly to: string;
      readonly setCookies: SetCookies;
    };

export type GateOptions = {
  /** Absoluta: a dónde mandar a quien no tenga sesión. */
  readonly loginUrl: string;
  /**
   * Las rutas que no exigen sesión.
   *
   * Las decide la APP y viajan como parámetro porque son suyas: un adaptador que
   * las importara de `lib/constants.ts` invertiría el límite que fija el ADR
   * 0001. Hacen falta aquí porque la vuelta de un login social puede caer en una
   * ruta pública, y entonces hay que canjearla sin exigir sesión.
   */
  readonly publicPaths: readonly string[];
};

export interface SessionGuard {
  /**
   * ¿Hay que pasar por el guardia aunque la ruta sea PÚBLICA?
   *
   * Existe por la vuelta de un login social: el proveedor devuelve al usuario a
   * una URL con un parámetro que hay que canjear por la cookie de sesión, y esa
   * URL puede caer en una ruta pública. Sin esta pregunta, el canje no ocurría
   * nunca y entrar con Google terminaba sin sesión.
   *
   * Es una pregunta y no una constante en `proxy.ts` porque el nombre del
   * parámetro es detalle de cada proveedor: Managed Better Auth manda un
   * verificador propio y Supabase manda el `code` de PKCE. Síncrona a propósito:
   * se contesta mirando la URL, y corre en cada petición.
   */
  needsGateOnPublicPath(request: Request): boolean;

  /**
   * La sesión que traen estas cabeceras, o `null` si no traen ninguna.
   *
   * Pide `Headers` y no un `Request` porque lo único que mira son las cookies, y
   * porque así lo pueden llamar sus dos usuarios sin inventarse nada: el proxy
   * pasa `request.headers` y un Server Component pasa el `headers()` de Next.
   * Con un `Request` completo, el segundo tenía que fabricar una URL falsa.
   *
   * No lanza. Es la comprobación «optimista» que la documentación de Next
   * recomienda; la autorización de verdad la hacen las políticas RLS del motor.
   * Cuánto cuesta depende del adaptador: Neon lee una cookie que él mismo firmó,
   * mientras que Supabase tiene que preguntarle a su servidor de auth.
   */
  sessionFor(headers: Headers): Promise<AuthSession | null>;

  /** Decide si la petición pasa, y de paso refresca la sesión si toca. */
  gate(request: Request, options: GateOptions): Promise<SessionGate>;
}

/**
 * La superficie HTTP que el adaptador necesita montada, si necesita alguna.
 *
 * Un solo método y no uno por verbo: el proveedor distingue las operaciones por
 * la RUTA y no por el método, así que `GET` y `POST` acaban en el mismo sitio.
 * Repetirlo cinco veces en el puerto solo abría el hueco de olvidar un verbo.
 */
export type AuthRoute = {
  /**
   * @param request la petición tal cual llegó.
   * @param path la ruta bajo el punto de montaje, sin barra inicial
   *   (`sign-in/email`, `get-session`).
   */
  handle(request: Request, path: string): Promise<Response>;
};

/**
 * ¿Puede esta sesión actuar?
 *
 * No basta con que exista. El spec exige confirmación de email OBLIGATORIA, y
 * eso no se puede dejar en manos del adaptador del navegador: cuando el handler
 * de auth proxea un `sign-in/email`, el SDK ya ha convertido la respuesta en
 * cookies de PRIMERA parte antes de que el adaptador pueda mirar `emailVerified`.
 * Si el toggle «Verify at Sign-up» de la consola del proveedor se apagara, el
 * navegador se quedaría con una sesión viva mientras la interfaz muestra un
 * error — y `proxy.ts` la dejaría entrar.
 *
 * Así que la regla vive AQUÍ, en el servidor, donde la cookie ya no se puede
 * discutir. La comprueban el guardia y las rutas protegidas.
 */
export function canAct(session: AuthSession | null): session is AuthSession {
  return session !== null && session.user.emailVerified;
}

/** El Proveedor de Backend visto desde el servidor. */
export type ServerBackendProvider = {
  readonly name: string;
  readonly session: SessionGuard;
  /** `null` cuando el proveedor no necesita ninguna ruta propia. */
  readonly authRoute: AuthRoute | null;
};
