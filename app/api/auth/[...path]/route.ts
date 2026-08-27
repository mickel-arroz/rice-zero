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
 * Ver `docs/adr/0002-sesion-de-primera-parte.md`.
 */

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
  const route = getServerBackend().authRoute;
  if (!route) return notMounted();
  return route.handle(request, (await params).path.join("/"));
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
