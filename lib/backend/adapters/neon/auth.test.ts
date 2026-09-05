/**
 * La traducción de errores del adaptador de Neon.
 *
 * Existe por un fallo concreto que NADA más habría cogido. El puerto promete
 * que un enlace de recuperación agotado llega como `ConflictError` con la regla
 * `token-caducado`, y el mapeo se escribió sobre el código que contesta Better
 * Auth (`INVALID_TOKEN`, comprobado con curl contra el servicio). Pero el SDK de
 * Neon NORMALIZA el error antes de dárselo a la app: lo convierte en `bad_jwt`
 * con un 401. Resultado: la pantalla decía «no hemos podido guardar la
 * contraseña» y dejaba al usuario delante de un formulario que nunca iba a
 * funcionar.
 *
 * Ni el typecheck ni el doble en memoria podían verlo —los dos hablan de la
 * FORMA del error, no de qué códigos manda el SDK de verdad—, así que lo que se
 * fija aquí es la forma observada, con un `AuthApiError` de verdad del propio
 * paquete y no un objeto a mano.
 */

import { AuthApiError } from "@neondatabase/auth";
import { describe, expect, it, vi } from "vitest";

import { createNeonAuthProvider } from "@/lib/backend/adapters/neon/auth";
import type { NeonBrowserClient } from "@/lib/backend/adapters/neon/client";
import { RESET_TOKEN_RULE } from "@/lib/backend/ports";

/** Lo que el SDK devuelve de verdad cuando el token de reset no vale. */
const TOKEN_NORMALIZADO = () =>
  new AuthApiError("Invalid or expired session token", 401, "bad_jwt");

/**
 * Un cliente con solo lo que la operación bajo prueba toca.
 *
 * El `cast` es deliberado y está acotado a este archivo: `VanillaBetterAuthClient`
 * es un Proxy con cientos de métodos, y construirlo entero para probar una
 * traducción de errores sería fabricar ruido, no confianza.
 */
function clienteCon(auth: Record<string, unknown>): NeonBrowserClient {
  return {
    auth,
    data: {},
    accessToken: async () => null,
    forgetToken: () => {},
  } as unknown as NeonBrowserClient;
}

describe("adaptador de Neon: recuperar la contraseña", () => {
  it("traduce el token rechazado, lo DEVUELVA el SDK…", async () => {
    const auth = createNeonAuthProvider(
      clienteCon({ resetPassword: async () => ({ error: TOKEN_NORMALIZADO() }) }),
    ).resetPassword("token-gastado", "contraseña-nueva");

    await expect(auth).rejects.toMatchObject({
      name: "ConflictError",
      rule: RESET_TOKEN_RULE,
    });
  });

  it("…o lo LANCE, que es lo que hace de verdad", async () => {
    // El camino observado contra el servicio real: el SDK no devuelve el fallo
    // en `error`, lanza. Si solo se cubriera el otro, este test pasaría y la
    // pantalla seguiría rota.
    const auth = createNeonAuthProvider(
      clienteCon({
        resetPassword: async () => {
          throw TOKEN_NORMALIZADO();
        },
      }),
    ).resetPassword("token-gastado", "contraseña-nueva");

    await expect(auth).rejects.toMatchObject({
      name: "ConflictError",
      rule: RESET_TOKEN_RULE,
    });
  });

  it("no confunde una sesión caducada con un enlace caducado", async () => {
    // `bad_jwt` es TAMBIÉN lo que contesta una sesión que expiró, y por eso la
    // traducción del token vive dentro de `resetPassword` y no en la general:
    // aquí tiene que salir por la puerta de siempre, la que manda a login.
    const auth = createNeonAuthProvider(
      clienteCon({
        signIn: {
          email: async () => {
            throw TOKEN_NORMALIZADO();
          },
        },
      }),
    ).signInWithEmail({ email: "quien@rice-zero.invalid", password: "x" });

    await expect(auth).rejects.toMatchObject({ name: "UnauthenticatedError" });
  });

  it("no traduce a error lo que el proveedor acepta", async () => {
    // Pedir el enlace para una cuenta que no existe contesta `200` igual que
    // para una que sí: el puerto promete no distinguirlas, y el adaptador no
    // puede añadir una comprobación que las separe.
    const requestPasswordReset = vi.fn(async () => ({ error: null }));
    const provider = createNeonAuthProvider(clienteCon({ requestPasswordReset }));

    await expect(
      provider.sendPasswordReset(
        "nadie@rice-zero.invalid",
        "https://rice-zero.invalid/reset-password",
      ),
    ).resolves.toBeUndefined();

    // Y el destino viaja tal cual: es lo que el proveedor mete en el enlace del
    // correo, y también lo que valida contra sus orígenes registrados.
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "nadie@rice-zero.invalid",
      redirectTo: "https://rice-zero.invalid/reset-password",
    });
  });
});
