/**
 * La puerta: ninguna ruta protegida se ve sin sesión.
 *
 * En Next 16 esto es `proxy.ts` — `middleware.ts` está deprecado y renombrado.
 * Corre en el runtime de Node, que no se puede configurar aquí.
 *
 * Lo único que decide este archivo es «¿pública o protegida?»; lo demás lo
 * contesta el Proveedor de Backend activo a través de su `SessionGuard`. Y es
 * DELIBERADAMENTE una comprobación optimista: la autorización de verdad son las
 * políticas RLS del motor, que no dejan ver una fila ajena aunque alguien llegue
 * a la página. La documentación de Next lo dice con estas palabras — el proxy
 * «no debería ser tu única línea de defensa».
 *
 * Ver `docs/adr/0002-sesion-de-primera-parte.md`.
 */

import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath, loginRedirectFor } from "@/lib/auth/routes";
import { mergeSetCookies } from "@/lib/backend/cookies";
import { getServerBackend } from "@/lib/backend/server";
import type { SetCookies } from "@/lib/backend/ports";
import { PUBLIC_ROUTES } from "@/lib/constants";

function applyCookies(
  response: NextResponse,
  cookies: SetCookies,
): NextResponse {
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const guard = getServerBackend().session;

  // Una ruta pública no necesita al guardia, y ahorrarse la llamada importa: el
  // guardia puede acabar hablando con el proveedor. La excepción la decide el
  // adaptador, porque solo él sabe cómo le vuelve un login social.
  if (isPublicPath(pathname) && !guard.needsGateOnPublicPath(request)) {
    return NextResponse.next();
  }

  const gate = await guard.gate(request, {
    loginUrl: loginRedirectFor(pathname, request.url).toString(),
    // Las rutas públicas las decide la APP y viajan como parámetro: un adaptador
    // que las importara de aquí invertiría el límite del ADR 0001.
    publicPaths: PUBLIC_ROUTES,
  });

  if (gate.kind === "redirect") {
    return applyCookies(NextResponse.redirect(gate.to), gate.setCookies);
  }

  // Las cookies refrescadas se sientan en la respuesta Y en la petición que
  // sigue hacia abajo: sin la segunda mitad, el Server Component de esta misma
  // petición leería la cookie vieja y no vería la sesión que el guardia acaba
  // de validar.
  const headers = mergeSetCookies(request.headers, gate.setCookies);
  for (const [key, value] of Object.entries(gate.requestHeaders)) {
    headers.set(key, value);
  }
  return applyCookies(
    NextResponse.next({ request: { headers } }),
    gate.setCookies,
  );
}

export const config = {
  /**
   * Sin `matcher`, el proxy corre también sobre `_next/static`, `_next/image` y
   * los archivos de `public/`, y entonces la lógica de sesión bloquearía el CSS
   * y las fuentes. El patrón es negativo por eso.
   *
   * Tiene que ser una constante analizable en tiempo de build: una variable se
   * ignora en silencio.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:woff2|png|svg|ico)$).*)",
  ],
};
