import { describe, expect, it } from "vitest";

import {
  clearPrivateCaches,
  isNeverCached,
  isOfflineDocument,
} from "@/lib/pwa/cache";
import { API_MOUNT, DATA_ROUTES } from "@/lib/backend/http/mount";
import { ROUTES } from "@/lib/constants";

/** Una petición como la que le llega al matcher del service worker. */
function ask({
  destination = "document",
  method = "GET",
  url = "https://rice.example/projects/abc",
}: { destination?: string; method?: string; url?: string } = {}) {
  return { request: { destination, method, url }, origin: "https://rice.example" };
}

describe("isOfflineDocument", () => {
  it("reclama la navegación a una página", () => {
    expect(isOfflineDocument(ask())).toBe(true);
  });

  it("no reclama lo que no es una página", () => {
    // Una petición RSC llega como `fetch`, no como documento. Si el fallback la
    // atrapara, el payload que Next espera volvería siendo HTML y React
    // revienta con un error opaco en vez de salir la pantalla offline. Lo mismo
    // valen las imágenes y los scripts: cada una tiene su propia regla.
    expect(isOfflineDocument(ask({ destination: "" }))).toBe(false);
    expect(isOfflineDocument(ask({ destination: "image" }))).toBe(false);
    expect(isOfflineDocument(ask({ destination: "script" }))).toBe(false);
  });

  it("no reclama una navegación que escribe", () => {
    // Un formulario que se envía sin red es una navegación con destino
    // `document`, así que la regla de arriba lo atraparía. Y responder 200 con
    // la pantalla offline a un POST es peor que no responder: se lee como que
    // el envío salió bien. Sin conexión no se escribe — es el contrato de
    // Autoguardado de CONTEXT.md.
    expect(isOfflineDocument(ask({ method: "POST" }))).toBe(false);
  });

  it("no reclama una página de otro origen", () => {
    // Mismo destino y mismo método que el caso que SÍ pasa: lo único que
    // cambia es el host, así que el test aísla el origen como criterio.
    expect(
      isOfflineDocument(ask({ url: "https://otra.example/projects/abc" })),
    ).toBe(false);
  });
});

/** Un `CacheStorage` de mentira, con los nombres que se le pasen dentro. */
function fakeCaches(names: string[]) {
  let open = [...names];
  return {
    keys: async () => [...open],
    delete: async (name: string) => {
      const had = open.includes(name);
      open = open.filter((n) => n !== name);
      return had;
    },
  };
}

describe("clearPrivateCaches", () => {
  it("tira las cachés con páginas del usuario dentro", async () => {
    // Los tres nombres que `defaultCache` usa para páginas, juntos: si alguna
    // vez uno se colara en la lista blanca, este test es el que lo dice.
    const store = fakeCaches(["pages", "pages-rsc", "pages-rsc-prefetch"]);
    await clearPrivateCaches(store);
    expect(await store.keys()).toEqual([]);
  });

  it("conserva lo que no es de nadie", async () => {
    // La otra mitad: el purgado tiene que dejar vivo el cascarón. Un
    // `clearPrivateCaches` que borrara todo pasaría el test de arriba.
    const store = fakeCaches([
      "static-font-assets",
      "static-image-assets",
      "next-static-js-assets",
      "static-style-assets",
    ]);
    await clearPrivateCaches(store);
    expect(await store.keys()).toEqual([
      "static-font-assets",
      "static-image-assets",
      "next-static-js-assets",
      "static-style-assets",
    ]);
  });

  it("tira una caché que nadie previó", async () => {
    // El caso que fija la FORMA de la lista, y no su contenido: con una lista
    // negra este nombre sobreviviría. Es el test que hay que borrar a mano si
    // alguien quiere invertir el criterio, y por eso está escrito aparte.
    const store = fakeCaches(["una-caché-de-mañana", "static-font-assets"]);
    await clearPrivateCaches(store);
    expect(await store.keys()).toEqual(["static-font-assets"]);
  });
});

/**
 * Lo que NUNCA se guarda.
 *
 * `/reset-password` lleva el token del correo en la URL, y las entradas de
 * `CacheStorage` se indexan POR la URL: cachearla deja una credencial de un
 * solo uso escrita en disco como clave. Y `clearPrivateCaches` no la alcanza,
 * porque solo corre al cerrar sesión y quien recupera su contraseña no tiene
 * ninguna.
 */
describe("isNeverCached", () => {
  it("no guarda la ruta que lleva el token en la URL", () => {
    expect(
      isNeverCached({ pathname: ROUTES.resetPassword, sameOrigin: true }),
    ).toBe(true);
  });

  it("tampoco lo que cuelgue de ella", () => {
    // Por si mañana hay `/reset-password/algo`: una ruta hija hereda el mismo
    // problema, y descubrirlo entonces sería descubrirlo tarde.
    expect(
      isNeverCached({
        pathname: `${ROUTES.resetPassword}/lo-que-sea`,
        sameOrigin: true,
      }),
    ).toBe(true);
  });

  it("deja pasar el resto de la app", () => {
    // La regla va DELANTE de `defaultCache`, así que una que casara de más
    // apagaría la caché de páginas entera y con ella la consulta sin conexión.
    for (const pathname of [ROUTES.home, ROUTES.login, ROUTES.projects]) {
      expect(isNeverCached({ pathname, sameOrigin: true }), pathname).toBe(
        false,
      );
    }
  });

  /**
   * La regla del ADR 0006. `defaultCache` atrapa TODO GET de nuestro origen
   * bajo `/api/` con `NetworkFirst` y diez segundos de espera, así que sin esto
   * una red lenta serviría el árbol de ayer y `useOffline()` no lo vería: la
   * pantalla enseñaría algo que el motor no tiene, con el editor desbloqueado.
   */
  it("no guarda NINGUNA respuesta de la API", () => {
    for (const pathname of [
      API_MOUNT,
      DATA_ROUTES.projects,
      `${DATA_ROUTES.projects}/overviews`,
      `${DATA_ROUTES.nodes}/count`,
      `${DATA_ROUTES.versions}/una-version/clone`,
      DATA_ROUTES.analyses,
      ROUTES.authApi,
    ]) {
      expect(isNeverCached({ pathname, sameOrigin: true }), pathname).toBe(true);
    }
  });

  it("una ruta de API futura nace fuera de la caché", () => {
    // Va el punto de montaje entero y no las cuatro rutas de datos, así que
    // esto se cumple sin que nadie tenga que acordarse de apuntarla.
    expect(
      isNeverCached({ pathname: "/api/lo-que-venga", sameOrigin: true }),
    ).toBe(true);
  });

  it("no confunde una página que empieza igual con la API", () => {
    // `isSameOrUnder` compara por SEGMENTO: sin eso, un `/apilado` cualquiera
    // se quedaría sin caché sin que nadie entendiera por qué.
    expect(isNeverCached({ pathname: "/apilado", sameOrigin: true })).toBe(false);
  });

  it("no opina sobre lo que no es nuestro", () => {
    // Otro sitio puede tener su propio `/reset-password`, y no es asunto
    // nuestro: lo de fuera del origen tiene su regla en `defaultCache`.
    expect(
      isNeverCached({ pathname: ROUTES.resetPassword, sameOrigin: false }),
    ).toBe(false);
  });
});
