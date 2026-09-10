/**
 * El handler de auth del Proveedor de Backend activo.
 *
 * Es un proxy: recibe lo que el cliente del navegador manda a `/api/auth/*`, lo
 * reenvía al servicio del proveedor y —esto es lo importante— convierte la sesión
 * que vuelve en una cookie httpOnly de PRIMERA parte. Es lo único que permite que
 * `proxy.ts` sepa si hay sesión: una cookie del dominio de Neon no la puede leer
 * nuestro servidor.
 *
 * Este archivo es el ÚNICO sitio que traduce el contexto de un Route Handler de
 * Next a lo que el puerto entiende: una petición y la ruta bajo el punto de
 * montaje. El puerto no sabe cómo se llama la carpeta.
 *
 * No todos los proveedores necesitan esta ruta. Supabase escribe sus cookies de
 * primera parte desde el navegador, así que su `authRoute` es `null` y aquí se
 * contesta 404: la ruta existe, pero no para ese proveedor.
 *
 * Reenvía CASI cualquier segmento: `isBlockedAuthPath` deja fuera `token`, que
 * es el endpoint del plugin JWT. Mientras estuvo abierto, cualquier script del
 * origen podía canjear la cookie httpOnly por un JWT portátil y llevárselo. Ver
 * `docs/adr/0006-los-datos-pasan-por-la-api-propia.md`.
 *
 * Ver `docs/adr/0002-sesion-de-primera-parte.md`.
 */

import { isBlockedAuthPath } from "@/lib/auth/routes";
import { getServerBackend } from "@/lib/backend/server";

/** La sesión sale de las cookies de la petición: nada de esto se puede cachear. */
export const dynamic = "force-dynamic";

/**
 * Una fábrica y no una constante: un `Response` lleva un cuerpo que se consume
 * al leerlo, así que devolver la MISMA instancia en una segunda petición falla
 * con el flujo ya agotado.
 */
const notMounted = () =>
  Response.json(
    { error: "El Proveedor de Backend activo no monta un handler de auth." },
    { status: 404 },
  );

/**
 * Una ruta del proveedor que este proxy no reenvía. Hoy solo `token`.
 *
 * 404 y no 403: «esta ruta no existe aquí» es la verdad y es lo que menos
 * cuenta. Un 403 confirmaría que hay algo detrás que merece protegerse.
 */
const blocked = () =>
  Response.json({ error: "No se encontró la ruta." }, { status: 404 });

/**
 * El proveedor distingue sus operaciones por la RUTA, no por el método, así que
 * todos los verbos acaban en el mismo sitio.
 *
 * El backend se resuelve en cada llamada y no al importar el módulo: así un
 * `MissingEnvError` sale como un 500 de ESTA petición en vez de tumbar el
 * arranque del servidor entero.
 */
async function handler(
  request: Request,
  { params }: RouteContext<"/api/auth/[...path]">,
): Promise<Response> {
  const path = (await params).path.join("/");
  // Antes de resolver el backend: negarse no depende del proveedor, y así la
  // negativa no puede fallar por configuración que falte.
  if (isBlockedAuthPath(path)) return blocked();

  const route = getServerBackend().authRoute;
  if (!route) return notMounted();
  return route.handle(request, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
