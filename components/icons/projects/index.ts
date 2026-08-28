import type { IconComponent } from "@/components/icons/types";

import { NodeIcon } from "./node-icon";
import { LayersIcon } from "./layers-icon";
import { CubeIcon } from "./cube-icon";
import { RocketIcon } from "./rocket-icon";
import { BoltIcon } from "./bolt-icon";
import { StarIcon } from "./star-icon";
import { HeartIcon } from "./heart-icon";
import { FlagIcon } from "./flag-icon";
import { BookmarkIcon } from "./bookmark-icon";
import { BookIcon } from "./book-icon";
import { FlaskIcon } from "./flask-icon";
import { BulbIcon } from "./bulb-icon";
import { CompassIcon } from "./compass-icon";
import { PinIcon } from "./pin-icon";
import { GlobeIcon } from "./globe-icon";
import { TerminalIcon } from "./terminal-icon";
import { CodeIcon } from "./code-icon";
import { DatabaseIcon } from "./database-icon";
import { CloudIcon } from "./cloud-icon";
import { ChipIcon } from "./chip-icon";
import { PhoneIcon } from "./phone-icon";
import { MonitorIcon } from "./monitor-icon";
import { CameraIcon } from "./camera-icon";
import { MusicIcon } from "./music-icon";
import { PaletteIcon } from "./palette-icon";
import { BagIcon } from "./bag-icon";
import { BriefcaseIcon } from "./briefcase-icon";
import { LeafIcon } from "./leaf-icon";
import { DropIcon } from "./drop-icon";
import { TargetIcon } from "./target-icon";

/**
 * El catálogo de iconos que un Proyecto puede llevar (#8).
 *
 * Vive en TypeScript y no como `check` en SQL a propósito: el motor solo guarda
 * texto, así que sumar un icono es un cambio de código y no una migración. El
 * precio es que una clave inválida no la para la base de datos — la para la capa
 * de servicios al escribir, y al leer la ataja `projectIconFor`.
 *
 * UNA tabla y no tres listas en paralelo: sumar un icono se hace en una sola
 * línea, y no hay forma de dejar una clave con componente pero sin nombre. Las
 * claves y el tipo se derivan de aquí.
 *
 * El orden es el del boceto: `node` primero por ser el que se asigna por
 * defecto, y detrás los demás agrupados por familia.
 */
const CATALOG = {
  node: { component: NodeIcon, label: "Nodo" },
  layers: { component: LayersIcon, label: "Capas" },
  cube: { component: CubeIcon, label: "Cubo" },
  rocket: { component: RocketIcon, label: "Cohete" },
  bolt: { component: BoltIcon, label: "Rayo" },
  star: { component: StarIcon, label: "Estrella" },
  heart: { component: HeartIcon, label: "Corazón" },
  flag: { component: FlagIcon, label: "Bandera" },
  bookmark: { component: BookmarkIcon, label: "Marcador" },
  book: { component: BookIcon, label: "Libro" },
  flask: { component: FlaskIcon, label: "Matraz" },
  bulb: { component: BulbIcon, label: "Idea" },
  compass: { component: CompassIcon, label: "Brújula" },
  pin: { component: PinIcon, label: "Lugar" },
  globe: { component: GlobeIcon, label: "Mundo" },
  terminal: { component: TerminalIcon, label: "Terminal" },
  code: { component: CodeIcon, label: "Código" },
  database: { component: DatabaseIcon, label: "Datos" },
  cloud: { component: CloudIcon, label: "Nube" },
  chip: { component: ChipIcon, label: "Chip" },
  phone: { component: PhoneIcon, label: "Móvil" },
  monitor: { component: MonitorIcon, label: "Pantalla" },
  camera: { component: CameraIcon, label: "Cámara" },
  music: { component: MusicIcon, label: "Música" },
  palette: { component: PaletteIcon, label: "Paleta" },
  bag: { component: BagIcon, label: "Tienda" },
  briefcase: { component: BriefcaseIcon, label: "Trabajo" },
  leaf: { component: LeafIcon, label: "Hoja" },
  drop: { component: DropIcon, label: "Gota" },
  target: { component: TargetIcon, label: "Diana" },
} as const satisfies Record<string, { component: IconComponent; label: string }>;

export type ProjectIconKey = keyof typeof CATALOG;

export const PROJECT_ICON_KEYS = Object.keys(CATALOG) as ProjectIconKey[];

/** El nodo cero: de donde sale todo, y lo que lleva un Proyecto sin elegir. */
export const DEFAULT_PROJECT_ICON: ProjectIconKey = "node";

export function isProjectIconKey(value: string): value is ProjectIconKey {
  // `Object.hasOwn` y no `value in CATALOG`: con `in`, «toString» y el resto de
  // `Object.prototype` darían true y se colarían como iconos válidos.
  return Object.hasOwn(CATALOG, value);
}

/**
 * El componente de una clave, o el de por defecto si no se reconoce.
 *
 * Recibe `string` y no `ProjectIconKey` a propósito: la clave llega de una fila
 * de base de datos, que puede haberla escrito una versión anterior de la app o
 * una mano. Esta función ES la validación de lectura, así que estrechar el tipo
 * aquí solo movería el problema al llamante. Nunca lanza: un icono desconocido
 * no puede tumbar la lista de Proyectos entera.
 */
export function projectIconFor(key: string): IconComponent {
  const entry = isProjectIconKey(key) ? CATALOG[key] : CATALOG[DEFAULT_PROJECT_ICON];
  return entry.component;
}

/** El nombre del icono en español, para el selector que trae el #9. */
export function projectIconLabel(key: ProjectIconKey): string {
  return CATALOG[key].label;
}
