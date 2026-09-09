import { CSSProperties } from "react";

/**
 * Logos Megasoft 100 % vectoriels — plus aucun PNG.
 * Le M est retracé depuis le monogramme officiel (deux traits à ~45°,
 * terminaisons rondes) ; le logotype suit la règle de la charte :
 * « MEGASOFT » toujours en Encre (ou blanc sur fond sombre),
 * seul le nom du pôle porte sa couleur.
 *
 * La taille se pilote par la taille de police du conteneur
 * (ex. className="text-2xl") — tout est en em.
 */

export type Pole = "office" | "digital" | "service";

const poleText: Record<Pole, string> = {
  office: "Office",
  digital: "Digital",
  service: "Services",
};

const poleColor: Record<Pole, string> = {
  office: "text-ms-blue",
  digital: "text-ms-pink",
  service: "text-ms-green",
};

const markColor: Record<Pole, string> = {
  office: "text-ms-blue",
  digital: "text-ms-pink",
  service: "text-ms-green",
};

/** Le monogramme seul. Couleur via currentColor (ex. className="text-ms-blue"). */
export const MegasoftMark = ({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) => (
  <svg
    viewBox="-3 -3 233 139"
    className={className}
    style={style}
    aria-hidden="true"
    focusable="false"
  >
    <g stroke="currentColor" strokeWidth={50} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M23 106 L104 27" />
      <path d="M118 106 L201 27 L205 106" />
    </g>
  </svg>
);

/**
 * Logotype complet : monogramme + MEGASOFT + nom du pôle.
 * - pole      : "office" | "digital" | "service" (omis = marque seule)
 * - variant   : "color" (fond clair) | "white" (fond sombre)
 * - markMono  : true pour garder le monogramme bleu quel que soit le pôle
 */
export const MegasoftLogo = ({
  pole,
  variant = "color",
  markMono = false,
  className = "",
}: {
  pole?: Pole;
  variant?: "color" | "white";
  markMono?: boolean;
  className?: string;
}) => {
  const mark =
    variant === "white"
      ? "text-white"
      : pole && !markMono
        ? markColor[pole]
        : "text-ms-blue";

  return (
    <span
      className={`inline-flex items-baseline gap-[0.34em] leading-none whitespace-nowrap select-none ${className}`}
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Aligné par la ligne de base du flex : le bas du M repose exactement
          sur la baseline du texte, et sa hauteur = la hauteur des capitales
          de Poppins (~0.72em) — tête du M au niveau du haut des lettres. */}
      <MegasoftMark className={`h-[0.72em] w-auto ${mark}`} />
      <span className={`font-extrabold tracking-[-0.02em] ${variant === "white" ? "text-white" : "text-ms-ink"}`}>
        MEGASOFT
      </span>
      {pole && <span className={`font-medium ${poleColor[pole]}`}>{poleText[pole]}</span>}
    </span>
  );
};

/**
 * Badge de pôle — la forme courte du logo, pour les écrans étroits.
 *
 * Le logotype complet (M + MEGASOFT + pôle) est une ligne : posé dans une
 * colonne de téléphone, il faut le réduire à une taille où « MEGASOFT » n'est
 * plus lisible, et c'est justement le mot le moins utile — le visiteur est déjà
 * sur le site de Megasoft. On garde donc ce qui distingue : le monogramme à la
 * couleur du pôle, et le nom du pôle dessous, à une taille lisible.
 *
 * La taille se pilote comme le logotype, par la taille de police du conteneur :
 * elle donne celle du libellé, le monogramme suivant en proportion.
 */
export const MegasoftPoleBadge = ({
  pole,
  className = "",
}: {
  pole: Pole;
  className?: string;
}) => (
  <span
    className={`inline-flex flex-col items-center justify-center gap-[0.5em] leading-none select-none ${className}`}
    style={{ fontFamily: "'Poppins', sans-serif" }}
  >
    <MegasoftMark className={`h-[2.4em] w-auto ${markColor[pole]}`} />
    <span className={`font-bold uppercase tracking-[0.1em] ${poleColor[pole]}`}>{poleText[pole]}</span>
  </span>
);

export default MegasoftLogo;
