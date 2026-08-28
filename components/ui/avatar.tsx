import { UserIcon } from "@/components/icons/user-icon";

/**
 * La foto de perfil de alguien, o la silueta por defecto.
 *
 * Existe como componente propio y no dentro de la sidebar porque la misma
 * decisión —«qué se enseña cuando no hay foto»— la van a repetir el menú de
 * cuenta, los ajustes y cualquier sitio donde aparezca un usuario. Una sola
 * respuesta, en un archivo.
 *
 * La foto va en un `<img>` y no en `next/image` a propósito: la URL la pone el
 * proveedor de identidad (Google hoy, cualquiera mañana), así que `next/image`
 * exigiría declarar cada dominio en `remotePatterns` y fallaría en silencio con
 * el primero que no estuviera. A 36 px no hay nada que optimizar.
 */
export function Avatar({
  src,
  name,
  size = 36,
  className = "",
}: {
  src: string | null;
  /** Para el texto alternativo. El email vale si no hay nombre. */
  name: string;
  size?: number;
  className?: string;
}) {
  const style = { width: `${size}px`, height: `${size}px` };
  const shell = `shrink-0 overflow-hidden rounded-full border border-border bg-accent ${className}`;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ver el comentario del módulo
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        // Sin esto, algunos CDNs de foto de perfil devuelven 403 al ver de
        // dónde viene la petición.
        referrerPolicy="no-referrer"
        className={`${shell} object-cover`}
        style={style}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`${shell} flex items-center justify-center text-muted-foreground`}
      style={style}
    >
      <UserIcon width={size * 0.55} height={size * 0.55} />
    </span>
  );
}
