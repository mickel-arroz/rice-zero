/**
 * La traducción de errores del motor a la taxonomía del puerto.
 *
 * Se testea aparte de la contract suite porque es donde se decide qué ve el
 * usuario cuando algo va mal, y varias de esas decisiones son deliberadas y no
 * evidentes: una denegación por RLS es «no existe», y un código desconocido no
 * es reintentable.
 */

import { describe, expect, it } from "vitest";

import {
  translatePostgrestFailure,
  translateThrown,
} from "@/lib/backend/adapters/postgrest/errors";
import {
  ConflictError,
  NetworkError,
  NotFoundError,
  UnauthenticatedError,
} from "@/lib/backend/ports";

const RECURSO = "el Proyecto";
const ID = "11111111-1111-4111-8111-111111111111";

function translate(failure: { message: string; code?: string | null }) {
  return translatePostgrestFailure(failure, RECURSO, ID);
}

describe("translatePostgrestFailure", () => {
  it("no_data_found es NotFoundError: lo lanza la RPC de clonado", () => {
    expect(translate({ code: "P0002", message: "La Versión no existe." })).toBeInstanceOf(
      NotFoundError,
    );
  });

  it("una denegación por RLS es NotFoundError, no un error de permisos", () => {
    // Bajo RLS «no es tuyo» y «no existe» son cero filas, y distinguirlas
    // confirmaría que el recurso existe.
    const error = translate({
      code: "42501",
      message: 'new row violates row-level security policy for table "projects"',
    });

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("un GRANT que falta NO se disfraza de NotFoundError", () => {
    // Es el caso que hace ruido a propósito: un despliegue mal configurado
    // contestaría «no existe» a todo y el síntoma sería una app vacía.
    const error = translate({
      code: "42501",
      message: 'permission denied for table "projects"',
    });

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect(error).not.toBeInstanceOf(NotFoundError);
  });

  it("un JWT caducado es falta de sesión", () => {
    expect(translate({ code: "PGRST301", message: "JWT expired" })).toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("una violación de unique es un conflicto, y nombra la regla", () => {
    const error = translate({ code: "23505", message: "duplicate key value" });

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).rule).toBe("unique");
  });

  it("un padre en otra Versión es un conflicto de referencia", () => {
    const error = translate({
      code: "23503",
      message: "El Nodo y su padre deben estar en la misma Versión.",
    });

    expect((error as ConflictError).rule).toBe("referencia");
  });

  it("sin código es un fallo de transporte, y ése sí se reintenta", () => {
    expect(translate({ message: "502 Bad Gateway" })).toBeInstanceOf(NetworkError);
  });

  it("un código que no conocemos NO es reintentable", () => {
    // `22P02` es un uuid mal formado. Reintentarlo en bucle es peor que un
    // error a la cara.
    const error = translate({ code: "22P02", message: "invalid input syntax for type uuid" });

    expect(error).not.toBeInstanceOf(NetworkError);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).rule).toBe("motor:22P02");
  });

  it("conserva el fallo original en `cause` para poder diagnosticar", () => {
    const failure = { code: "23505", message: "duplicate key value" };

    expect(translate(failure).cause).toBe(failure);
  });

  it("nombra el recurso en términos de dominio, no de tabla", () => {
    expect(translate({ code: "P0002", message: "x" }).message).toContain("el Proyecto");
  });
});

describe("translateThrown", () => {
  it("una petición cancelada es un fallo de red", () => {
    const aborted = new Error("The operation was aborted.");
    aborted.name = "AbortError";

    expect(translateThrown(aborted)).toBeInstanceOf(NetworkError);
  });

  it("envuelve lo que no es un Error sin perderlo", () => {
    const error = translateThrown("algo raro");

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.cause).toBe("algo raro");
  });
});
