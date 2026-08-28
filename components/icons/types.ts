import type { ComponentType, SVGProps } from "react";

/**
 * La forma de todo icono de la app: un componente que acepta lo que acepta un
 * `<svg>`, para que quien lo pinta decida tamaño y color sin tocar el archivo
 * del icono. Vive aquí y no en `components/layout` porque lo consumen a la vez
 * el catálogo de Proyectos y las filas de navegación.
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
