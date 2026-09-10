/**
 * La Búsqueda global de Nodos.
 *
 * El tope viaja en la query y no se fija aquí: quien lo decide es
 * `lib/services/nodes.ts` (`SEARCH_LIMIT`), que es de la app. Ponerlo también
 * en esta ruta sería una segunda copia que un día diría otra cosa.
 */

import {
  handleData,
  optionalParam,
  requiredNumber,
} from "@/lib/backend/http/route";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) =>
    repositories.nodes.search(
      // Opcional y no obligatorio: el puerto promete que un término en blanco
      // devuelve la lista vacía, así que `?q=` es una pregunta válida con una
      // respuesta conocida, no una petición rota.
      optionalParam(request, "q"),
      requiredNumber(request, "limit"),
    ),
  );
}
