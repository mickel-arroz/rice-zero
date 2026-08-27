-- Los dos usuarios de prueba, en la tabla de usuarios de Supabase Auth.
--
-- Es la única parte de la verificación que sabe de qué proveedor se trata:
-- todo lo demás vive en `db/tests/verify_rls_and_clone.sql`. Corre dentro de
-- la transacción que el runner rueda atrás, así que no crea cuentas reales.
--
-- `instance_id`, `aud` y `role` son columnas que Supabase Auth exige aunque no
-- las use este test; van con los valores que pone su propio flujo de registro.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'verificacion-a@rice-zero.invalid', '',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'verificacion-b@rice-zero.invalid', '',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );
