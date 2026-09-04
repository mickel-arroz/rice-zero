import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AnalysisProvider } from "@/components/analysis/analysis-provider";
import { TreeProvider } from "@/components/tree/tree-provider";
import { TreeScreen } from "@/components/tree/tree-screen";
import { VersionGate } from "@/components/versions/version-gate";
import { VersionsProvider } from "@/components/versions/versions-provider";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { TREE_COPY, ROUTES } from "@/lib/constants";
import { TREE_VIEW_COOKIE, treeViewFor } from "@/lib/shell/tree-view";

export const metadata: Metadata = {
  title: TREE_COPY.screenTitle,
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Cuánto se le deja al servidor antes de que la plataforma corte. En segundos.
 *
 * Está aquí y no en la capa de IA porque un Server Action se compila a un POST
 * contra la RUTA que lo invoca: `generateAnalysis` corre bajo esta página, así
 * que este número es el suyo. `AI_CONFIG` ya lo avisaba —«la ruta que monte el
 * panel tiene que declarar un `maxDuration` por encima»— y sin esto el aviso se
 * habría quedado en un comentario.
 *
 * 150 y no 120: el presupuesto de la cadena de modelos son dos minutos, y si el
 * corte de la plataforma cayera en el mismo sitio ganaría el suyo — que llega
 * como un fallo del framework y no como el `AnalysisTimeoutError` que el panel
 * sabe explicar. El margen es para que el corte lo dé siempre nuestro código.
 *
 * ⚠ Un plan que no llegue a este número no puede servir esta app tal cual: la
 * generación se cortaría por fuera antes de que la cadena termine.
 */
export const maxDuration = 150;

/**
 * El árbol de UNA Versión, en cualquiera de las dos vistas.
 *
 * La Versión va en la URL (#14) y eso es lo que hace que recargar, el botón de
 * atrás y un enlace pegado a alguien devuelvan la Versión que se estaba
 * mirando. `/projects/[projectId]` sigue existiendo como desvío a la activa.
 *
 * El `versionId` que llega aquí es una AFIRMACIÓN: una URL se edita a mano.
 * Quien la COMPRUEBA es `VersionsProvider`, buscándola en la lista del Proyecto
 * que necesita de todas formas (ver `VersionService.list`), y quien la APLICA
 * es `VersionGate`: sin Versión confirmada no se pinta nada con lo que se pueda
 * escribir. Hacen falta los dos — bajo RLS, leer el árbol de una Versión ajena
 * no falla, devuelve cero filas, así que sin la puerta el error se disfrazaría
 * de Versión vacía. Aquí no se comprueba nada porque aquí no se puede: el ADR
 * 0001 deja los datos en el navegador y esta página es solo la entrada.
 *
 * ── Por qué DOS providers y no uno ────────────────────────────────────────
 *
 * Son dos vidas distintas. `VersionsProvider` cuelga del PROYECTO: su lista es
 * la misma se mire la Versión que se mire, así que navegar de v7 a v3 no la
 * tira. `TreeProvider` cuelga de la VERSIÓN: su árbol es otro, y cambiar de
 * Versión tiene que recargarlo entero. Montados al revés —uno solo— el
 * desplegable parpadearía cada vez que se usa.
 *
 * Lo único que sí resuelve el servidor es CON QUÉ VISTA se abre: sale de una
 * cookie, y leerla aquí es lo que evita que la pantalla salga en Registro y
 * salte al Canvas al hidratar. Ver `lib/shell/tree-view.ts`.
 */
export default async function VersionPage({
  params,
}: PageProps<"/projects/[projectId]/[versionId]">) {
  const session = await requestSession();

  // El layout ya comprobó la sesión, y aun así se comprueba otra vez: un layout
  // no se re-evalúa en cada navegación y por tanto no puede ser la puerta.
  if (!canAct(session)) redirect(ROUTES.login);

  const { projectId, versionId } = await params;
  const view = treeViewFor(
    (await cookies()).get(TREE_VIEW_COOKIE)?.value,
    projectId,
  );

  return (
    <VersionsProvider projectId={projectId} versionId={versionId}>
      {/* El Panel de IA cuelga POR ENCIMA del árbol, y ése es todo el
          mecanismo de «editar mientras genera: cero bloqueos». Montado aquí,
          una generación de cuarenta segundos y la escritura de un Nodo no
          comparten ni un `setState`, así que no hay forma de que la primera
          bloquee a la segunda — y cerrar la hoja no cancela nada, porque la
          hoja se desmonta y esto no. No hace falta código que lo sincronice;
          hace falta este orden.

          Lleva `key` por lo mismo que el árbol: el Análisis pertenece a UNA
          Versión, y saltar de la v7 a la v3 tiene que dejar atrás también lo
          que la IA dijo de la v7. */}
      <AnalysisProvider key={`ai-${versionId}`} versionId={versionId}>
        {/* Dos decisiones en tres líneas de JSX:

          · `key` en la Versión — cambiar de Versión DESMONTA el árbol en vez
            de reusarlo. Sin esto, lo tecleado a medio guardar y la selección
            de la v7 sobrevivirían al salto a la v3 y se escribirían sobre
            Nodos que allí no existen.
          · La puerta va DENTRO del árbol y no fuera — así la lectura de los
            Nodos sale a la vez que la lista de Versiones y solo se retiene lo
            que se PINTA. Fuera, abrir un Proyecto costaría un viaje de más
            siempre. Ver `VersionGate`. */}
        <TreeProvider key={versionId} versionId={versionId}>
          <VersionGate projectId={projectId}>
            <TreeScreen projectId={projectId} initialView={view} />
          </VersionGate>
        </TreeProvider>
      </AnalysisProvider>
    </VersionsProvider>
  );
}
