/**
 * Fixtures de `lib/ai`.
 *
 * Existe por lo mismo que `lib/tree/testing.ts`: el schema, el renderer y la
 * contract suite tienen que hablar del MISMO Análisis. Tres copias a mano de
 * un Análisis de muestra divergen sin que nadie lo note —un Ticket de más
 * aquí, un `blockedBy` distinto allá— y a partir de ahí los tres archivos
 * dejan de probar lo mismo.
 *
 * Todas las fábricas devuelven objetos NUEVOS y mutables: los tests del schema
 * los tuercen a propósito, y un fixture compartido por referencia se
 * contaminaría entre casos.
 */

import type { Analysis, IntentKind } from "@/lib/ai/schema";
import type { TreeNode } from "@/lib/backend/ports";
import { treeNode as node } from "@/lib/tree/testing";

/**
 * Un Análisis válido y completo.
 *
 * Tres Tickets y no uno porque las reglas interesantes son de RELACIÓN
 * —referencias rotas, ciclos, ids repetidos— y con un solo Ticket ninguna se
 * puede ni escribir. La cadena es t1 → t2 → t3, que es la que un ciclo de tres
 * pasos puede cerrar en el test.
 */
export function sampleAnalysis(): Analysis {
  return {
    intent: {
      kind: "feature",
      rationale:
        "El árbol cuelga un catálogo de una tienda que ya menciona su carrito como existente.",
    },
    summary:
      "Añadir un catálogo con filtros por talla a una tienda ya desplegada, sin tocar el carrito.",
    questions: ["¿Las tallas vienen del inventario o son una lista fija?"],
    spec: {
      problem:
        "La tienda vende sin catálogo navegable: hoy solo se llega a un producto por enlace directo.",
      solution:
        "Una vista de catálogo con filtros por talla que reutiliza el modelo de producto existente.",
      decisions: [
        "El filtro vive en la query string, para que un catálogo filtrado se pueda enlazar.",
        "Ningún cambio en el carrito: se le entrega el mismo producto que hoy.",
      ],
      testing: [
        "El filtrado se prueba como función pura sobre una lista de productos a mano.",
      ],
      outOfScope: ["Buscador por texto", "Recomendaciones"],
      checks: [
        "Abrir el catálogo lista todos los productos publicados",
        "Un catálogo filtrado se puede recargar y conserva el filtro",
      ],
    },
    tickets: [
      {
        id: "t1",
        title: "Listado de productos",
        build:
          "Una vista que lee los productos publicados y los pinta en una rejilla.",
        checks: [
          "La vista lista todos los productos publicados",
          "Sin productos, la vista dice que no hay ninguno en vez de quedarse en blanco",
        ],
        blockedBy: [],
      },
      {
        id: "t2",
        title: "Filtro por talla",
        build:
          "El control de tallas sobre el listado, con el estado en la query string.",
        checks: [
          "Elegir una talla deja solo los productos que la tienen",
          "Recargar con el filtro puesto conserva la selección",
        ],
        blockedBy: ["t1"],
      },
      {
        id: "t3",
        title: "Entrada al carrito desde el catálogo",
        build:
          "El botón de añadir en cada tarjeta, llamando al carrito ya existente.",
        checks: ["Añadir desde el catálogo deja el producto en el carrito"],
        blockedBy: ["t2"],
      },
    ],
  };
}

/**
 * El mismo Análisis con adorno de Markdown y emojis metidos en el contenido.
 *
 * Existe porque la promesa de «texto plano sin adorno» no se cumple sola con
 * que el renderer no escriba negritas: el contenido lo escribe un modelo, y un
 * modelo mete `**` dentro de un `title` cuando le apetece. Este fixture es lo
 * que hace que ese caso se pruebe en vez de suponerse.
 */
export function adornedAnalysis(): Analysis {
  const analysis = sampleAnalysis();
  analysis.intent.rationale = "El árbol habla de `carrito` como algo **ya desplegado** 🚀";
  analysis.summary = "# Catálogo\n\nUn catálogo con _filtros_ | y tabla | de tallas.";
  analysis.questions = ["¿Las tallas salen de `inventory_items` o de una lista fija? 🤔"];
  analysis.spec.problem = "```\nSin catálogo\n```";
  analysis.spec.decisions[0] = "El filtro va en la **query string**";
  analysis.tickets[0].title = "**Listado** de productos ✨";
  analysis.tickets[0].checks[0] = "La vista lista _todos_ los productos | publicados";
  return analysis;
}

/**
 * Un árbol de muestra por cada Intención.
 *
 * Su razón de ser es el criterio más importante del ticket: un árbol que
 * describe un arreglo sobre algo YA EXISTENTE no puede salir clasificado como
 * `proyecto-nuevo`. Cada árbol de aquí está escrito para que la señal de su
 * Intención esté en el contenido —«ya desplegado», «hoy falla», «sin cambiar
 * el comportamiento»— y no en un rótulo que la delate.
 */
export const SAMPLE_TREES: Record<IntentKind, TreeNode[]> = {
  "proyecto-nuevo": [
    node("a", null, 0, "Tienda online desde cero"),
    node("a1", "a", 0, "Catálogo de productos"),
    node("a2", "a", 1, "Carrito y pago"),
  ],
  feature: [
    node("a", null, 0, "Añadir filtros por talla al catálogo que ya está en producción"),
    node("a1", "a", 0, "El control de tallas sobre el listado actual"),
    node("a2", "a", 1, "No tocar el carrito"),
  ],
  fix: [
    node("a", null, 0, "El carrito desplegado pierde los productos al recargar"),
    node("a1", "a", 0, "Pasa solo en móvil"),
    node("a2", "a", 1, "Empezó tras el despliegue del martes"),
  ],
  refactor: [
    node("a", null, 0, "Partir el módulo de checkout sin cambiar su comportamiento"),
    node("a1", "a", 0, "Los tests actuales tienen que seguir pasando igual"),
  ],
  ui: [
    node("a", null, 0, "El botón de pagar de la pantalla actual no se ve en móvil"),
    node("a1", "a", 0, "Subirlo por encima del pliegue"),
  ],
  infra: [
    node("a", null, 0, "Mover el despliegue actual a otro proveedor"),
    node("a1", "a", 0, "Mismas variables de entorno"),
  ],
  docs: [
    node("a", null, 0, "Documentar la API que ya está publicada"),
    node("a1", "a", 0, "Un ejemplo por endpoint"),
  ],
  otro: [
    node("a", null, 0, "Revisar si conviene seguir con la tienda"),
    node("a1", "a", 0, "Comparar coste contra ingresos"),
  ],
};
