/**
 * El guardia de servidor de Neon, contra cookies de verdad.
 *
 * No hay red: `sessionFor` está diseñado justamente para no necesitarla —lee la
 * cookie que el propio servidor firmó—, y eso es lo que lo hace testeable. Las
 * cookies se firman aquí con `node:crypto`, con el mismo algoritmo que el SDK
 * (HS256), en vez de fingir el módulo del proveedor: lo que se quiere probar es
 * que la FIRMA importa, y un doble no lo probaría.
 *
 * `gate` no se prueba aquí porque sí sale a la red; lo cubre la corrida en vivo.
 */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNeonServerBackend } from "@/lib/backend/adapters/neon/server";
import { canAct } from "@/lib/backend/ports";

const SECRET = "un-secreto-de-mas-de-treinta-y-dos-caracteres";
const OTHER_SECRET = "otro-secreto-igual-de-largo-pero-distinto";
const COOKIE_NAME = "__Secure-neon-auth.local.session_data";

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

/** Un JWT HS256 con la forma que `validateSessionData` espera. */
function signSessionData({
  emailVerified,
  secret = SECRET,
  expiresInSeconds = 300,
}: {
  emailVerified: boolean;
  secret?: string;
  expiresInSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date(now * 1000).toISOString();
  const payload = {
    session: {
      id: "sesion-1",
      token: "token-opaco",
      userId: "4f2a0000-0000-4000-8000-000000009c11",
      expiresAt: iso,
      createdAt: iso,
      updatedAt: iso,
    },
    user: {
      id: "4f2a0000-0000-4000-8000-000000009c11",
      email: "mickel@avilatek.dev",
      emailVerified,
      createdAt: iso,
      updatedAt: iso,
    },
    iat: now,
    exp: now + expiresInSeconds,
    sub: "4f2a0000-0000-4000-8000-000000009c11",
  };

  const signingInput = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(
    JSON.stringify(payload),
  )}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

const headersWith = (cookie: string) => new Headers({ cookie });

describe("guardia de servidor de Neon", () => {
  const previous = {
    url: process.env.NEON_AUTH_URL,
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  };

  beforeEach(() => {
    process.env.NEON_AUTH_URL = "https://ejemplo.neonauth.test/neondb/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.NEON_AUTH_URL = previous.url;
    process.env.NEON_AUTH_COOKIE_SECRET = previous.secret;
  });

  const guard = () => createNeonServerBackend().session;

  it("monta una ruta de auth propia", () => {
    // Es la asimetría con Supabase que el ADR 0002 explica: Neon necesita el
    // proxy para que la cookie sea de primera parte; Supabase no.
    expect(createNeonServerBackend().authRoute).not.toBeNull();
  });

  it("lee la sesión de una cookie bien firmada", async () => {
    const cookie = signSessionData({ emailVerified: true });
    const session = await guard().sessionFor(
      headersWith(`${COOKIE_NAME}=${cookie}`),
    );
    expect(session?.user.email).toBe("mickel@avilatek.dev");
    expect(session?.user.emailVerified).toBe(true);
  });

  it("conserva que el email NO está confirmado", async () => {
    // El dato que sostiene la confirmación obligatoria. Si se perdiera aquí,
    // `canAct` no tendría nada con lo que negar el paso.
    const cookie = signSessionData({ emailVerified: false });
    const session = await guard().sessionFor(
      headersWith(`${COOKIE_NAME}=${cookie}`),
    );
    expect(session?.user.emailVerified).toBe(false);
    expect(canAct(session)).toBe(false);
  });

  it("rechaza una cookie firmada con otro secreto", async () => {
    // La propiedad de seguridad de verdad: sin esto, cualquiera se fabricaría
    // una sesión y `proxy.ts` la dejaría pasar.
    const cookie = signSessionData({
      emailVerified: true,
      secret: OTHER_SECRET,
    });
    expect(
      await guard().sessionFor(headersWith(`${COOKIE_NAME}=${cookie}`)),
    ).toBeNull();
  });

  it("rechaza una cookie manipulada", async () => {
    const cookie = signSessionData({ emailVerified: false });
    const [header, payload, signature] = cookie.split(".");
    const tampered = JSON.parse(Buffer.from(payload, "base64url").toString());
    tampered.user.emailVerified = true;
    const forged = `${header}.${base64url(JSON.stringify(tampered))}.${signature}`;
    expect(
      await guard().sessionFor(headersWith(`${COOKIE_NAME}=${forged}`)),
    ).toBeNull();
  });

  it("rechaza una cookie caducada", async () => {
    const cookie = signSessionData({
      emailVerified: true,
      expiresInSeconds: -10,
    });
    expect(
      await guard().sessionFor(headersWith(`${COOKIE_NAME}=${cookie}`)),
    ).toBeNull();
  });

  it("no ve sesión sin cookies, o con otras cookies", async () => {
    expect(await guard().sessionFor(new Headers())).toBeNull();
    expect(await guard().sessionFor(headersWith("otra=cosa"))).toBeNull();
  });

  it("solo se queda con la vuelta de OAuth entre las rutas públicas", () => {
    const url = (query: string) =>
      new Request(`https://rice.test/projects${query}`);
    expect(
      guard().needsGateOnPublicPath(url("?neon_auth_session_verifier=abc")),
    ).toBe(true);
    expect(guard().needsGateOnPublicPath(url(""))).toBe(false);
    expect(guard().needsGateOnPublicPath(url("?code=abc"))).toBe(false);
  });
});
