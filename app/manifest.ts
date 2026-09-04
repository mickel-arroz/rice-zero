import type { MetadataRoute } from "next";

import { appManifest } from "@/lib/pwa/manifest";

/**
 * El manifest de la PWA, en `/manifest.webmanifest`.
 *
 * Solo cablea: lo que dice vive en `lib/pwa/manifest.ts`, que sí se puede
 * importar desde un test. Aquí no hay nada que probar y allí está todo lo que
 * se puede romper sin que nada avise.
 */
export default function manifest(): MetadataRoute.Manifest {
  return appManifest();
}
