/**
 * L'icône du blog — une bulle de message qu'on est en train d'écrire.
 *
 * D'OÙ VIENT LE DESSIN
 * --------------------
 * Il suit une référence fournie par le commanditaire : une bulle à queue basse
 * gauche, deux lignes de texte, et un stylo posé en travers du coin supérieur
 * droit. Le motif dit « écrire », pas « lire » — ce qui convient mieux à un
 * blog d'éditeur qu'un livre ouvert.
 *
 * CE QUI A ÉTÉ ADAPTÉ À LA MARQUE
 * -------------------------------
 * Le monogramme Megasoft a une langue précise : des traits épais, des joints et
 * des extrémités arrondis, et une diagonale qui MONTE vers la droite. Les trois
 * sont repris ici — et la diagonale tombe juste, puisque le stylo de la
 * référence monte déjà dans ce sens.
 *
 * La bulle est volontairement OUVERTE en haut à droite : son contour s'arrête
 * là où le stylo passe. Fermer le trait ferait deux formes superposées ; le
 * laisser ouvert fait un seul objet, et c'est ce qui rend le dessin lisible à
 * 16 px.
 *
 * L'ANIMATION
 * -----------
 * Au survol du bouton, le stylo remonte de sa longueur d'un cheveu, comme s'il
 * se soulevait de la page. Rien de plus : à cette taille, un mouvement ample
 * deviendrait du bruit.
 *
 * `group-hover/blog` et non `group-hover` : la barre de navigation contient
 * d'autres groupes, une classe anonyme les ferait tous réagir ensemble.
 */
const IconeBlog = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {/* La bulle : contour ouvert en haut à droite, queue en bas à gauche. */}
    <path d="M13.4 4.6 H6.9 A3.4 3.4 0 0 0 3.5 8 V17.2 A1.5 1.5 0 0 0 6.1 18.2 L7.9 16.4 H15.1 A3.4 3.4 0 0 0 18.5 13 V11.6" />

    {/* Les deux lignes de texte. */}
    <path d="M7.2 8.9 H10.4" />
    <path d="M7.2 12.2 H10.4" />

    {/* Le stylo, en travers du coin. Sa pointe est en bas à gauche, son
        extrémité arrondie en haut à droite — la diagonale ascendante. */}
    <path
      /*
       * Le fût fait 3,4 unités de large pour 10 de long.
       *
       * Une première version en faisait 4 : à cette proportion la forme se
       * lisait comme une feuille, pas comme un stylo — et à 16 px le vide
       * intérieur se refermait complètement. Ne pas l'élargir : c'est le
       * rapport longueur/largeur qui fait reconnaître l'objet.
       */
      d="M12.2 13.4 C12.35 11.65 13.15 10.15 14.4 8.9 L18.9 4.4 A1.7 1.7 0 0 1 21.3 6.8 L16.8 11.3 C15.55 12.55 14.05 13.25 12.2 13.4 Z"
      className="transition-transform duration-300 ease-out group-hover/blog:-translate-y-[1px] group-hover/blog:translate-x-[1px]"
      style={{ transformBox: "view-box" }}
    />
  </svg>
);

export default IconeBlog;
