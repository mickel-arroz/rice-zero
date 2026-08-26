import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV_KEYS } from "@/lib/constants";
import type { CookieToSet } from "@/lib/supabase/server";

const createServerClient = vi.fn((...args: unknown[]) => {
  void args;
  return { marca: "cliente-servidor" };
});
const cookies = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookies(),
}));

/** El mínimo de `ReadonlyRequestCookies` que el cliente de servidor toca. */
function fakeCookieStore(initial: { name: string; value: string }[] = []) {
  const store = [...initial];
  return {
    store,
    getAll: () => store,
    set: vi.fn((name: string, value: string) => {
      store.push({ name, value });
    }),
  };
}

/** Las opciones de cookies con las que se llamó a `createServerClient`. */
function cookieMethods() {
  const [, , options] = createServerClient.mock.calls[0] as unknown as [
    string,
    string,
    { cookies: { getAll: () => unknown; setAll: (c: CookieToSet[], h: Record<string, string>) => void } },
  ];
  return options.cookies;
}

beforeEach(() => {
  vi.stubEnv(ENV_KEYS.supabaseUrl, "https://abc.supabase.co");
  vi.stubEnv(ENV_KEYS.supabasePublishableKey, "sb_publishable_xyz");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("createSupabaseServerClient", () => {
  it("construye el cliente con las credenciales del entorno", async () => {
    cookies.mockResolvedValue(fakeCookieStore());
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await createSupabaseServerClient();

    expect(createServerClient).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "sb_publishable_xyz",
      expect.anything(),
    );
  });

  it("falla si falta una credencial en lugar de construir un cliente roto", async () => {
    vi.stubEnv(ENV_KEYS.supabasePublishableKey, "");
    cookies.mockResolvedValue(fakeCookieStore());
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await expect(createSupabaseServerClient()).rejects.toThrow(
      ENV_KEYS.supabasePublishableKey,
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("crea un cliente nuevo por petición, nunca uno compartido", async () => {
    cookies.mockResolvedValue(fakeCookieStore());
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await createSupabaseServerClient();
    await createSupabaseServerClient();

    expect(createServerClient).toHaveBeenCalledTimes(2);
  });

  it("lee las cookies de la petición", async () => {
    const store = fakeCookieStore([{ name: "sb-token", value: "abc" }]);
    cookies.mockResolvedValue(store);
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await createSupabaseServerClient();

    expect(cookieMethods().getAll()).toEqual([{ name: "sb-token", value: "abc" }]);
  });

  it("escribe cada cookie refrescada en la petición", async () => {
    const store = fakeCookieStore();
    cookies.mockResolvedValue(store);
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await createSupabaseServerClient();
    cookieMethods().setAll(
      [
        { name: "sb-access", value: "a", options: { path: "/" } },
        { name: "sb-refresh", value: "r", options: { path: "/" } },
      ],
      {},
    );

    expect(store.set).toHaveBeenCalledTimes(2);
    expect(store.set).toHaveBeenCalledWith("sb-access", "a", { path: "/" });
    expect(store.set).toHaveBeenCalledWith("sb-refresh", "r", { path: "/" });
  });

  it("no revienta el render cuando un Server Component no puede escribir cookies", async () => {
    const store = fakeCookieStore();
    store.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action");
    });
    cookies.mockResolvedValue(store);
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await createSupabaseServerClient();

    expect(() =>
      cookieMethods().setAll([{ name: "sb-access", value: "a", options: {} }], {}),
    ).not.toThrow();
  });
});
