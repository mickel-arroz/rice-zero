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

  describe("pedir el enlace de recuperación", () => {
    it("solo mira el email", () => {
      // En ese modo el formulario tiene UN campo. Exigir una contraseña que no
      // está en pantalla dejaría el botón muerto sin decir por qué.
      expect(validateCredentials({ email: ok.email }, "resetRequest")).toEqual(
        {},
      );
    });

    it("sigue exigiendo que el email tenga forma de email", () => {
      const { email } = validateCredentials(
        { email: "mickel" },
        "resetRequest",
      );
      expect(email).toBeTruthy();
    });

    it("no se queja de la contraseña aunque llegue vacía", () => {
      const errors = validateCredentials(
        { email: ok.email, password: "" },
        "resetRequest",
      );
      expect(errors.password).toBeUndefined();
      expect(errors.confirm).toBeUndefined();
    });
  });

  describe("fijar la contraseña nueva", () => {
    const nueva = { password: ok.password, confirm: ok.confirm };

    it("no pide email", () => {
      // El email no está en pantalla: lo identifica el token del correo, y
      // volver a pedirlo sería preguntar algo que ya sabemos.
      expect(validateCredentials(nueva, "resetPassword")).toEqual({});
    });

    it("exige la longitud mínima, como al crear cuenta", () => {
      // Es una contraseña NUEVA, así que el argumento de «esa ya existe» no
      // aplica: aquí la regla del proveedor se puede comprobar antes de salir.
      const { password } = validateCredentials(
        {
          password: "a".repeat(MIN_PASSWORD_LENGTH - 1),
          confirm: "a".repeat(MIN_PASSWORD_LENGTH - 1),
        },
        "resetPassword",
      );
      expect(password).toContain(String(MIN_PASSWORD_LENGTH));
    });

    it("exige repetirla y avisa cuando no coinciden", () => {
      expect(
        validateCredentials({ ...nueva, confirm: "" }, "resetPassword").confirm,
      ).toBeTruthy();
      expect(
        validateCredentials({ ...nueva, confirm: "otra-cosa" }, "resetPassword")
          .confirm,
      ).toMatch(/no coinciden/i);
    });

    it("calla la repetición mientras la contraseña en sí no sea válida", () => {
      const errors = validateCredentials(
        { password: "", confirm: "" },
        "resetPassword",
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
