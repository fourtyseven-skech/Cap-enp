import type { TypeBloc } from "./types";

/**
 * Icônes des composants — dessinées pour Megasoft.
 *
 * Pas de bibliothèque tierce : le trait reprend celui du monogramme — géométrie
 * simple, terminaisons rondes, épaisseur constante. Chaque icône représente la
 * SILHOUETTE du bloc une fois posé dans la page, pas une métaphore abstraite :
 * on reconnaît le composant à sa forme, ce qui rend la bibliothèque lisible
 * d'un coup d'œil même à petite taille.
 */

const B = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-full h-full"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** Accroche : un gros titre, deux lignes de chapeau, un filet d'attaque. */
const Accroche = () => (
  <B>
    <path d="M4 5h6" strokeWidth={2.4} />
    <path d="M4 10h16" strokeWidth={2.8} />
    <path d="M4 14.5h13" />
    <path d="M4 18h9" />
  </B>
);

/** Paragraphe : le fil du texte. */
const Texte = () => (
  <B>
    <path d="M4 6h16" />
    <path d="M4 10h16" />
    <path d="M4 14h16" />
    <path d="M4 18h10" />
  </B>
);

/** Citation : le filet vertical et les guillemets. */
const Citation = () => (
  <B>
    <path d="M4 5v14" strokeWidth={2.6} />
    <path d="M9 8.5c0 0 0 3-2 3.5" />
    <path d="M13.5 8.5c0 0 0 3-2 3.5" />
    <path d="M9 8.5h2.2M13.5 8.5h2.2" />
    <path d="M9 16h11" />
  </B>
);

/** Chiffres clés : deux cartes, une valeur haute. */
const Chiffre = () => (
  <B>
    <rect x="3" y="7" width="8" height="11" rx="2" />
    <rect x="13" y="7" width="8" height="11" rx="2" />
    <path d="M5.5 12h3" strokeWidth={2.6} />
    <path d="M15.5 12h3" strokeWidth={2.6} />
    <path d="M5.5 15.5h2M15.5 15.5h2" />
  </B>
);

/** À retenir : l'encadré à puces. */
const Retenir = () => (
  <B>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="7.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="7.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    <path d="M11 10h6.5M11 14.5h4.5" />
  </B>
);

/** Appel à l'action : le bouton et sa flèche. */
const Action = () => (
  <B>
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <path d="M9 12h5" />
    <path d="M12.5 10l2 2-2 2" />
  </B>
);

/** Étapes : jalons numérotés reliés. */
const Etapes = () => (
  <B>
    <circle cx="6" cy="7" r="2.4" />
    <circle cx="6" cy="17" r="2.4" />
    <path d="M6 9.4v5.2" />
    <path d="M11.5 6h9M11.5 9h6" />
    <path d="M11.5 16h9M11.5 19h6" />
  </B>
);

/** Comparatif : deux colonnes face à face. */
const Comparatif = () => (
  <B>
    <rect x="3" y="4.5" width="8" height="15" rx="2" />
    <rect x="13" y="4.5" width="8" height="15" rx="2" />
    <path d="M5.5 9h3M5.5 12.5h3M5.5 16h2" />
    <path d="M15.5 9h3M15.5 12.5h3M15.5 16h2" />
  </B>
);

/** Liste de bénéfices : cases cochées. */
const Liste = () => (
  <B>
    <rect x="3" y="4.5" width="6" height="6" rx="1.6" />
    <rect x="3" y="13.5" width="6" height="6" rx="1.6" />
    <path d="M4.7 7.5l1.2 1.2 2-2.2" />
    <path d="M4.7 16.5l1.2 1.2 2-2.2" />
    <path d="M12 6h9M12 9h6" />
    <path d="M12 15h9M12 18h6" />
  </B>
);

/** Séparateur : le filet tricolore, en couleur — signature de la marque. */
const Separateur = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
    <rect x="2" y="10.6" width="6" height="2.8" rx="1.4" fill="#3B82F6" />
    <rect x="9" y="10.6" width="6" height="2.8" rx="1.4" fill="#EC4899" />
    <rect x="16" y="10.6" width="6" height="2.8" rx="1.4" fill="#22C55E" />
  </svg>
);

export const ICONES: Record<TypeBloc, () => JSX.Element> = {
  accroche: Accroche,
  texte: Texte,
  citation: Citation,
  chiffre: Chiffre,
  retenir: Retenir,
  action: Action,
  etapes: Etapes,
  comparatif: Comparatif,
  liste: Liste,
  separateur: Separateur,
};

export const IconeBloc = ({ type, className = "" }: { type: TypeBloc; className?: string }) => {
  const I = ICONES[type];
  return (
    <span className={`inline-block ${className}`}>
      <I />
    </span>
  );
};
