import { afterEach, describe, expect, it, vi } from "vitest";

import { ENV_KEYS } from "@/lib/constants";
import {
  MissingEnvError,
  readSupabasePublicEnv,
  requireEnv,
} from "@/lib/env";

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

  it("lanza MissingEnvError cuando falta", () => {
    expect(() => requireEnv("UNA_CLAVE", undefined)).toThrow(MissingEnvError);
  });

  it("lanza MissingEnvError cuando está vacío o en blanco", () => {
    expect(() => requireEnv("UNA_CLAVE", "")).toThrow(MissingEnvError);
    expect(() => requireEnv("UNA_CLAVE", "   ")).toThrow(MissingEnvError);
  });

  it("nombra la variable ausente en el mensaje", () => {
    expect(() => requireEnv("UNA_CLAVE", undefined)).toThrow(/UNA_CLAVE/);
  });

  it("expone el nombre de la variable ausente", () => {
    try {
      requireEnv("UNA_CLAVE", undefined);
      expect.unreachable("debería haber lanzado");
    } catch (error) {
      expect((error as MissingEnvError).key).toBe("UNA_CLAVE");
    }
  });

  it("nunca filtra el valor recibido en el mensaje", () => {
    expect(() => requireEnv("UNA_CLAVE", "   ")).not.toThrow(/   /);
  });
});

describe("readSupabasePublicEnv", () => {
  it("lee URL y clave publicable del entorno", () => {
    vi.stubEnv(ENV_KEYS.supabaseUrl, "https://abc.supabase.co");
    vi.stubEnv(ENV_KEYS.supabasePublishableKey, "sb_publishable_xyz");

    expect(readSupabasePublicEnv()).toEqual({
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_xyz",
    });
  });

  it("lanza nombrando la URL cuando falta", () => {
    vi.stubEnv(ENV_KEYS.supabaseUrl, "");
    vi.stubEnv(ENV_KEYS.supabasePublishableKey, "sb_publishable_xyz");

    expect(() => readSupabasePublicEnv()).toThrow(ENV_KEYS.supabaseUrl);
  });

  it("lanza nombrando la clave publicable cuando falta", () => {
    vi.stubEnv(ENV_KEYS.supabaseUrl, "https://abc.supabase.co");
    vi.stubEnv(ENV_KEYS.supabasePublishableKey, "");

    expect(() => readSupabasePublicEnv()).toThrow(
      ENV_KEYS.supabasePublishableKey,
    );
  });
});
