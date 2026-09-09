"use client";

import { useEffect, useState } from "react";

import { nodeService } from "@/lib/services/nodes";

/**
 * Cuántos Nodos tiene una Versión, preguntado en el momento.
 *
 * Se pide aquí y no viene con la lista de Versiones a propósito. La cifra la
 * necesitan DOS diálogos y solo cuando se abren, y traerla en la lista costaría
 * un agregado por Versión en cada despliegue del menú —o una vista nueva y su
 * migración— para enseñar un número que casi nunca se mira.
 *
 * Lo que sí cambió (#49) es CÓMO se pide. Antes se leía el árbol entero y se le
 * hacía `.length`: el contenido de cada Nodo viajaba por el cable para acabar
 * en un número de una frase, y en la Versión de la que sale este Spec eso son
 * ciento veintiséis Nodos por cada vez que alguien abre «Clonar». Ahora es un
 * `HEAD` con la cuenta en una cabecera — ni una fila.
 *
 * Lo que sí justifica la lectura es CUÁNDO ocurre: justo antes de una
 * operación que no se deshace. «Se copia el árbol entero» y «se lo lleva por
 * delante» dichos en abstracto dejan a la persona adivinando cuánto es «todo»,
 * y ése es el mismo criterio que el spec pide al podar un Nodo.
 *
 * @returns la cifra, o `null` mientras viaja o si no se pudo saber. `null` no
 *   bloquea nada: el diálogo enseña su frase sin número y la operación sigue
 *   disponible — no poder contar no es razón para no dejar borrar.
 */
export function useNodeCount(versionId: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    nodeService()
      .count(versionId)
      .then((total) => {
        if (alive) setCount(total);
      })
      .catch(() => {
        // Se traga a propósito: quien abrió el diálogo va a ver el error de
        // verdad —el de la operación— si de verdad no hay conexión. Un segundo
        // aviso por una cifra que es contexto solo taparía al primero.
        if (alive) setCount(null);
      });
    return () => {
      alive = false;
    };
    // Sin reiniciar la cifra al cambiar de `versionId`: cada diálogo se monta
    // para UNA Versión y muere con ella, así que ese cambio no ocurre. Un
    // `setCount(null)` aquí sería un render de más para un caso que no existe.
  }, [versionId]);

  return count;
}
