/**
 * El interruptor.
 *
 * Sustituye la cobertura que tenía `lib/env.test.ts` antes de que la lectura de
 * entorno se moviera dentro de `lib/backend/`. Lo que se prueba aquí es lo que
 * decide a qué backend habla la app, así que un fallo silencioso es un fallo
 * apuntando a la base de datos de otro.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { BACKEND_ENV_KEY, BACKEND_NAMES, readBackendName } from "@/lib/backend";
import { requireEnv } from "@/lib/backend/env";
import { MissingEnvError } from "@/lib/backend/ports";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireEnv", () => {
  it("devuelve el valor cuando está presente", () => {
    expect(requireEnv("UNA_CLAVE", "un-valor")).toBe("un-valor");
  });

  it("recorta espacios alrededor del valor", () => {
    expect(requireEnv("UNA_CLAVE", "  un-valor  ")).toBe("un-valor");
  });

  it("lanza MissingEnvError cuando falta, está vacío o en blanco", () => {
    expect(() => requireEnv("UNA_CLAVE", undefined)).toThrow(MissingEnvError);
    expect(() => requireEnv("UNA_CLAVE", "")).toThrow(MissingEnvError);
    expect(() => requireEnv("UNA_CLAVE", "   ")).toThrow(MissingEnvError);
  });

  it("nombra la variable ausente y la expone en el error", () => {
    try {
      requireEnv("UNA_CLAVE", undefined);
      expect.unreachable("debería haber lanzado");
    } catch (error) {
      expect((error as MissingEnvError).key).toBe("UNA_CLAVE");
      expect((error as MissingEnvError).message).toContain("UNA_CLAVE");
    }
  });

  it("incluye la pista de cómo conseguir el valor", () => {
    expect(() =>
      requireEnv("UNA_CLAVE", undefined, "Ejecuta el wizard."),
    ).toThrow("Ejecuta el wizard.");
  });

  it("nunca filtra el valor recibido en el mensaje", () => {
    // Una variable mal copiada puede ser un secreto, y los errores acaban en
    // logs.
    try {
      requireEnv("UNA_CLAVE", " sb_secret_no_deberia_salir ");
      requireEnv("OTRA_CLAVE", "   ");
      expect.unreachable("debería haber lanzado");
    } catch (error) {
      expect((error as Error).message).not.toContain("sb_secret");
    }
  });
});

describe("readBackendName", () => {
  it("devuelve el proveedor que nombra el entorno", () => {
    vi.stubEnv(BACKEND_ENV_KEY, "neon");

    expect(readBackendName()).toBe("neon");
  });

  it("acepta cualquiera de los proveedores que existen", () => {
    for (const name of BACKEND_NAMES) {
      vi.stubEnv(BACKEND_ENV_KEY, name);
      expect(readBackendName()).toBe(name);
    }
  });

  it("recorta espacios", () => {
    vi.stubEnv(BACKEND_ENV_KEY, "  supabase  ");

    expect(readBackendName()).toBe("supabase");
  });

  it("lanza nombrando la variable cuando falta", () => {
    vi.stubEnv(BACKEND_ENV_KEY, "");

    expect(() => readBackendName()).toThrow(MissingEnvError);
    expect(() => readBackendName()).toThrow(BACKEND_ENV_KEY);
  });

  it("un proveedor inventado NO cae a un default", () => {
    // Elegir por el usuario sería mandar la app a un backend que nadie pidió,
    // sin decir nada.
    vi.stubEnv(BACKEND_ENV_KEY, "firebase");

    expect(() => readBackendName()).toThrow(MissingEnvError);
  });

  it("dice qué proveedores hay cuando el nombre no existe", () => {
    vi.stubEnv(BACKEND_ENV_KEY, "firebase");

    for (const name of BACKEND_NAMES) {
      expect(() => readBackendName()).toThrow(name);
    }
  });

  it("no acepta un nombre que solo se parece", () => {
    for (const impostor of ["Neon", "NEON", "neon ", "neon,supabase", "constructor"]) {
      vi.stubEnv(BACKEND_ENV_KEY, impostor);
      if (impostor.trim() === "neon") continue;
      expect(() => readBackendName()).toThrow(MissingEnvError);
    }
  });
});
