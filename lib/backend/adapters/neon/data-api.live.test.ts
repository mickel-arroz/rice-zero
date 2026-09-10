/**
 * El token que llega al Data API es un JWT, y el Data API contesta.
 *
 * Existe por un fallo concreto: el Data API rechazaba TODA lectura con
 * «Provided authentication token is not a valid JWT encoding» mientras el login
 * funcionaba perfectamente. El agujero estuvo abierto desde el #7 y no lo vio
 * nadie porque hasta el #9 ninguna pantalla leía datos — la autenticación y la
 * lectura son dos caminos distintos, y el primero pasaba.
 *
 * Es una corrida en vivo (`npm run test:contract:live`) y no puede ser otra
 * cosa: lo que se comprueba es la forma del token que emite un servicio real y
 * lo que ese servicio real hace con él. Un doble no tiene nada que decir aquí.
 *
 * ── Qué cambió con el ADR 0006 ────────────────────────────────────────────
 *
 * El camino de datos se mudó al servidor, así que este archivo ya no puede
 * pedirle el token al cliente de navegador: allí no queda ninguno. Lo pide al
 * endpoint `/token` del proveedor directamente, apoyándose en el tarro de
 * cookies de `vitest.live.setup.ts`, y con él arma el MISMO cliente de datos
 * que arma la mitad de servidor (`createNeonDataClient`).
 *
 * Lo que se prueba sigue siendo exactamente lo mismo —la forma del token y lo
 * que el Data API hace con él— porque eso es lo único que esta corrida puede
 * probar. Lo que NO cubre es el salto por nuestras rutas, igual que ya no
 * cubría el salto por `/api/auth`: eso se ve en Playwright.
 *
 * Solo LEE: no crea ni borra nada, así que no depende del estado de la cuenta.
 */

import { describe, expect, it } from "vitest";

import { getNeonClient, resetNeonClient } from "@/lib/backend/adapters/neon/client";
import { createNeonDataClient } from "@/lib/backend/adapters/neon/data";
import { getBackend, resetBackend } from "@/lib/backend";
import { readBackendName } from "@/lib/backend/switch";

const enabled =
  process.env.BACKEND_CONTRACT_LIVE === "1" &&
  Boolean(process.env.BACKEND_CONTRACT_EMAIL) &&
  Boolean(process.env.BACKEND_CONTRACT_PASSWORD) &&
  process.env.NEXT_PUBLIC_BACKEND?.trim() === "neon";

if (!enabled) {
  describe.skip("Data API de Neon (apagado)", () => {});
} else {
  describe("Data API de Neon", () => {
    /**
     * Deja la sesión abierta y devuelve el JWT y el cliente de datos.
     *
     * Una sola vez para todo el archivo: Managed Better Auth contesta
     * `429 over_request_rate_limit` a los pocos logins seguidos.
     */
    const signedIn = (async () => {
      resetBackend();
      resetNeonClient();
      expect(readBackendName()).toBe("neon");
      await getBackend().auth.signInWithEmail({
        email: process.env.BACKEND_CONTRACT_EMAIL!,
        password: process.env.BACKEND_CONTRACT_PASSWORD!,
      });

      // El `fetch` de esta corrida lleva el tarro de cookies y la cabecera
      // `Origin` que el proveedor exige, así que esta llamada es la misma que
      // hace `token.ts` en el servidor, sin el proxy en medio.
      const response = await fetch(`${process.env.NEON_AUTH_URL}/token`);
      const body = (await response.json()) as { token?: string };
      const token = body.token ?? null;

      return { token, client: createNeonDataClient(async () => token, () => {}) };
    })();

    it("lo que se le entrega al Data API es un JWT", async () => {
      const { token } = await signedIn;

      expect(token, "no hay token que entregar").toBeTruthy();

      // Tres segmentos separados por punto. Es lo ÚNICO que se afirma sobre el
      // contenido: el token es una credencial y no se imprime ni se decodifica
      // más allá de la cabecera, que es pública por definición.
      const segments = token!.split(".");
      expect(
        segments,
        "el Data API exige un JWT; esto no lo es",
      ).toHaveLength(3);

      const header = JSON.parse(
        Buffer.from(segments[0], "base64url").toString("utf8"),
      ) as { alg?: string };
      expect(header.alg, "un JWT sin algoritmo no lo verifica nadie").toBeTruthy();
    });

    it("el token de la sesión NO es el que sirve", async () => {
      // El contraejemplo, y por eso está: `session.token` es lo que devuelve
      // `getJWTToken()` del propio SDK, y detrás de nuestro proxy de primera
      // parte es un identificador opaco. Tomarlo por un JWT fue el fallo. Si
      // algún día los dos coinciden, este test lo dirá antes de que alguien
      // «simplifique» el servidor de vuelta al agujero.
      const { token } = await signedIn;
      const { data } = await getNeonClient().auth.getSession();

      expect(data?.session?.token).toBeTruthy();
      expect(token).not.toBe(data?.session?.token);
    });

    it("la vista de la lista de Proyectos responde", async () => {
      const { client } = await signedIn;

      // La consulta EXACTA que hace la pantalla de Proyectos: la vista, con su
      // orden. Comprueba de una vez el token, la caché de esquema de PostgREST
      // —una vista recién creada no existe hasta que se recarga— y el `grant`.
      const { data, error } = await client.data
        .from("project_overviews")
        .select("*")
        .order("last_activity_at", { ascending: false, nullsFirst: false });

      expect(error, error?.message).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it("la RPC del alta está expuesta", async () => {
      const { client } = await signedIn;

      // Sin llegar a crear nada: un título vacío lo rechaza el `check` de la
      // tabla, así que un error de CHECK prueba que la función existe, que se
      // puede ejecutar y que llegó a intentar el insert. Un «no existe la
      // función» diría otra cosa muy distinta.
      const { error } = await client.data.rpc("create_project_with_version", {
        p_title: "   ",
        p_description: null,
        p_icon: "node",
      });

      expect(error, "la RPC debería existir y rechazar el título").not.toBeNull();
      expect(error?.message ?? "").not.toMatch(/does not exist|not find/i);
    });
  });
}
