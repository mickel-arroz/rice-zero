import { describe, expect, it } from "vitest";

import { MIN_PASSWORD_LENGTH, validateCredentials } from "@/lib/auth/validate";

const ok = {
  email: "mickel@avilatek.dev",
  password: "contrasena-larga",
  confirm: "contrasena-larga",
};

describe("validateCredentials", () => {
  it("deja pasar unas credenciales completas, en los dos modos", () => {
    expect(validateCredentials(ok, "signIn")).toEqual({});
    expect(validateCredentials(ok, "signUp")).toEqual({});
  });

  it("pide el email cuando falta", () => {
    const { email } = validateCredentials({ ...ok, email: "" }, "signIn");
    expect(email).toBeTruthy();
  });

  it("pide la contraseña cuando falta", () => {
    const { password } = validateCredentials({ ...ok, password: "" }, "signIn");
    expect(password).toBeTruthy();
  });

  it("rechaza un email sin forma de email", () => {
    // El `type="email"` del input no cubre esto: el formulario se envía por
    // código, así que el navegador no valida nada.
    for (const email of [
      "mickel",
      "mickel@",
      "@avilatek.dev",
      "a b@c.dev",
      "a@b@c.dev",
    ]) {
      expect(
        validateCredentials({ ...ok, email }, "signIn").email,
        email,
      ).toBeTruthy();
    }
  });

  it("acepta un email sin punto en el dominio", () => {
    // Un dominio interno («root@localhost») es válido. Exigir un punto sería
    // inventarse una regla y bloquear a alguien que el backend aceptaría.
    expect(
      validateCredentials({ ...ok, email: "root@localhost" }, "signIn").email,
    ).toBeUndefined();
  });

  describe("longitud de la contraseña", () => {
    const corta = { ...ok, password: "a".repeat(MIN_PASSWORD_LENGTH - 1) };

    it("la exige al crear cuenta", () => {
      const { password } = validateCredentials(corta, "signUp");
      expect(password).toContain(String(MIN_PASSWORD_LENGTH));
    });

    it("no la exige al entrar", () => {
      // Esa contraseña ya existe y la regla del proveedor pudo cambiar después:
      // bloquear el intento dejaría a su dueño sin poder entrar nunca.
      expect(validateCredentials(corta, "signIn").password).toBeUndefined();
    });
  });

  it("no se inventa reglas de complejidad", () => {
    // Ni mayúsculas, ni dígitos, ni símbolos: eso lo decide el proveedor, y
    // adivinarlo aquí rechaza contraseñas que el backend habría aceptado.
    const simple = { ...ok, password: "aaaaaaaaaa", confirm: "aaaaaaaaaa" };
    expect(validateCredentials(simple, "signUp")).toEqual({});
  });

  describe("repetir la contraseña", () => {
    it("la exige al crear cuenta", () => {
      const { confirm } = validateCredentials({ ...ok, confirm: "" }, "signUp");
      expect(confirm).toBeTruthy();
    });

    it("avisa cuando no coinciden", () => {
      const { confirm } = validateCredentials(
        { ...ok, confirm: "otra-cosa" },
        "signUp",
      );
      expect(confirm).toMatch(/no coinciden/i);
    });

    it("no la exige al entrar", () => {
      // Al entrar no hay segundo campo, así que no hay nada que comparar.
      expect(
        validateCredentials({ ...ok, confirm: undefined }, "signIn"),
      ).toEqual({});
    });

    it("calla mientras la contraseña en sí no sea válida", () => {
      // Decir «no coinciden» a quien aún no ha escrito una contraseña válida es
      // un segundo error por el mismo problema.
      const errors = validateCredentials(
        { ...ok, password: "", confirm: "" },
        "signUp",
      );
      expect(errors.password).toBeTruthy();
      expect(errors.confirm).toBeUndefined();
    });
  });

  it("reporta los dos campos a la vez", () => {
    // El formulario pinta el mensaje debajo de cada campo, así que devolver solo
    // el primer fallo obligaría al usuario a enviar dos veces para verlos.
    expect(
      validateCredentials({ email: "", password: "", confirm: "" }, "signUp"),
    ).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
  });
});
