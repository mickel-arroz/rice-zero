import { describe, expect, it } from "vitest";

import {
  ANALYSIS_ERROR_KINDS,
  AnalysisConfigError,
  AnalysisError,
  AnalysisNetworkError,
  AnalysisTimeoutError,
  describeAnalysisFailure,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
  RemoteAnalysisError,
  SessionRequiredError,
} from "@/lib/ai/errors";

/** Una de cada, para recorrer la taxonomía entera sin enumerarla dos veces. */
const ONE_OF_EACH: AnalysisError[] = [
  new QuotaExceededError(30),
  new AnalysisTimeoutError(),
  new AnalysisNetworkError(),
  new MalformedAnalysisError(["tickets.0.checks: demasiado corto"]),
  new AnalysisConfigError("Falta algo.", "GEMINI_API_KEY"),
  new SessionRequiredError(),
  new InvalidAnalysisInputError("Esta Versión no tiene nada escrito."),
];

describe("la taxonomía del Proveedor de IA", () => {
  it("toda categoría de la lista tiene una clase, y al revés", () => {
    expect(ONE_OF_EACH.map((error) => error.kind).sort()).toEqual(
      [...ANALYSIS_ERROR_KINDS].sort(),
    );
  });

  it("todas cuelgan de la raíz común, para poder cazarlas de una", () => {
    for (const error of ONE_OF_EACH) {
      expect(error).toBeInstanceOf(AnalysisError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  /** `error.name` sale de `new.target`, así que un log dice qué clase fue. */
  it("cada una se nombra por su clase", () => {
    expect(new QuotaExceededError().name).toBe("QuotaExceededError");
    expect(new SessionRequiredError().name).toBe("SessionRequiredError");
  });

  it("todas traen un mensaje en español, listo para enseñar", () => {
    for (const error of ONE_OF_EACH) {
      expect(error.message.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * Lo que decide si la interfaz ofrece «Reintentar». Se afirma entero y no
   * caso por caso: es la única forma de que añadir una categoría más sin
   * pensar en esto rompa un test.
   */
  it("reintentar solo tiene sentido donde puede cambiar algo", () => {
    const retryable = ONE_OF_EACH.filter((e) => e.retryable).map((e) => e.kind);
    expect(retryable.sort()).toEqual(["malformada", "red", "timeout"]);
  });

  it("la causa se conserva: el detalle del SDK no se pierde", () => {
    const cause = new Error("del SDK");
    expect(new AnalysisNetworkError(undefined, { cause }).cause).toBe(cause);
  });
});

describe("describeAnalysisFailure", () => {
  it("conserva categoría, mensaje y si se puede reintentar", () => {
    const failure = describeAnalysisFailure(new AnalysisTimeoutError());
    expect(failure.kind).toBe("timeout");
    expect(failure.retryable).toBe(true);
    expect(failure.message).toContain("tardó");
  });

  it("se lleva el plazo de la cuota", () => {
    expect(describeAnalysisFailure(new QuotaExceededError(26)).retryAfterSeconds).toBe(26);
  });

  it("y los issues de una respuesta malformada", () => {
    const failure = describeAnalysisFailure(
      new MalformedAnalysisError(["tickets: hay un ciclo"]),
    );
    expect(failure.issues).toEqual(["tickets: hay un ciclo"]);
  });

  it("los campos que no son de esa categoría llegan vacíos, no ausentes", () => {
    const failure = describeAnalysisFailure(new AnalysisNetworkError());
    expect(failure.retryAfterSeconds).toBeNull();
    expect(failure.issues).toEqual([]);
  });

  /**
   * El volcado de una excepción del SDK no es un mensaje para una persona, y
   * puede llevar dentro trozos de la petición.
   */
  it("un error de fuera de la taxonomía sale como red, sin copiar su mensaje", () => {
    const failure = describeAnalysisFailure(new Error("TypeError: foo.bar of undefined"));
    expect(failure.kind).toBe("red");
    expect(failure.message).not.toContain("TypeError");
    expect(failure.retryable).toBe(true);
  });

  it("y lo que ni siquiera es un Error, también", () => {
    expect(describeAnalysisFailure("vaya").kind).toBe("red");
    expect(describeAnalysisFailure(undefined).kind).toBe("red");
  });

  /** Sale de un Server Action, así que tiene que sobrevivir a `JSON`. */
  it("lo que devuelve es serializable de verdad", () => {
    for (const error of ONE_OF_EACH) {
      const failure = describeAnalysisFailure(error);
      expect(JSON.parse(JSON.stringify(failure))).toEqual(failure);
    }
  });
});

describe("RemoteAnalysisError", () => {
  it("devuelve al otro lado de la frontera lo que decide la interfaz", () => {
    const original = new QuotaExceededError(26);
    const restored = new RemoteAnalysisError(describeAnalysisFailure(original));

    expect(restored.kind).toBe(original.kind);
    expect(restored.retryable).toBe(original.retryable);
    expect(restored.message).toBe(original.message);
    expect(restored.retryAfterSeconds).toBe(26);
  });

  it("es un AnalysisError, así que un catch de la raíz lo caza", () => {
    const restored = new RemoteAnalysisError(
      describeAnalysisFailure(new SessionRequiredError()),
    );
    expect(restored).toBeInstanceOf(AnalysisError);
  });

  /**
   * Y dice de dónde viene en vez de fingir ser la clase de allí. Un
   * `QuotaExceededError` reconstruido a mano llevaría la `cause` y la `key`
   * vacías sin avisar a nadie.
   */
  it("no finge ser la clase original", () => {
    const restored = new RemoteAnalysisError(
      describeAnalysisFailure(new QuotaExceededError(26)),
    );
    expect(restored).not.toBeInstanceOf(QuotaExceededError);
    expect(restored.name).toBe("RemoteAnalysisError");
  });

  /**
   * El viaje entero, que es el que hace de verdad un Análisis que falla.
   *
   * La frontera del Server Action se cruza UNA vez, pero el error se describe
   * DOS: el action lo serializa, el servicio lo vuelve a lanzar como
   * `RemoteAnalysisError`, y quien lo atrapa —el panel— lo describe otra vez
   * para guardárselo. Si la segunda descripción no sabe leer la primera, los
   * campos que solo llevan algunas categorías se pierden por el camino sin que
   * nada falle: la cuenta atrás del 429 quedaría a nulo y el panel dejaría de
   * poder ofrecer el reintento que el ticket exige.
   */
  it("describirlo otra vez no pierde nada por el camino", () => {
    const original = new QuotaExceededError(38);
    const once = describeAnalysisFailure(original);
    const twice = describeAnalysisFailure(new RemoteAnalysisError(once));

    expect(twice).toEqual(once);
  });

  it("y tampoco pierde qué regla del schema se incumplió", () => {
    const original = new MalformedAnalysisError(["tickets: no puede estar vacío"]);
    const once = describeAnalysisFailure(original);
    const twice = describeAnalysisFailure(new RemoteAnalysisError(once));

    expect(twice.issues).toEqual(["tickets: no puede estar vacío"]);
    expect(twice).toEqual(once);
  });
});
