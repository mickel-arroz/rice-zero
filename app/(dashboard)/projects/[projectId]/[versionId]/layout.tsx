import { AnalysisProvider } from "@/components/analysis/analysis-provider";
import { TreeProvider } from "@/components/tree/tree-provider";
import { VersionGate } from "@/components/versions/version-gate";
import { VersionsProvider } from "@/components/versions/versions-provider";

/**
 * Todo lo que una Versión tiene abierto, montado por encima de sus pantallas.
 *
 * Existe desde #52, y por un motivo concreto: el Análisis dejó de ser una capa
 * y pasó a tener RUTA propia debajo de ésta. Con los providers en la página del
 * árbol, ir al Análisis las desmontaba — y con ellas una generación en vuelo,
 * la lista de Versiones y lo tecleado a medio guardar. En un layout, navegar
 * entre el árbol y su Análisis no tira nada: Next no vuelve a montar un layout
 * al cambiar de página dentro de él, y ése es exactamente el mecanismo.
 *
 * ── Por qué TRES providers y no uno ───────────────────────────────────────
 *
 * Son tres vidas distintas. `VersionsProvider` cuelga del PROYECTO: su lista es
 * la misma se mire la Versión que se mire, así que navegar de v7 a v3 no la
 * tira. `TreeProvider` y `AnalysisProvider` cuelgan de la VERSIÓN: su árbol y
 * su Análisis son otros, y cambiar de Versión tiene que recargarlos enteros —
 * de ahí sus `key`. Montados al revés, el desplegable parpadearía cada vez que
 * se usa.
 *
 * El Análisis va POR ENCIMA del árbol, y ése es todo el mecanismo de «editar
 * mientras genera: cero bloqueos». Así, una generación de cuarenta segundos y
 * la escritura de un Nodo no comparten ni un `setState`, y volver al árbol no
 * cancela nada. No hace falta código que lo sincronice; hace falta este orden.
 *
 * ⚠ Aquí NO se comprueba la sesión. Un layout no se re-evalúa en cada
 * navegación, así que no puede ser la puerta: eso lo hace cada página. Ver
 * `lib/auth/session.ts`.
 */
export default async function VersionLayout({
  params,
  children,
}: LayoutProps<"/projects/[projectId]/[versionId]">) {
  const { projectId, versionId } = await params;

  return (
    <VersionsProvider projectId={projectId} versionId={versionId}>
      <AnalysisProvider key={`ai-${versionId}`} versionId={versionId}>
        {/* La puerta va DENTRO del árbol y no fuera — así la lectura de los
            Nodos sale a la vez que la lista de Versiones y solo se retiene lo
            que se PINTA. Fuera, abrir un Proyecto costaría un viaje de más
            siempre. Ver `VersionGate`. */}
        <TreeProvider key={versionId} versionId={versionId}>
          <VersionGate projectId={projectId}>{children}</VersionGate>
        </TreeProvider>
      </AnalysisProvider>
    </VersionsProvider>
  );
}
