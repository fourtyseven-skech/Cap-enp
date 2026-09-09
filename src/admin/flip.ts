import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * ---------------------------------------------------------------------------
 * REPOSITIONNEMENT ANIMÉ
 * ---------------------------------------------------------------------------
 *
 * Quand un calque change de rang, la liste se réordonne d'un coup : la ligne
 * qu'on vient de manipuler est ailleurs, et l'œil doit la rechercher. C'est
 * exactement le moment où l'on a besoin de la suivre — après un « Monter »,
 * après une duplication, après un collage.
 *
 * La technique est celle que tous les éditeurs emploient : on mesure la
 * position AVANT le nouveau rendu, on la compare à celle d'APRÈS, et on rejoue
 * le trajet à l'envers. L'élément est déjà à sa place définitive dans le
 * document — seule sa peinture est ramenée en arrière puis relâchée. Rien n'est
 * recalculé, aucune mise en page n'est refaite : le compositeur ne manipule
 * qu'une translation.
 *
 * Les éléments à suivre se déclarent avec `data-flip="<identifiant stable>"`.
 * ------------------------------------------------------------------------- */

const DUREE = 280;
const COURBE = "cubic-bezier(0.22, 1, 0.36, 1)";

export const useFlip = <T extends HTMLElement>(
  /**
   * Passe à `true` le temps d'un rendu pour ne pas animer. Indispensable
   * pendant un glisser-déposer : la bibliothèque de tri applique déjà ses
   * propres transformations, et les deux animations se combattraient — le bloc
   * partirait dans une direction puis reviendrait.
   */
  ignorer?: RefObject<boolean>
) => {
  const conteneur = useRef<T>(null);
  const positions = useRef(new Map<string, DOMRect>());

  // Sans tableau de dépendances : la mesure doit avoir lieu après CHAQUE rendu,
  // sinon la position de référence date d'un état déjà périmé.
  useLayoutEffect(() => {
    const racine = conteneur.current;
    if (!racine) return;

    const noeuds = Array.from(racine.querySelectorAll<HTMLElement>("[data-flip]"));
    const vus = new Set<string>();

    // Le réglage système fait autorité : le mouvement reste un confort.
    const reduit =
      racine.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const saute = ignorer?.current === true || reduit;

    noeuds.forEach((n) => {
      const cle = n.dataset.flip;
      if (!cle) return;
      vus.add(cle);

      const apres = n.getBoundingClientRect();
      const avant = positions.current.get(cle);
      positions.current.set(cle, apres);
      if (!avant || saute) return;

      const dx = avant.left - apres.left;
      const dy = avant.top - apres.top;
      // Un pixel de dérive vient d'un arrondi, pas d'un déplacement.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: DUREE,
        easing: COURBE,
      });
    });

    // Les éléments disparus sont oubliés, sinon la table de positions ne cesse
    // de grossir au fil des ajouts et suppressions.
    positions.current.forEach((_, cle) => {
      if (!vus.has(cle)) positions.current.delete(cle);
    });
  });
  // Le drapeau n'est PAS remis à zéro ici : plusieurs conteneurs le partagent,
  // et le premier à s'exécuter le relâcherait avant que les suivants l'aient
  // lu. C'est à l'appelant de le rendre, une fois tous les conteneurs passés
  // (voir `useFinFlip`).

  return conteneur;
};

/**
 * Relâche le drapeau d'inhibition, une fois que tous les conteneurs animés ont
 * mesuré leurs positions. À appeler APRÈS le dernier `useFlip` : les effets de
 * mise en page d'un même composant s'exécutent dans l'ordre de déclaration.
 */
export const useFinFlip = (ignorer: RefObject<boolean>) => {
  useLayoutEffect(() => {
    if (ignorer.current) (ignorer as { current: boolean }).current = false;
  });
};
