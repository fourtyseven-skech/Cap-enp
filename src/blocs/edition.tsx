import { createContext, useContext, useEffect, useRef } from "react";

/**
 * Édition en place.
 *
 * Le texte se modifie DANS la page, comme sur Canva ou PowerPoint : on clique
 * sur un titre, on écrit. Aucun aller-retour vers un formulaire latéral.
 *
 * Le contexte est absent sur le site publié : `<Edt>` y rend alors du texte
 * ordinaire, sans le moindre attribut d'édition. Le même composant sert donc
 * aux deux usages, et la page livrée au visiteur ne contient aucune trace de
 * l'outillage.
 */

type Contexte = {
  actif: boolean;
  modifier: (blocId: string, cle: string, valeur: string) => void;
};

const ContexteEdition = createContext<Contexte>({ actif: false, modifier: () => {} });

export const FournisseurEdition = ContexteEdition.Provider;
export const useEdition = () => useContext(ContexteEdition);

/**
 * Champ de texte éditable en place.
 *
 * Le nœud est volontairement NON contrôlé par React pendant la frappe. Un
 * champ `contentEditable` re-rendu à chaque caractère perd son curseur — il
 * saute en fin de ligne, et la saisie devient impraticable. La garde ci-dessous
 * n'écrit dans le DOM que si la valeur reçue diffère de ce qui s'y trouve déjà.
 * Comme `onInput` renvoie exactement le contenu du nœud, la condition est
 * fausse pendant la frappe : aucune écriture, donc aucun saut de curseur.
 */
export const Edt = ({
  blocId,
  cle,
  valeur,
  exemple,
  as: Balise = "span",
  className = "",
}: {
  blocId: string;
  cle: string;
  valeur: string;
  exemple?: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}) => {
  const { actif, modifier } = useEdition();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !actif) return;
    if (el.textContent !== valeur) el.textContent = valeur;
  }, [valeur, actif]);

  if (!actif) {
    const Rendu = Balise as React.ElementType;
    return <Rendu className={className}>{valeur || exemple || ""}</Rendu>;
  }

  const Rendu = Balise as React.ElementType;
  return (
    <Rendu
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-exemple={exemple}
      onInput={(e: React.FormEvent<HTMLElement>) =>
        modifier(blocId, cle, e.currentTarget.textContent ?? "")
      }
      // Empêche la sélection du bloc parent : on veut poser le curseur, pas
      // rouvrir le panneau à chaque clic dans un mot.
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      className={`outline-none focus:bg-ms-blue/[0.06] focus:ring-1 focus:ring-ms-blue/30 rounded-sm empty:before:content-[attr(data-exemple)] empty:before:text-ms-ink/25 ${className}`}
    >
      {valeur}
    </Rendu>
  );
};
