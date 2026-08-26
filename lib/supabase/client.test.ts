import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV_KEYS } from "@/lib/constants";

const createBrowserClient = vi.fn((...args: unknown[]) => {
  void args;
  return { marca: "cliente-navegador" };
});

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClient(...args),
}));

beforeEach(() => {
  vi.stubEnv(ENV_KEYS.supabaseUrl, "https://abc.supabase.co");
  vi.stubEnv(ENV_KEYS.supabasePublishableKey, "sb_publishable_xyz");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getSupabaseBrowserClient", () => {
  it("construye el cliente con las credenciales del entorno", async () => {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");

    getSupabaseBrowserClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "sb_publishable_xyz",
    );
  });

  it("reutiliza el mismo cliente en toda la pestaña", async () => {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");

    const primero = getSupabaseBrowserClient();
    const segundo = getSupabaseBrowserClient();

    expect(segundo).toBe(primero);
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });

  it("falla si falta una credencial en lugar de construir un cliente roto", async () => {
    vi.stubEnv(ENV_KEYS.supabaseUrl, "");
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");

    expect(() => getSupabaseBrowserClient()).toThrow(ENV_KEYS.supabaseUrl);
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
