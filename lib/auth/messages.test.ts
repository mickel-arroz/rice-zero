import { describe, expect, it } from "vitest";

import { describeAuthFailure } from "@/lib/auth/messages";
import {
  ConflictError,
  MissingEnvError,
  NetworkError,
  UnauthenticatedError,
} from "@/lib/backend/ports";

describe("describeAuthFailure", () => {
  it("solo marca reintentable el fallo de red", () => {
    // Es la única categoría del puerto que se arregla repitiendo la llamada.
    expect(describeAuthFailure(new NetworkError(), "signIn").retryable).toBe(
      true,
    );
    expect(
      describeAuthFailure(new UnauthenticatedError(), "signIn").retryable,
    ).toBe(false);
    expect(
      describeAuthFailure(new ConflictError("email-registrado", "x"), "signUp")
        .retryable,
    ).toBe(false);
    expect(
      describeAuthFailure(new MissingEnvError("X"), "signIn").retryable,
    ).toBe(false);
  });

  it("dice que el email ya tiene cuenta al registrarse", () => {
    const failure = describeAuthFailure(
      new ConflictError("email-registrado", "Ese email ya tiene cuenta."),
      "signUp",
    );
    expect(failure.title).toMatch(/ya tiene cuenta/i);
  });

  it("no distingue contraseña mala de email sin confirmar", () => {
    // Deliberado, y por el mismo argumento que NotFoundError en el puerto:
    // decir «esa cuenta existe pero está sin confirmar» le confirma a un
    // atacante que el email está registrado.
    const failure = describeAuthFailure(
      new UnauthenticatedError("Invalid password"),
      "signIn",
    );
    expect(failure.title).toMatch(/email o contrase/i);
    expect(failure.detail).toMatch(/confirma/i);
  });

  it("nunca deja escapar el mensaje del SDK", () => {
    // Los adaptadores propagan el texto del proveedor, que viene en inglés.
    const failure = describeAuthFailure(
      new UnauthenticatedError("Invalid email or password"),
      "signIn",
    );
    expect(failure.title).not.toContain("Invalid");
    expect(failure.detail).not.toContain("Invalid");
  });

  it("trata la configuración que falta como fallo de configuración", () => {
    const failure = describeAuthFailure(
      new MissingEnvError("NEON_AUTH_URL"),
      "signIn",
    );
    expect(failure.title).not.toMatch(/contrase/i);
    expect(failure.retryable).toBe(false);
  });

  it("tiene una respuesta para lo que no reconoce", () => {
    const failure = describeAuthFailure(new Error("boom"), "signIn");
    expect(failure.title.length).toBeGreaterThan(0);
    expect(failure.title).not.toContain("boom");
  });

  it("nunca cita al proveedor, en ninguna categoría", () => {
    // La garantía de verdad tras «los errores en español»: el texto que se
    // muestra lo escribe este módulo, así que da igual en qué idioma contesten
    // Better Auth o Supabase. Un centinela reconocible en cada categoría lo
    // demuestra mejor que adivinar el idioma con una expresión regular.
    const sentinel = "SENTINEL_FROM_PROVIDER";
    const errors = [
      new NetworkError(sentinel),
      new UnauthenticatedError(sentinel),
      new ConflictError("email-registrado", sentinel),
      new Error(sentinel),
    ];
    for (const action of ["signIn", "signUp"] as const) {
      for (const error of errors) {
        const { title, detail } = describeAuthFailure(error, action);
        expect(`${title} ${detail}`, `${error.name} / ${action}`).not.toContain(
          sentinel,
        );
        expect(title.length, `${error.name} / ${action}`).toBeGreaterThan(0);
        expect(detail.length, `${error.name} / ${action}`).toBeGreaterThan(0);
      }
    }
  });

  it("nombra la variable que falta cuando el fallo es de configuración", () => {
    // La única excepción a «no cites al proveedor»: aquí el dato interno ES la
    // información útil, y quien lo lee es quien despliega.
    const failure = describeAuthFailure(
      new MissingEnvError("NEON_AUTH_COOKIE_SECRET"),
      "signIn",
    );
    expect(failure.detail).toContain("NEON_AUTH_COOKIE_SECRET");
  });
});
