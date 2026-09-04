/**
 * La capa de IA, por su puerta.
 *
 * Todo lo que la app puede saber de la IA entra por aquí: el contrato de
 * salida, el prompt que lo pide, el render a texto y la taxonomía de fallos.
 * Ningún archivo suelto de este directorio importa un SDK ni lee credenciales,
 * y ESLint lo impide.
 *
 * Mismo criterio que `lib/backend/ports/index.ts`, `export *` incluido: una
 * lista de símbolos a mano obliga a editar dos archivos cada vez que nace uno.
 *
 * Lo que esta puerta NO deja pasar es la FÁBRICA (`lib/ai/factory/`) ni el
 * adaptador de Gemini. Por aquí entra también el navegador —el panel usa el
 * renderer— y reexportar la fábrica arrastraría el SDK de Google, y con él la
 * lectura de la API key, a un bundle de cliente. Quien necesita la fábrica es
 * el Server Action, y la importa por su ruta.
 */

export * from "@/lib/ai/errors";
export * from "@/lib/ai/port";
export * from "@/lib/ai/prompt";
export * from "@/lib/ai/render";
export * from "@/lib/ai/schema";
