/**
 * La capa de IA, por su puerta.
 *
 * Todo lo que la app puede saber de la IA entra por aquí: el contrato de
 * salida, el prompt que lo pide y el render a texto. Ningún archivo suelto de
 * este directorio importa un SDK ni lee credenciales, y ESLint lo impide.
 *
 * Mismo criterio que `lib/backend/ports/index.ts`, `export *` incluido: una
 * lista de símbolos a mano obliga a editar dos archivos cada vez que nace uno.
 */

export * from "@/lib/ai/port";
export * from "@/lib/ai/prompt";
export * from "@/lib/ai/render";
export * from "@/lib/ai/schema";
