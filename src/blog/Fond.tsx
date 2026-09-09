import { DEVISES, type Accent, type Motif } from "./covers";

/**
 * Ambiance de fond des pages du blog.
 *
 * Le fond n'est plus uni : chaque page porte une composition dérivée de ce
 * qu'elle publie — le motif du sujet, la couleur du pôle et le mot en filigrane
 * viennent des métadonnées de l'article. Deux articles n'ont donc jamais le même
 * arrière-plan, et celui-ci « raconte » déjà le sujet avant la lecture.
 *
 * Construit en SVG + CSS uniquement : les flèches en pointillé dérivent
 * lentement grâce à une animation de `stroke-dashoffset` (voir index.css), sans
 * une ligne de JavaScript, et l'animation se coupe d'elle-même si le visiteur a
 * demandé à réduire les animations.
 */

const ACCENTS: Record<Accent, string> = {
  office: "#3B82F6",
  digital: "#EC4899",
  service: "#22C55E",
};

const INK = "#0F172A";

/**
 * Trajectoires de flèches par motif. Chacune évoque le mouvement propre au
 * sujet : l'écriture qui descend dans le registre, la cadence qui monte,
 * l'itinéraire qui serpente, les strates que l'on traverse.
 */
const TRAJETS: Record<Motif, string[]> = {
  grille: [
    "M 120 -40 C 140 140, 100 240, 130 420",
    "M 330 -60 C 350 160, 310 300, 340 520",
    "M 1180 60 C 1210 240, 1160 380, 1200 640",
  ],
  atelier: [
    "M 90 940 C 130 700, 80 560, 140 320",
    "M 300 980 C 350 760, 290 600, 360 380",
    "M 1210 900 C 1260 660, 1190 500, 1250 260",
  ],
  routes: [
    "M -40 620 C 220 500, 320 700, 560 560",
    "M 880 780 C 1080 660, 1140 460, 1400 380",
    "M 140 200 C 380 120, 520 300, 760 180",
  ],
  couches: [
    "M 160 960 C 180 720, 120 560, 180 300",
    "M 1240 940 C 1270 700, 1200 520, 1260 280",
    "M 700 1000 C 720 820, 660 700, 710 520",
  ],
  // Offres : les flèches convergent vers le haut, comme une montée en gamme.
  devises: [
    "M 100 980 C 260 760, 200 560, 380 340",
    "M 1340 960 C 1180 740, 1240 540, 1060 320",
    "M 720 1020 C 730 820, 700 660, 730 460",
  ],
  // Nouveautés : une progression franche vers la droite, jalon après jalon.
  jalons: [
    "M -40 300 C 240 260, 420 340, 700 300",
    "M 700 300 C 980 260, 1160 340, 1480 300",
    "M 200 700 C 480 660, 660 740, 940 700",
  ],
  // Info rapide : deux flèches courtes, droit au but.
  question: [
    "M 240 240 C 420 300, 560 260, 720 320",
    "M 1200 660 C 1040 720, 900 680, 760 740",
    "M 340 880 C 520 840, 640 880, 800 850",
  ],
};

/** Le filigrane de devises n'est posé que sur les articles d'offre. */
const PluieDeDevises = ({ c }: { c: string }) => (
  <g aria-hidden="true">
    {DEVISES.map((d, i) => {
      const col = i % 5;
      const ligne = Math.floor(i / 5);
      return (
        <text
          key={d}
          x={130 + col * 300 + (ligne % 2) * 120}
          y={140 + ligne * 210}
          fill={i % 6 === 0 ? c : INK}
          fillOpacity={i % 6 === 0 ? 0.14 : 0.05}
          fontSize={54 + ((i * 11) % 5) * 16}
          fontWeight="900"
          fontFamily="'Poppins', sans-serif"
          textAnchor="middle"
        >
          {d}
        </text>
      );
    })}
  </g>
);

/** Ancrage du filigrane dans la page. */
export type Position =
  | "haut-gauche" | "haut" | "haut-droite"
  | "gauche" | "centre" | "droite"
  | "bas-gauche" | "bas" | "bas-droite";

/**
 * Traduit une position en coordonnées, dans le repère du SVG (1440 × 900) et
 * en pourcentages. Les ancres restent à 22 % / 78 % plutôt qu'aux bords : un
 * filigrane collé au bord se fait rogner sur les écrans étroits.
 */
export const coordonnees = (p: Position) => {
  const xPct = p.endsWith("gauche") ? 22 : p.endsWith("droite") ? 78 : 50;
  const yPct = p.startsWith("haut") ? 24 : p.startsWith("bas") ? 78 : 50;
  return { x: (xPct / 100) * 1440, y: (yPct / 100) * 900, xPct, yPct };
};

