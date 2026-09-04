import { describe, expect, it } from "vitest";

import { clearPrivateCaches, isOfflineDocument } from "@/lib/pwa/cache";

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
