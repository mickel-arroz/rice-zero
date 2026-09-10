import { describe, expect, it } from "vitest";

import { shouldRetryEmptyRead } from "@/lib/backend/adapters/postgrest/warmup";

/**
 * La regla del reintento de una lectura vacía (#41).
 *
 * Las tres condiciones se prueban por separado porque cada una acota un fallo
 * distinto, y quitar cualquiera de ellas rompe algo que no se ve desde el
 * `store`: sin la de las filas se reintentaría siempre, sin la del token se
 * pagaría un viaje por cada lista legítimamente vacía, y sin la del reintento
 * habría bucle.
 */
describe("¿se vuelve a preguntar una lectura vacía?", () => {
  const fresh = { empty: true, tokenIsFresh: true, retried: false };

  it("sí: cero filas con un token recién estrenado es el tropiezo de la sesión", () => {
    // El caso del bug: 200 con cuerpo vacío en la PRIMERA petición, y al
    // recargar la lista aparece entera.
    expect(shouldRetryEmptyRead(fresh)).toBe(true);
  });

  it("no, si trajo algo: RLS casó, no hubo tropiezo", () => {
    expect(shouldRetryEmptyRead({ ...fresh, empty: false })).toBe(false);
  });

  it("no, con el token ya rodado: una lista vacía es una lista vacía", () => {
    // Sin esto, cada Versión sin Nodos y cada Búsqueda sin resultados pagarían
    // un viaje de más para siempre.
    expect(shouldRetryEmptyRead({ ...fresh, tokenIsFresh: false })).toBe(false);
  });

  it("no dos veces: si el reintento también vino vacío, está vacío", () => {
    // Uno y no un bucle, igual que `retryOnce` en las escrituras.
    expect(shouldRetryEmptyRead({ ...fresh, retried: true })).toBe(false);
  });

  it("las tres condiciones son necesarias a la vez", () => {
    for (const empty of [false, true]) {
      for (const tokenIsFresh of [false, true]) {
        for (const retried of [false, true]) {
          const esperado = empty && tokenIsFresh && !retried;
          expect(shouldRetryEmptyRead({ empty, tokenIsFresh, retried })).toBe(
            esperado,
          );
        }
      }
    }
  });
});
