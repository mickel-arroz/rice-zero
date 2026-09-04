import { describe, expect, it } from "vitest";

import {
  isPublicPath,
  loginRedirectFor,
  safeNextPath,
} from "@/lib/auth/routes";
import { ROUTES } from "@/lib/constants";

describe("isPublicPath", () => {
  it("deja pasar las páginas públicas", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/about")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
  });

  it("deja pasar la ruta de auth y sus subrutas", () => {
    expect(isPublicPath("/api/auth")).toBe(true);
    expect(isPublicPath("/api/auth/sign-in/email")).toBe(true);
  });

  it("deja pasar las rutas que la PWA necesita sin sesión", () => {
    // Las tres las pide el NAVEGADOR, no una persona con sesión, y las tres
    // fallan en silencio si el proxy las gatea: se recibe el HTML del login
    // donde se esperaba JavaScript o un manifest. Ninguna pantalla lo delata,
    // así que este test es el único aviso.
    expect(isPublicPath(ROUTES.serwist)).toBe(true);
    expect(isPublicPath(`${ROUTES.serwist}/sw.js`)).toBe(true);
    expect(isPublicPath(ROUTES.offline)).toBe(true);
    // El manifest va aparte porque es el que se olvida: no parece una ruta, y
    // el matcher de `proxy.ts` salva `woff2|png|svg|ico` por extensión pero no
    // `.webmanifest`. Se colaba de verdad hasta que un 307 lo delató.
    expect(isPublicPath(ROUTES.manifest)).toBe(true);
  });

  it("protege el resto", () => {
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/projects/abc/versions/1")).toBe(false);
    expect(isPublicPath("/cualquier-cosa")).toBe(false);
  });

  it("no confunde un prefijo con un segmento", () => {
    // `/aboutus` NO es `/about`: sin esta comprobación, cualquier ruta que
    // empezara igual que una pública se colaría sin sesión.
    expect(isPublicPath("/aboutus")).toBe(false);
    expect(isPublicPath("/logins")).toBe(false);
  });

  it("es indiferente a la barra final", () => {
    expect(isPublicPath("/about/")).toBe(true);
    expect(isPublicPath("/projects/")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("acepta una ruta interna", () => {
    expect(safeNextPath("/projects")).toBe("/projects");
    expect(safeNextPath("/projects/abc?tab=canvas")).toBe(
      "/projects/abc?tab=canvas",
    );
  });

  it("rechaza un destino externo", () => {
    // Un `next` sin filtrar convierte el login en un redirector abierto: basta
    // un enlace a /login?next=https://phishing.example para que la app mande al
    // usuario fuera después de autenticarse.
    expect(safeNextPath("https://phishing.example")).toBe(null);
    expect(safeNextPath("//phishing.example")).toBe(null);
    expect(safeNextPath("http:/\\phishing.example")).toBe(null);
  });

  it("rechaza lo que no es una ruta absoluta del sitio", () => {
    expect(safeNextPath("projects")).toBe(null);
    expect(safeNextPath("")).toBe(null);
    expect(safeNextPath(null)).toBe(null);
    expect(safeNextPath(undefined)).toBe(null);
  });

  it("rechaza volver a una ruta pública", () => {
    // Volver al login después de entrar es un bucle; volver a la landing es
    // perder el sitio al que el usuario iba.
    expect(safeNextPath(ROUTES.login)).toBe(null);
    expect(safeNextPath("/")).toBe(null);
  });
});

describe("loginRedirectFor", () => {
  it("cuelga del login la ruta que se pedía", () => {
    const url = loginRedirectFor(
      "/projects/abc",
      "https://rice.example/projects/abc",
    );
    expect(url.pathname).toBe(ROUTES.login);
    expect(url.searchParams.get("next")).toBe("/projects/abc");
    expect(url.origin).toBe("https://rice.example");
  });

  it("no cuelga nada cuando el destino no es recuperable", () => {
    const url = loginRedirectFor("/", "https://rice.example/");
    expect(url.searchParams.has("next")).toBe(false);
  });
});
