import { describe, expect, it } from "vitest";

import {
  ConflictError,
  MissingEnvError,
  NetworkError,
  NotFoundError,
  UnauthenticatedError,
} from "@/lib/backend/ports";
import {
  decodeBackendError,
  decodeJson,
  encodeBackendError,
  encodeJson,
  OPAQUE_FAILURE,
  statusForWireError,
} from "@/lib/backend/wire";

/** Ida y vuelta, que es la única forma honesta de probar un códec. */
function roundTrip(value: unknown): unknown {
  return decodeJson(encodeJson(value));
}

describe("las fechas cruzan el cable", () => {
  it("una fecha vuelve siendo una fecha", () => {
    const when = new Date("2026-09-10T12:34:56.000Z");
    expect(roundTrip({ createdAt: when })).toEqual({ createdAt: when });
  });

  it("una entidad entera conserva sus tres fechas", () => {
    const project = {
      id: "p1",
      ownerId: "u1",
      title: "Tienda",
      description: null,
      icon: "bag",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-03-03T00:00:00.000Z"),
    };
    expect(roundTrip(project)).toEqual(project);
  });

  it("las fechas dentro de un array también", () => {
    const versions = [{ createdAt: new Date(0) }, { createdAt: new Date(1e12) }];
    expect(roundTrip(versions)).toEqual(versions);
  });

  /**
   * La razón de encajonar en vez de revivir por patrón. Un Ticket puede
   * mencionar una fecha en su texto, y ese texto tiene que llegar como texto.
   */
  it("una cadena con pinta de fecha NO se convierte en fecha", () => {
    const analysis = {
      content: { spec: { problem: "Migrar antes de 2026-09-10T00:00:00.000Z" } },
    };
    const back = roundTrip(analysis) as typeof analysis;
    expect(typeof back.content.spec.problem).toBe("string");
    expect(back).toEqual(analysis);
  });

  it("una clave que se llama $date pero no es una caja sobrevive intacta", () => {
    const impostor = { $date: "no soy una caja", otra: 1 };
    expect(roundTrip({ impostor })).toEqual({ impostor });
  });

  it("una fecha inválida sale como null en vez de reventar la respuesta", () => {
    expect(roundTrip({ updatedAt: new Date("no es una fecha") })).toEqual({
      updatedAt: null,
    });
  });

  it("null y undefined se comportan como en JSON de siempre", () => {
    expect(roundTrip({ a: null, b: undefined })).toEqual({ a: null });
  });
});

describe("la taxonomía cruza el cable", () => {
  it("NotFoundError conserva recurso, id y frase", () => {
    const back = decodeBackendError(
      encodeBackendError(new NotFoundError("Proyecto", "p1")),
    );
    expect(back).toBeInstanceOf(NotFoundError);
    expect((back as NotFoundError).resource).toBe("Proyecto");
    expect((back as NotFoundError).id).toBe("p1");
    expect(back.message).toBe("No se encontró Proyecto p1, o no es tuyo.");
  });

  it("un NotFoundError sin id sigue sin tenerlo al llegar", () => {
    const back = decodeBackendError(encodeBackendError(new NotFoundError("Nodo")));
    expect((back as NotFoundError).id).toBeNull();
  });

  /**
   * La que de verdad importa: la pantalla lee `rule` para decidir, y el texto
   * es el que la interfaz enseña. Si cualquiera de los dos se perdiera, el
   * diálogo de borrado diría otra cosa que el rechazo del servicio.
   */
  it("ConflictError conserva la regla Y la frase", () => {
    const original = new ConflictError(
      "ultima-version",
      "Un Proyecto no puede quedarse sin Versiones. Clona ésta antes de borrarla.",
    );
    const back = decodeBackendError(encodeBackendError(original));
    expect(back).toBeInstanceOf(ConflictError);
    expect((back as ConflictError).rule).toBe("ultima-version");
    expect(back.message).toBe(original.message);
  });

  it("UnauthenticatedError llega como tal", () => {
    const back = decodeBackendError(
      encodeBackendError(new UnauthenticatedError()),
    );
    expect(back).toBeInstanceOf(UnauthenticatedError);
  });

  it("MissingEnvError conserva la clave y el hint", () => {
    const original = new MissingEnvError("NEON_DATA_API_URL", "Ejecuta el wizard.");
    const back = decodeBackendError(encodeBackendError(original));
    expect(back).toBeInstanceOf(MissingEnvError);
    expect((back as MissingEnvError).key).toBe("NEON_DATA_API_URL");
    expect(back.message).toBe(original.message);
  });

  it("NetworkError llega como tal", () => {
    const back = decodeBackendError(encodeBackendError(new NetworkError()));
    expect(back).toBeInstanceOf(NetworkError);
  });

  /**
   * Un error que no es del puerto no cuenta nada de sí mismo: podría llevar
   * dentro una columna, un fragmento de SQL o el texto de un Nodo.
   */
  it("un error cualquiera se opaca antes de salir", () => {
    const wire = encodeBackendError(
      new Error('column "owner_id" does not exist en el Nodo «mi secreto»'),
    );
    expect(wire.kind).toBe("unknown");
    expect(wire.message).toBe(OPAQUE_FAILURE);
    expect(JSON.stringify(wire)).not.toContain("owner_id");
    expect(JSON.stringify(wire)).not.toContain("mi secreto");
  });
});

describe("lo que llega roto", () => {
  it("un sobre ilegible es un fallo de red, que es el único reintentable", () => {
    expect(decodeBackendError(undefined)).toBeInstanceOf(NetworkError);
    expect(decodeBackendError("<!doctype html>")).toBeInstanceOf(NetworkError);
    expect(decodeBackendError({ sin: "kind" })).toBeInstanceOf(NetworkError);
  });

  it("un kind que este cliente no conoce todavía tampoco lo tumba", () => {
    const back = decodeBackendError({ kind: "del-futuro", message: "algo" });
    expect(back).toBeInstanceOf(NetworkError);
    expect(back.message).toBe("algo");
  });

  it("un not_found sin campos se reconstruye sin inventarse un id", () => {
    const back = decodeBackendError({ kind: "not_found" });
    expect(back).toBeInstanceOf(NotFoundError);
    expect((back as NotFoundError).id).toBeNull();
  });
});

describe("el status es para los humanos, el kind para el código", () => {
  it("cada categoría tiene el suyo", () => {
    const status = (error: unknown) =>
      statusForWireError(encodeBackendError(error));
    expect(status(new NotFoundError("Proyecto"))).toBe(404);
    expect(status(new ConflictError("regla", "no"))).toBe(409);
    expect(status(new UnauthenticatedError())).toBe(401);
    expect(status(new NetworkError())).toBe(502);
    expect(status(new MissingEnvError("X"))).toBe(500);
    expect(status(new Error("cualquiera"))).toBe(500);
  });

  /**
   * Consecuencia del ADR 0001 sostenida a mano en esta capa: bajo RLS «no es
   * tuyo» y «no existe» son cero filas. Un 403 aquí le confirmaría a un
   * atacante que el recurso existe, y reabriría el oráculo que el motor cierra.
   */
  it("una denegación por RLS sale como 404 y nunca como 403", () => {
    expect(statusForWireError(encodeBackendError(new NotFoundError("Nodo", "n1")))).toBe(404);
  });
});
