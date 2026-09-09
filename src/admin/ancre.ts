import { useCallback, useState } from "react";

/**
 * Ancrage des éléments flottants.
 *
 * Ces hooks vivent à part des composants : un module qui exporte à la fois des
 * composants et des fonctions perd le rechargement à chaud de React, et
 * `ui.tsx` est le fichier qu'on retouche le plus souvent.
 */

/** Rectangle auquel un flottant s'accroche — élément, ou point d'un clic. */
export type Ancre = { x: number; y: number; l: number; h: number };

export const ancreDe = (e: HTMLElement | null): Ancre | null => {
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, l: r.width, h: r.height };
};

/** Ouvre/ferme un flottant en mémorisant le rectangle de son déclencheur. */
export const useAncre = () => {
  const [ancre, setAncre] = useState<Ancre | null>(null);
  const basculer = useCallback((e: HTMLElement | null) => {
    setAncre((a) => (a ? null : ancreDe(e)));
  }, []);
  const fermer = useCallback(() => setAncre(null), []);
  return { ancre, ouvert: ancre !== null, basculer, fermer };
};

/**
 * Menu contextuel. Le clic droit est le geste attendu partout où l'on manipule
 * des objets sur une planche — PowerPoint, Canva, un explorateur de fichiers.
 * Ne pas le proposer oblige à remonter à la barre d'outils pour chaque action,
 * alors même que la main est déjà sur l'objet.
 */
export const useMenuContextuel = () => {
  const [ancre, setAncre] = useState<Ancre | null>(null);

  const ouvrir = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    /**
     * L'aperçu du constructeur vit dans un <iframe> : `clientX/clientY` y sont
     * mesurés dans le repère du CADRE, alors que le menu est rendu dans le
     * document parent. Sans le décalage du cadre, le menu s'ouvrirait à
     * plusieurs centaines de pixels du curseur. `view.frameElement` donne
     * l'iframe vue du parent ; hors cadre il vaut null et le décalage est nul.
     *
     * `view` est typé `AbstractView`, un sous-ensemble minimal qui ignore
     * `frameElement` : le détour par `unknown` est la seule voie.
     */
    const vue = e.view as unknown as Window | null;
    let cadre: DOMRect | null = null;
    try {
      cadre = vue?.frameElement?.getBoundingClientRect() ?? null;
    } catch {
      /* cadre d'une autre origine — inaccessible, on reste sur le repère local */
    }
    // Ancre de taille nulle posée sur le pointeur : le menu sort exactement du
    // curseur, comme celui du système.
    setAncre({ x: e.clientX + (cadre?.left ?? 0), y: e.clientY + (cadre?.top ?? 0), l: 0, h: 0 });
  }, []);

  const fermer = useCallback(() => setAncre(null), []);
  return { ancre, ouvert: ancre !== null, ouvrir, fermer };
};
