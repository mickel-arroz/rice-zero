import { describe, expect, it } from "vitest";

import {
  E2E_KEYS,
  E2E_SWITCH,
  baseUrl,
  credenciales,
  faltantes,
  objetivoDeHumo,
} from "@/e2e/apoyo/entorno";

/** Un entorno completo, del que cada caso quita justo lo que quiere probar. */
const COMPLETO = {
  E2E_LIVE: "1",
  E2E_EMAIL: "e2e@ejemplo.test",
  E2E_PASSWORD: "contraseña-larga",
  DATABASE_URL: "postgresql://owner:x@ep.neon.tech/neondb",
};

describe("faltantes", () => {
  it("las nombra todas cuando el entorno está vacío", () => {
    expect(faltantes({})).toEqual([...E2E_KEYS]);
  });

  it("no falta ninguna cuando están todas", () => {
    expect(faltantes(COMPLETO)).toEqual([]);
  });

  it("una variable en blanco cuenta como ausente", () => {
    expect(faltantes({ ...COMPLETO, E2E_EMAIL: "   " })).toEqual(["E2E_EMAIL"]);
  });

  /**
   * La decisión del módulo, y la misma que `requireLiveEnv` toma para la
   * corrida en vivo: unas credenciales sueltas NO bastan para empezar. La
   * semilla borra los Proyectos de la cuenta antes de cada corrida, y un
   * `.env.local` que tuviera el email por otro motivo no debe ser suficiente
   * para que eso ocurra.
   */
  it("las credenciales sin el interruptor no bastan", () => {
    const sinInterruptor = { ...COMPLETO, [E2E_SWITCH]: "" };
    expect(faltantes(sinInterruptor)).toEqual([E2E_SWITCH]);
  });
});

describe("credenciales", () => {
  it("devuelve el email y la contraseña, sin espacios alrededor", () => {
    expect(credenciales({ ...COMPLETO, E2E_EMAIL: " e2e@ejemplo.test " })).toEqual({
      email: "e2e@ejemplo.test",
      password: "contraseña-larga",
    });
  });

  it("lanza si el entorno no está completo", () => {
    expect(() => credenciales({})).toThrow(/E2E_LIVE/);
  });
});

describe("baseUrl", () => {
  /**
   * Las dos cosas se afirman a la vez porque las dos se rompieron a la vez:
   * `127.0.0.1` no es un origen que Managed Better Auth acepte, y el 3000 es el
   * de `next dev`. Ver `BASE_URL_POR_DEFECTO`.
   */
  it("usa localhost —no 127.0.0.1— y su propio puerto", () => {
    expect(baseUrl({})).toBe("http://localhost:3100");
  });

  it("respeta E2E_BASE_URL y le quita la barra final", () => {
    expect(baseUrl({ E2E_BASE_URL: "http://localhost:4000/" })).toBe(
      "http://localhost:4000",
    );
  });
});

describe("objetivoDeHumo", () => {
  it("es nulo cuando no se pide", () => {
    expect(objetivoDeHumo({})).toBeNull();
  });

  it("devuelve la URL sin la barra final", () => {
    expect(objetivoDeHumo({ SMOKE_URL: "https://rice-zero.vercel.app/" })).toBe(
      "https://rice-zero.vercel.app",
    );
  });

  /**
   * Un `SMOKE_URL` mal escrito NO puede saltarse el smoke en silencio: sería
   * el mismo verde vacío contra el que existe `requireLiveEnv`. Se rompe al
   * cargar la configuración, que es cuando alguien todavía está mirando.
   */
  it("lanza si no es una URL", () => {
    expect(() => objetivoDeHumo({ SMOKE_URL: "rice-zero.vercel.app" })).toThrow(
      /SMOKE_URL/,
    );
  });

  it("lanza si no habla http", () => {
    expect(() => objetivoDeHumo({ SMOKE_URL: "ftp://rice-zero.test" })).toThrow(
      /SMOKE_URL/,
    );
  });
});