const Fond = ({
  motif = "grille",
  accent = "office",
  mot = "",
  position = "bas-droite",
  mode = "fixe",
}: {
  motif?: Motif;
  accent?: Accent;
  mot?: string;
  position?: Position;
  /**
   * "fixe" : le fond couvre la fenêtre (pages du blog).
   * "absolu" : il se cale sur son conteneur — nécessaire pour empiler ce motif
   * comme un calque parmi d'autres dans le constructeur.
   */
  mode?: "fixe" | "absolu";
}) => {
  const ancre = coordonnees(position);
  const c = ACCENTS[accent];
  const id = `${motif}-${accent}`;

  return (
    <div
      className={`${mode === "fixe" ? "fixed -z-0" : "absolute"} inset-0 pointer-events-none overflow-hidden`}
      style={mode === "fixe" ? { viewTransitionName: "fond" } : undefined}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={`trame-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill={INK} opacity="0.05" />
          </pattern>
          {/* Halo de la couleur du pôle, posé en haut à droite */}
          <radialGradient id={`halo-${id}`} cx={`${ancre.xPct}%`} cy={`${ancre.yPct}%`} r="52%">
            <stop offset="0%" stopColor={c} stopOpacity="0.13" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`halo2-${id}`} cx={`${100 - ancre.xPct}%`} cy={`${100 - ancre.yPct}%`} r="46%">
            <stop offset="0%" stopColor={c} stopOpacity="0.07" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
          {/* Pointe de flèche, à la couleur du pôle */}
          <marker
            id={`pointe-${id}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={c} opacity="0.5" />
          </marker>
          {/* Le lettrage fantôme s'estompe vers les bords, pour ne jamais gêner la lecture */}
          <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="45%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`masque-${id}`}>
            <rect width="1440" height="900" fill={`url(#fade-${id})`} />
          </mask>
        </defs>

        <rect width="1440" height="900" fill={`url(#trame-${id})`} />
        <rect width="1440" height="900" fill={`url(#halo-${id})`} />
        <rect width="1440" height="900" fill={`url(#halo2-${id})`} />

        {/* Filigrane de devises, réservé aux articles d'offre et de tarifs */}
        {motif === "devises" && (
          <g mask={`url(#masque-${id})`}>
            <PluieDeDevises c={c} />
          </g>
        )}

        {/* Flèches en pointillé : le mouvement propre au sujet */}
        <g mask={`url(#masque-${id})`}>
          {TRAJETS[motif].map((d, i) => (
            <path
              key={i}
              className="fond-fleche"
              d={d}
              fill="none"
              stroke={c}
              strokeOpacity="0.3"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2 14"
              markerEnd={`url(#pointe-${id})`}
              style={{ animationDelay: `${i * -4}s` }}
            />
          ))}
        </g>

        {/* Repères d'angle, comme sur les couvertures */}
        {[
          [56, 56, 1, 1],
          [1384, 56, -1, 1],
          [56, 844, 1, -1],
          [1384, 844, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <g key={i} stroke={INK} strokeOpacity="0.14" strokeWidth="1.5">
            <line x1={x} y1={y} x2={Number(x) + 30 * Number(sx)} y2={y} />
            <line x1={x} y1={y} x2={x} y2={Number(y) + 30 * Number(sy)} />
          </g>
        ))}
      </svg>

      {/* Mot en filigrane, en filaire — repris du langage du site.
          Il était dessiné DANS le SVG, dont le repère fait 1440 × 900 et se
          recadre en « slice » : sur un téléphone en portrait, l'image est mise
          à l'échelle sur la hauteur et les deux tiers de sa largeur sortent de
          l'écran. Le mot, posé à 78 % de la largeur, tombait entièrement dans
          la partie hors-champ — ou n'en laissait voir qu'une lettre tranchée.
          Sorti du SVG, il se dimensionne en unités de fenêtre : il tient
          toujours dans l'écran, quelle que soit sa taille, et se recentre en
          dessous de md où il n'y a pas la place de le décaler. */}
      {mot && (
        <span
          className="absolute left-1/2 md:left-[var(--mot-x)] -translate-x-1/2 -translate-y-1/2 font-titrage font-black uppercase tracking-tighter whitespace-nowrap select-none"
          style={
            {
              "--mot-x": `${ancre.xPct}%`,
              top: `${ancre.yPct}%`,
              /* 20,8 vw reproduit la taille d'origine (300 px dans un repère
                 de 1440). Le second terme est un garde-fou tenant compte de la
                 longueur du mot — une capitale grasse avance d'environ 0,62 em
                 — pour qu'aucun filigrane ne dépasse 92 % de la largeur, quelle
                 que soit la fenêtre. Le troisième plafonne sur très grand
                 écran. */
              fontSize: `min(20.8vw, ${(92 / (0.62 * Math.max(mot.length, 1))).toFixed(1)}vw, 18.75rem)`,
              fontFamily: "'Poppins', sans-serif",
              color: "transparent",
              WebkitTextStroke: `0.0067em ${INK}0E`,
            } as React.CSSProperties
          }
        >
          {mot}
        </span>
      )}
    </div>
  );
};

export default Fond;
