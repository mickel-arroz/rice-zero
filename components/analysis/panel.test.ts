import { describe, expect, it } from "vitest";

import { doorState, retryPlan } from "@/components/analysis/panel";
import {
  AnalysisConfigError,
  AnalysisNetworkError,
  AnalysisTimeoutError,
  describeAnalysisFailure,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
  SessionRequiredError,
} from "@/lib/ai";

/**
 * Los fallos se construyen con las clases de verdad y se pasan por
 * `describeAnalysisFailure`, que es el camino EXACTO que recorren hasta el
 * panel: el Server Action los serializa así. Un objeto literal a mano probaría
 * una forma que nadie produce, y dejaría pasar el día que `retryAfterSeconds`
 * deje de viajar.
 */
const failure = describeAnalysisFailure;

describe("Reintentar un Análisis: qué ofrece el panel", () => {
  it("sin red, se reintenta ya: es lo único que puede haber cambiado", () => {
    expect(retryPlan(failure(new AnalysisNetworkError()), 0)).toEqual({
      kind: "ahora",
    });
  });

  it("por timeout también: el árbol puede caber en el siguiente intento", () => {
    expect(retryPlan(failure(new AnalysisTimeoutError()), 0)).toEqual({
      kind: "ahora",
    });
  });

  it("una respuesta malformada se reintenta: el modelo no es determinista", () => {
    expect(retryPlan(failure(new MalformedAnalysisError(["tickets: vacío"])), 0)).toEqual({
      kind: "ahora",
    });
  });

  /**
   * El caso que reconcilia el ticket con la taxonomía.
   *
   * `QuotaExceededError.retryable` es `false` —«no ahora, y repetirlo no cambia
   * nada»— y el ticket pide un botón de reintento. Las dos cosas son ciertas a
   * la vez si el botón sabe CUÁNDO deja de ser inútil, y eso lo dice el propio
   * proveedor en `retryAfterSeconds`.
   */
  it("con la cuota agotada se espera lo que dijo el proveedor", () => {
    expect(retryPlan(failure(new QuotaExceededError(38)), 0)).toEqual({
      kind: "espera",
      seconds: 38,
    });
  });

  it("la espera se descuenta con el tiempo que ya pasó", () => {
    expect(retryPlan(failure(new QuotaExceededError(38)), 30)).toEqual({
      kind: "espera",
      seconds: 8,
    });
  });

  it("un segundo a medias cuenta entero: nunca se ofrece antes de tiempo", () => {
    // 38 − 30.4 = 7.6, y se enseñan 8. Redondear hacia abajo pondría el botón
    // vivo medio segundo antes de que el proveedor lo acepte, que es gastar
    // una llamada del free tier para que la rechacen.
    expect(retryPlan(failure(new QuotaExceededError(38)), 30.4)).toEqual({
      kind: "espera",
      seconds: 8,
    });
  });

  it("cumplida la espera, se puede reintentar", () => {
    expect(retryPlan(failure(new QuotaExceededError(38)), 38)).toEqual({
      kind: "ahora",
    });
  });

  it("y sigue pudiéndose mucho después", () => {
    expect(retryPlan(failure(new QuotaExceededError(38)), 600)).toEqual({
      kind: "ahora",
    });
  });

  it("si el proveedor no dijo cuánto esperar, se ofrece reintentar igual", () => {
    // Aquí manda el criterio de aceptación —«429 → toast + reintento»— por
    // encima de lo que se deduciría de `retryable: false`. Sin plazo no hay
    // cuenta atrás que enseñar, pero tampoco hay motivo para dejar a alguien
    // sin salida: el mensaje del error ya dice «vuelve a intentarlo más
    // tarde», y quien pulse antes de tiempo se lleva otro 429, no un daño.
    //
    // Importa sobre todo con la hoja CERRADA, que es el caso para el que
    // existe el aviso flotante: sin botón, la única forma de reintentar sería
    // abrir el panel a buscarlo.
    expect(retryPlan(failure(new QuotaExceededError(null)), 0)).toEqual({
      kind: "ahora",
    });
  });

  it("si falta configuración, reintentar no arregla nada", () => {
    expect(
      retryPlan(failure(new AnalysisConfigError("Falta la API key", "GOOGLE_API_KEY")), 0),
    ).toEqual({ kind: "nunca" });
  });

  it("sin sesión tampoco: lo que hay que hacer es entrar", () => {
    expect(retryPlan(failure(new SessionRequiredError()), 0)).toEqual({
      kind: "nunca",
    });
  });

  it("y si lo que se mandó no vale, lo que hay que cambiar es la entrada", () => {
    expect(
      retryPlan(failure(new InvalidAnalysisInputError("La Versión está vacía")), 0),
    ).toEqual({ kind: "nunca" });
  });
});

describe("La puerta del panel: qué dice el botón de la cabecera", () => {
  it("en reposo invita a analizar", () => {
    expect(doorState({ generating: false, unread: false })).toBe("analizar");
  });

  it("mientras genera lo dice, aunque la hoja esté cerrada", () => {
    // Es el único sitio donde se ve que hay algo en vuelo cuando se cerró la
    // hoja para seguir editando el árbol.
    expect(doorState({ generating: true, unread: false })).toBe("generando");
  });

  it("cuando llega con la hoja cerrada, la puerta se enciende", () => {
    expect(doorState({ generating: false, unread: true })).toBe("listo");
  });

  it("generar otra vez manda sobre un resultado sin leer", () => {
    // Si no, regenerar sin abrir la hoja dejaría el botón diciendo «listo»
    // sobre un Análisis que se está sustituyendo ahora mismo.
    expect(doorState({ generating: true, unread: true })).toBe("generando");
  });
});
