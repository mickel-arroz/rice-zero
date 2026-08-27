import { describe, expect, it } from "vitest";

import { mergeSetCookies } from "@/lib/backend/cookies";

const withCookie = (value: string) => new Headers({ cookie: value });

describe("mergeSetCookies", () => {
  it("devuelve las mismas cabeceras cuando no hay nada que sentar", () => {
    const merged = mergeSetCookies(withCookie("a=1"), []);
    expect(merged.get("cookie")).toBe("a=1");
  });

  it("añade una cookie nueva sin perder las que había", () => {
    const merged = mergeSetCookies(withCookie("a=1"), [
      "b=2; Path=/; HttpOnly",
    ]);
    expect(merged.get("cookie")).toBe("a=1; b=2");
  });

  it("sustituye el valor de una cookie que ya existía", () => {
    // Es el caso del refresco de sesión: la cookie nueva tiene que ganar, o el
    // render de esta misma petición seguiría leyendo el token viejo.
    const merged = mergeSetCookies(withCookie("a=1; s=viejo"), [
      "s=nuevo; Path=/",
    ]);
    expect(merged.get("cookie")).toBe("a=1; s=nuevo");
  });

  it("borra la cookie cuando el valor viene vacío", () => {
    // Así se expresa un borrado en un Set-Cookie, y de ello depende signOut.
    const merged = mergeSetCookies(withCookie("a=1; s=viejo"), [
      "s=; Max-Age=0; Path=/",
    ]);
    expect(merged.get("cookie")).toBe("a=1");
  });

  it("quita la cabecera entera si no queda ninguna cookie", () => {
    const merged = mergeSetCookies(withCookie("s=viejo"), ["s=; Max-Age=0"]);
    expect(merged.has("cookie")).toBe(false);
  });

  it("no muta las cabeceras que recibe", () => {
    const original = withCookie("a=1");
    mergeSetCookies(original, ["b=2"]);
    expect(original.get("cookie")).toBe("a=1");
  });

  it("conserva el resto de cabeceras", () => {
    const headers = new Headers({ cookie: "a=1", "x-algo": "sí" });
    expect(mergeSetCookies(headers, ["b=2"]).get("x-algo")).toBe("sí");
  });

  it("funciona sin cookie previa", () => {
    expect(mergeSetCookies(new Headers(), ["b=2; Path=/"]).get("cookie")).toBe(
      "b=2",
    );
  });

  it("ignora un Set-Cookie sin par nombre=valor", () => {
    const merged = mergeSetCookies(withCookie("a=1"), [
      "=roto",
      "; Path=/",
      "b=2",
    ]);
    expect(merged.get("cookie")).toBe("a=1; b=2");
  });

  it("admite un valor con signos igual dentro", () => {
    // Los JWT acaban en `=` de relleno: partir por el primer `=` y no por todos.
    const merged = mergeSetCookies(new Headers(), [
      "s=eyJhbG.eyJ1c2.abc==; Path=/",
    ]);
    expect(merged.get("cookie")).toBe("s=eyJhbG.eyJ1c2.abc==");
  });
});
