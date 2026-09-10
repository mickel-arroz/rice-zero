/**
 * La caché del JWT en servidor, contra un doble que CUENTA.
 *
 * Contar es lo único que demuestra lo que esta caché existe para hacer: ahorrar
 * viajes. Un doble que solo devolviera tokens pasaría igual con la caché rota.
 *
 * Los JWT se fabrican aquí porque solo hace falta que la carga útil sea legible:
 * `expiryOf` lee el `exp` en claro y no verifica nada —de eso se encarga el
 * motor contra el JWKS—, así que firmarlos no probaría nada más.
 */

import { describe, expect, it, vi } from "vitest";

import {
  createTokenSource,
  expiryOf,
  TOKEN_CACHE_MAX,
  TOKEN_MARGIN_MS,
} from "@/lib/backend/adapters/neon/token";

const COOKIE = "__Secure-neon-auth.session_token";

function jwtExpiringIn(seconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString("base64url");
  return `cabecera.${payload}.firma`;
}

/** Una petición con la cookie de sesión que sea. */
function requestWith(session: string | null): Request {
  const headers = new Headers();
  if (session !== null) headers.set("cookie", `${COOKIE}=${session}`);
  return new Request("https://rice.invalid/api/projects", { headers });
}

function countingSource(token: () => string | null = () => jwtExpiringIn(3600)) {
  const fetcher = vi.fn(async () => token());
  return { fetcher, source: createTokenSource(fetcher) };
}

describe("expiryOf", () => {
  it("lee el exp de la carga útil", () => {
    const expiry = expiryOf(jwtExpiringIn(60));
    expect(expiry).toBeGreaterThan(Date.now());
  });

  it("no adivina lo que no puede leer", () => {
    expect(expiryOf("no-es-un-jwt")).toBeNull();
    expect(expiryOf("a.no-es-base64-valido!.c")).toBeNull();
    expect(expiryOf(`a.${Buffer.from("{}").toString("base64url")}.c`)).toBeNull();
  });
});

describe("la caché ahorra viajes", () => {
  it("la segunda petición de la misma sesión no vuelve a preguntar", async () => {
    const { fetcher, source } = countingSource();
    await source.tokenFor(requestWith("s1"));
    await source.tokenFor(requestWith("s1"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("dos consultas simultáneas piden UN token, no dos", async () => {
    const { fetcher, source } = countingSource();
    await Promise.all([
      source.tokenFor(requestWith("s1")),
      source.tokenFor(requestWith("s1")),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("un token a punto de caducar no se reutiliza", async () => {
    // Dentro del margen: `until` ya quedó en el pasado al guardarlo.
    const { fetcher, source } = countingSource(() =>
      jwtExpiringIn(TOKEN_MARGIN_MS / 1000 - 10),
    );
    await source.tokenFor(requestWith("s1"));
    await source.tokenFor(requestWith("s1"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("la clave es la cookie, y eso es lo que la hace segura", () => {
  it("otra sesión NUNCA recibe el token de la anterior", async () => {
    const tokens = ["de-la-primera", "de-la-segunda"];
    let next = 0;
    const source = createTokenSource(async () => {
      const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url");
      return `${tokens[next++]}.${payload}.firma`;
    });

    const primera = await source.tokenFor(requestWith("s1"));
    const segunda = await source.tokenFor(requestWith("s2"));

    expect(primera).toContain("de-la-primera");
    expect(segunda).toContain("de-la-segunda");
  });

  it("sin cookie de sesión no se sale a preguntar", async () => {
    const { fetcher, source } = countingSource();
    expect(await source.tokenFor(requestWith(null))).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("un 401 del proveedor no se cachea: la sesión puede aparecer después", async () => {
    const { fetcher, source } = countingSource(() => null);
    await source.tokenFor(requestWith("s1"));
    await source.tokenFor(requestWith("s1"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("olvidar obliga a pedir otro", async () => {
    const { fetcher, source } = countingSource();
    await source.tokenFor(requestWith("s1"));
    source.forget(requestWith("s1"));
    await source.tokenFor(requestWith("s1"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("el mapa no crece sin límite", () => {
  it("se queda en el tope aunque pasen muchas más sesiones", async () => {
    const { fetcher, source } = countingSource();
    for (let n = 0; n < TOKEN_CACHE_MAX + 50; n += 1) {
      await source.tokenFor(requestWith(`s${n}`));
    }
    expect(fetcher).toHaveBeenCalledTimes(TOKEN_CACHE_MAX + 50);

    // La última sigue cacheada: el desalojo se lleva las viejas, no la recién
    // puesta. Si se hubiera llevado ésta, la instancia dejaría de cachear nada.
    fetcher.mockClear();
    await source.tokenFor(requestWith(`s${TOKEN_CACHE_MAX + 49}`));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("las caducadas se podan antes de echar a nadie vivo", async () => {
    let corta = true;
    const fetcher = vi.fn(async () =>
      jwtExpiringIn(corta ? TOKEN_MARGIN_MS / 1000 - 10 : 3600),
    );
    const source = createTokenSource(fetcher);

    // El mapa se llena hasta el tope de entradas que nacen ya muertas.
    for (let n = 0; n < TOKEN_CACHE_MAX; n += 1) {
      await source.tokenFor(requestWith(`muerta-${n}`));
    }
    corta = false;
    await source.tokenFor(requestWith("viva"));

    // La viva sobrevive: la poda liberó sitio con las muertas sin tocarla, así
    // que la segunda lectura sale del caché y no vuelve a preguntar. Sin poda,
    // el desalojo por antigüedad habría entrado igual y esto seguiría pasando
    // —por eso hace falta la otra mitad: que la sesión que trabaja no se caiga.
    fetcher.mockClear();
    expect(await source.tokenFor(requestWith("viva"))).toContain("cabecera");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("una sesión activa no la desaloja el trasiego de sesiones muertas", async () => {
    let corta = false;
    const fetcher = vi.fn(async () =>
      jwtExpiringIn(corta ? TOKEN_MARGIN_MS / 1000 - 10 : 3600),
    );
    const source = createTokenSource(fetcher);

    // Ésta entra la PRIMERA, así que es la más vieja: sin poda previa, sería la
    // primera en caer por antigüedad aunque siga viva y en uso.
    await source.tokenFor(requestWith("trabajando"));

    corta = true;
    for (let n = 0; n < TOKEN_CACHE_MAX + 20; n += 1) {
      await source.tokenFor(requestWith(`muerta-${n}`));
    }

    fetcher.mockClear();
    await source.tokenFor(requestWith("trabajando"));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
