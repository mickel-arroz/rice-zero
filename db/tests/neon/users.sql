-- Los dos usuarios de prueba, en la tabla de usuarios de Neon.
--
-- Es la única parte de la verificación que sabe de qué proveedor se trata:
-- todo lo demás vive en `db/tests/verify_rls_and_clone.sql`. Corre dentro de
-- la transacción que el runner rueda atrás, así que no crea cuentas reales.
--
-- `neon_auth."user"` va entrecomillada: `user` es palabra reservada. Managed
-- Better Auth exige `name`, `email` y `emailVerified` no nulos, y `id` es
-- `uuid` — el dato del que depende que `app.current_user_id()` devuelva uuid.

insert into neon_auth."user" (id, name, email, "emailVerified")
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Verificación A',
    'verificacion-a@rice-zero.invalid',
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Verificación B',
    'verificacion-b@rice-zero.invalid',
    true
  );
