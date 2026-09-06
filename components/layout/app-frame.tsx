/**
 * El Contenedor: el marco de toda pantalla posterior al inicio de sesión.
 *
 * «Contenedor» es el término del glosario (ver `CONTEXT.md`), y es lo que se
 * dice de esto en todo el código. No es el Shell: el Shell es la navegación
 * permanente —barra lateral y cabecera— y monta a éste por dentro.
 *
 * Es el suelo sobre el que se monta el resto de lo visual, y decide DOS cosas
 * que antes se decidían por separado y en contradicción: el ancho máximo del
 * contenido y la forma de tarjeta flotante. Antes de esto, `ProjectsScreen`
 * fijaba 1024, el árbol 768 y la puerta de Versiones otros 768 — tres anchos
 * para una app que solo tiene uno, y la sensación al navegar de que la app
 * cambia de forma según dónde estés.
 *
 * Va aquí y no en `app/(dashboard)/layout.tsx` por lo mismo que el shell es un
 * componente y no solo un layout: «Acerca de» es un destino del shell pero
 * `/about` es pública, así que vive FUERA del grupo de rutas protegidas. Un
 * contenedor puesto en el layout se saltaría precisamente la pantalla que más
 * fácil es olvidar.
 *
 * Lo pinta `DashboardNav` envolviendo a `children`: ninguna pantalla lo monta,
 * y por tanto ninguna puede olvidarse de él ni contradecirlo. El precio es que
 * las pantallas NO ponen su propio relleno ni su propio ancho — el que lo haga
 * se suma a este y se sale del boceto.
 */

/**
 * El ancho de la columna de contenido, en píxeles.
 *
 * 1024 y no 768: es el ancho que ya tenía la lista de Proyectos, la pantalla
 * con la rejilla más ancha de la app, y la que por tanto marca el suelo. Sin
 * excepciones, tampoco para la Vista Canvas: el lienzo se desplaza y hace zoom,
 * y para verlo entero ya tiene su pantalla completa, que sale del contenedor
 * por arriba con un `fixed`.
 */
const APP_MEASURE = 1024;

/**
 * Cancelar el relleno horizontal del contenedor, para lo que tiene que llegar
 * de borde a borde de la tarjeta.
 *
 * Lo pide la barra de acciones del Nodo en la Vista Registro: es una franja
 * pegada abajo con su propio fondo, y con el relleno del contenedor por debajo
 * quedaría flotando en una tira de tarjeta a cada lado en vez de apoyarse en el
 * borde. En escritorio no sangra —ahí la barra es una pastilla que se centra—,
 * de ahí el `lg:` que lo devuelve todo a cero.
 *
 * Existe como constante EXPORTADA y no escrito a mano en cada sitio porque
 * antes lo estaba: valía `-mx-6 px-6` calibrado contra el `px-6` que llevaba
 * entonces la pantalla del árbol, y el día que el relleno se mudó aquí los dos
 * números dejaron de cuadrar en silencio — la pastilla se salía 8 px de la
 * tarjeta por cada lado y nada falló, solo se veía mal.
 */
export const APP_FRAME_BLEED = "-mx-4 px-4 lg:mx-0 lg:px-0";

/**
 * ── El canalón en móvil: 3.5rem ───────────────────────────────────────────
 *
 * Lo que este contenedor se come del ancho de la VENTANA en móvil, contando
 * los dos lados: 12 de margen y 16 de relleno de tarjeta a cada lado.
 *
 * No es una constante, y no puede serlo: quien lo necesita lo necesita DENTRO
 * de una clase de Tailwind —hoy el desplegable de Versiones, con su
 * `w-[min(21.5rem,calc(100vw-3.5rem))]`— y Tailwind genera las utilidades
 * leyendo el TEXTO del fuente, así que una clase montada con una variable no
 * llegaría a existir. El número se escribe allí, y allí hay un comentario que
 * apunta aquí, que es donde se explica de dónde sale.
 *
 * `APP_FRAME_BLEED` sí puede ser constante porque guarda clases ENTERAS: sus
 * tokens aparecen literales en este archivo, y con eso a Tailwind le basta.
 */

export function AppFrame({
  className = "",
  children,
}: {
  /** Lo usa el menú móvil para esconder el contenido sin desmontarlo. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // El margen del contenedor: arriba, abajo y a la derecha. A la izquierda
    // NO, porque en escritorio la separación con la sidebar la hace el propio
    // ancho de la sidebar —que por eso perdió su borde derecho: dos bordes
    // pegados se leen como un trazo de 2 px, no como dos elementos.
    <div
      className={`flex flex-1 flex-col p-3 pb-0 lg:p-4 lg:pl-0 ${className}`}
    >
      {/* La tarjeta. En móvil se sale por abajo de la pantalla a propósito:
          sin barra lateral que la enmarque, cerrarla por abajo dejaría una
          franja de fondo bajo el contenido con la que el pulgar tropieza. De
          ahí que abajo no tenga ni borde ni esquinas.

          Sin `overflow-hidden`: dentro viven menús, selectores y diálogos que
          se salen de su caja a propósito, y recortarlos en las esquinas es
          exactamente lo que no tiene que pasar. */}
      <div className="flex flex-1 flex-col rounded-t-[20px] border border-b-0 border-border bg-card px-4 py-5 lg:rounded-[20px] lg:border-b lg:px-8 lg:py-7">
        <div
          className="mx-auto flex w-full flex-1 flex-col"
          style={{ maxWidth: `${APP_MEASURE}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
