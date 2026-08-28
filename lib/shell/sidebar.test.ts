import { describe, expect, it } from "vitest";

import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
  isSidebarCollapsed,
  sidebarCookieAssignment,
} from "@/lib/shell/sidebar";

describe("isSidebarCollapsed", () => {
  it("lee el valor colapsado", () => {
    expect(isSidebarCollapsed("collapsed")).toBe(true);
  });

  it("lee el valor expandido", () => {
    expect(isSidebarCollapsed("expanded")).toBe(false);
  });

  it("sin cookie, la sidebar nace expandida", () => {
    // Es la primera visita: enseñar los destinos con su nombre importa más que
    // ahorrar 184 px a quien todavía no sabe qué hay dentro.
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed(null)).toBe(false);
    expect(isSidebarCollapsed("")).toBe(false);
  });

  it("cualquier otra cosa cuenta como expandida", () => {
    // La cookie es de primera parte pero editable por quien quiera: un valor
    // que no reconocemos no puede dejar la sidebar en un tercer estado.
    expect(isSidebarCollapsed("COLLAPSED")).toBe(false);
    expect(isSidebarCollapsed("true")).toBe(false);
    expect(isSidebarCollapsed("1")).toBe(false);
  });
});

describe("sidebarCookieAssignment", () => {
  it("escribe el estado en la raíz del sitio", () => {
    const assignment = sidebarCookieAssignment(true);
    expect(assignment).toContain(`${SIDEBAR_COOKIE}=collapsed`);
    expect(assignment).toContain("path=/");
  });

  it("dura un año y no viaja a terceros", () => {
    const assignment = sidebarCookieAssignment(false);
    expect(assignment).toContain(`${SIDEBAR_COOKIE}=expanded`);
    expect(assignment).toContain(`max-age=${SIDEBAR_COOKIE_MAX_AGE}`);
    expect(assignment).toContain("samesite=lax");
  });

  it("ida y vuelta: lo que escribe es lo que lee", () => {
    for (const collapsed of [true, false]) {
      const value = sidebarCookieAssignment(collapsed).split(";")[0].split("=")[1];
      expect(isSidebarCollapsed(value)).toBe(collapsed);
    }
  });
});
