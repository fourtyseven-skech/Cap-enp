/**
 * Couvertures d'articles — illustrations vectorielles.
 *
 * Plutôt que des photographies de banque d'images, interchangeables et lourdes,
 * chaque article reçoit une composition abstraite construite dans le vocabulaire
 * graphique du site : trame de points, filets fins, lettrage fantôme, repères
 * d'angle et filet tricolore. Le motif dit le sujet (registre comptable, cadence
 * d'atelier, réseau logistique, strates d'infrastructure), la couleur dit le pôle.
 *
 * Avantages concrets : quelques kilo-octets, aucune requête réseau
 * supplémentaire, netteté parfaite à toute taille, et une signature visuelle que
 * personne d'autre ne peut avoir.
 */

export type Motif = "grille" | "atelier" | "routes" | "couches" | "devises" | "jalons" | "question";

/**
 * Devises du monde, dinar algérien en tête — le marché de Megasoft d'abord.
 * Utilisées comme filigrane sur les articles qui parlent d'offres, de formules
 * ou de plans de paiement.
 */
export const DEVISES = [
  "DA", "$", "€", "£", "¥", "₹", "₽", "﷼", "₺", "₩",
  "₫", "₦", "₱", "₴", "₪", "฿", "₮", "₸", "₲", "₡",
];
export type Accent = "office" | "digital" | "service";

const ACCENTS: Record<Accent, string> = {
  office: "#3B82F6",
  digital: "#EC4899",
  service: "#22C55E",
};

const INK = "#0F172A";
const PAPER = "#F5F3EF";

/** Fond commun : papier, trame de points, repères d'angle. */
const Fond = ({ id }: { id: string }) => (
  <>
    <defs>
      <pattern id={`dots-${id}`} width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.5" fill={INK} opacity="0.07" />
      </pattern>
    </defs>
    <rect width="1200" height="600" fill={PAPER} />
    <rect width="1200" height="600" fill={`url(#dots-${id})`} />
    {/* Repères d'angle, comme un cadre de mise au point */}
    {[
      [40, 40, 1, 1],
      [1160, 40, -1, 1],
      [40, 560, 1, -1],
      [1160, 560, -1, -1],
    ].map(([x, y, sx, sy], i) => (
      <g key={i} stroke={INK} strokeOpacity="0.25" strokeWidth="1.5">
        <line x1={x} y1={y} x2={Number(x) + 26 * Number(sx)} y2={y} />
        <line x1={x} y1={y} x2={x} y2={Number(y) + 26 * Number(sy)} />
      </g>
    ))}
  </>
);

/** Filet tricolore en pied de composition — signature de la marque. */
const FiletTricolore = () => (
  <g>
    <rect x="40" y="536" width="120" height="3" fill={ACCENTS.office} />
    <rect x="168" y="536" width="120" height="3" fill={ACCENTS.digital} />
    <rect x="296" y="536" width="120" height="3" fill={ACCENTS.service} />
  </g>
);

const Etiquette = ({ texte }: { texte: string }) => (
  <text
    x="40"
    y="520"
    fill={INK}
    fillOpacity="0.4"
    fontSize="15"
    fontWeight="700"
    letterSpacing="3"
    fontFamily="'Inter Tight', sans-serif"
  >
    {texte.toUpperCase()}
  </text>
);

/** Registre comptable : lignes réglées, colonnes, écritures qui s'empilent. */
const Grille = ({ c }: { c: string }) => (
  <g>
    {Array.from({ length: 11 }, (_, i) => (
      <line key={i} x1="480" y1={110 + i * 34} x2="1160" y2={110 + i * 34} stroke={INK} strokeOpacity="0.12" />
    ))}
    {[480, 700, 860, 1000, 1160].map((x) => (
      <line key={x} x1={x} y1="94" x2={x} y2="486" stroke={INK} strokeOpacity="0.12" />
    ))}
    {/* Écritures : barres de longueurs variables dans les colonnes */}
    {[
      [500, 144, 170],
      [720, 178, 110],
      [880, 212, 95],
      [500, 246, 140],
      [720, 280, 120],
      [500, 314, 190],
      [880, 348, 100],
      [720, 382, 90],
    ].map(([x, y, w], i) => (
      <rect key={i} x={x} y={y} width={w} height="10" rx="5" fill={i % 3 === 0 ? c : INK} opacity={i % 3 === 0 ? 0.85 : 0.16} />
    ))}
    {/* Total souligné */}
    <rect x="1000" y="440" width="140" height="12" rx="6" fill={c} />
    <line x1="1000" y1="466" x2="1160" y2="466" stroke={c} strokeWidth="2.5" />
  </g>
);

/** Cadence d'atelier : barres rythmées sur une ligne de base. */
const Atelier = ({ c }: { c: string }) => {
  const hauteurs = [90, 150, 120, 210, 170, 260, 200, 300, 240, 190, 150, 230, 130, 175];
  return (
    <g>
      <line x1="480" y1="470" x2="1160" y2="470" stroke={INK} strokeOpacity="0.2" strokeWidth="2" />
      {hauteurs.map((h, i) => {
        const x = 496 + i * 48;
        const actif = i === 5 || i === 7;
        return (
          <rect
            key={i}
            x={x}
            y={470 - h}
            width="26"
            height={h}
            rx="13"
            fill={actif ? c : INK}
            opacity={actif ? 0.9 : 0.14}
          />
        );
      })}
      {/* Seuil de cadence */}
      <line x1="480" y1="250" x2="1160" y2="250" stroke={c} strokeWidth="2" strokeDasharray="7 6" opacity="0.7" />
      <circle cx="1160" cy="250" r="6" fill={c} />
    </g>
  );
};

/** Réseau logistique : nœuds reliés, un itinéraire mis en avant. */
const Routes = ({ c }: { c: string }) => {
  const noeuds: [number, number][] = [
    [540, 400],
    [660, 220],
    [800, 340],
    [930, 180],
    [1080, 330],
    [700, 460],
    [990, 450],
  ];
  return (
    <g>
      {/* Liaisons secondaires */}
      {[
        [0, 5],
        [5, 2],
        [2, 6],
        [6, 4],
        [1, 3],
      ].map(([a, b], i) => (
        <line
          key={i}
          x1={noeuds[a][0]}
          y1={noeuds[a][1]}
          x2={noeuds[b][0]}
          y2={noeuds[b][1]}
          stroke={INK}
          strokeOpacity="0.15"
          strokeWidth="1.5"
        />
      ))}
      {/* Itinéraire retenu */}
      <path
        d={`M ${noeuds[0][0]} ${noeuds[0][1]} Q 600 260 ${noeuds[1][0]} ${noeuds[1][1]} Q 740 250 ${noeuds[2][0]} ${noeuds[2][1]} Q 880 240 ${noeuds[3][0]} ${noeuds[3][1]} Q 1030 220 ${noeuds[4][0]} ${noeuds[4][1]}`}
        fill="none"
        stroke={c}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {noeuds.map(([x, y], i) => {
        const surRoute = [0, 1, 2, 3, 4].includes(i);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={surRoute ? 13 : 9} fill={surRoute ? c : PAPER} stroke={surRoute ? c : INK} strokeOpacity={surRoute ? 1 : 0.3} strokeWidth="2" />
            {surRoute && <circle cx={x} cy={y} r="4.5" fill={PAPER} />}
          </g>
        );
      })}
    </g>
  );
};

/** Strates d'infrastructure : plans empilés en perspective. */
const Couches = ({ c }: { c: string }) => (
  <g>
    {[0, 1, 2, 3].map((i) => {
      const y = 180 + i * 78;
      const actif = i === 0;
      return (
        <g key={i}>
          <path
            d={`M 820 ${y} L 1120 ${y + 76} L 820 ${y + 152} L 520 ${y + 76} Z`}
            fill={actif ? c : INK}
            fillOpacity={actif ? 0.16 : 0.05}
            stroke={actif ? c : INK}
            strokeOpacity={actif ? 0.9 : 0.2}
            strokeWidth="2"
          />
          {!actif && (
            <circle cx="820" cy={y + 76} r="6" fill={INK} opacity="0.18" />
          )}
        </g>
      );
    })}
    {/* Liaison verticale */}
    <line x1="820" y1="256" x2="820" y2="490" stroke={c} strokeWidth="2" strokeDasharray="6 6" opacity="0.5" />
    <circle cx="820" cy="256" r="8" fill={c} />
  </g>
);

/** Offres et plans de paiement : paliers tarifaires sous une pluie de devises. */
const Devises = ({ c }: { c: string }) => (
  <g>
    {/* Nuée de devises du monde, densité décroissante vers la gauche */}
    {DEVISES.map((d, i) => {
      const col = i % 5;
      const ligne = Math.floor(i / 5);
      const x = 500 + col * 148 + (ligne % 2) * 40;
      const y = 130 + ligne * 108;
      const fort = i === 0; // le dinar algérien, mis en avant
      return (
        <text
          key={d}
          x={x}
          y={y}
          fill={fort ? c : INK}
          fillOpacity={fort ? 0.9 : 0.1 + ((i * 7) % 5) * 0.03}
          fontSize={fort ? 62 : 40 + ((i * 5) % 4) * 8}
          fontWeight="900"
          fontFamily="'Poppins', sans-serif"
          textAnchor="middle"
        >
          {d}
        </text>
      );
    })}
    {/* Trois paliers d'offre, en escalier */}
    {[0, 1, 2].map((i) => {
      const h = 70 + i * 52;
      const x = 90 + i * 116;
      return (
        <g key={i}>
          <rect x={x} y={470 - h} width="92" height={h} rx="14" fill={i === 2 ? c : INK} opacity={i === 2 ? 0.85 : 0.12} />
          {i === 2 && <circle cx={x + 46} cy={470 - h - 26} r="9" fill={c} />}
        </g>
      );
    })}
    <line x1="70" y1="470" x2="450" y2="470" stroke={INK} strokeOpacity="0.2" strokeWidth="2" />
  </g>
);

/** Nouveautés produit : jalons de versions sur une ligne de temps. */
const Jalons = ({ c }: { c: string }) => (
  <g>
    <line x1="500" y1="300" x2="1160" y2="300" stroke={INK} strokeOpacity="0.18" strokeWidth="2" />
    {[0, 1, 2, 3].map((i) => {
      const x = 560 + i * 200;
      const dernier = i === 3;
      return (
        <g key={i}>
          <line x1={x} y1={dernier ? 190 : 250} x2={x} y2={300} stroke={dernier ? c : INK} strokeOpacity={dernier ? 0.8 : 0.2} strokeWidth="2" />
          <circle cx={x} cy="300" r={dernier ? 15 : 9} fill={dernier ? c : "#F5F3EF"} stroke={dernier ? c : INK} strokeOpacity={dernier ? 1 : 0.3} strokeWidth="2" />
          {dernier && <circle cx={x} cy="300" r="5" fill="#F5F3EF" />}
          <rect x={x - 46} y={dernier ? 150 : 214} width="92" height="26" rx="13" fill={dernier ? c : INK} opacity={dernier ? 0.85 : 0.1} />
        </g>
      );
    })}
  </g>
);

/** Info rapide : une question, une réponse qui se détache. */
const Question = ({ c }: { c: string }) => (
  <g>
    <text x="620" y="400" fill={INK} fillOpacity="0.09" fontSize="300" fontWeight="900" fontFamily="'Poppins', sans-serif" textAnchor="middle">?</text>
    {/* Bloc « réponse » qui se pose */}
    <rect x="760" y="200" width="330" height="18" rx="9" fill={c} opacity="0.85" />
    {[0, 1, 2].map((i) => (
      <rect key={i} x="760" y={244 + i * 34} width={300 - i * 62} height="14" rx="7" fill={INK} opacity="0.14" />
    ))}
    <path d="M 700 300 L 745 300" stroke={c} strokeWidth="3" strokeLinecap="round" />
    <path d="M 745 300 l -12 -8 v 16 z" fill={c} />
    <circle cx="1108" cy="209" r="10" fill={c} />
  </g>
);

const MOTIFS = {
  grille: Grille,
  atelier: Atelier,
  routes: Routes,
  couches: Couches,
  devises: Devises,
  jalons: Jalons,
  question: Question,
};

/**
 * VALEURS DE REPLI — et pourquoi elles existent.
 *
 * `motif` et `accent` sont FACULTATIFS : la colonne est `NULL`-able en base, et
 * un article écrit à la main peut ne pas les renseigner — c'est le cas de
 * l'article de démonstration.
 *
 * Sans repli, `MOTIFS[motif]` valait `undefined`, et React refusait de rendre
 * `<undefined />` : « Minified React error #130 ». Le panel ENTIER s'effondrait
 * — écran rouge, plus d'accès à l'article — simplement parce qu'une donnée
 * facultative était absente. Le 6 septembre 2026, ouvrir l'article de
 * démonstration depuis la liste rendait le panel inutilisable.
 *
 * Une couverture est une décoration. Elle ne doit jamais empêcher de lire ni de
 * corriger un texte : à valeur manquante ou inconnue, on dessine celle par
 * défaut plutôt que de tout arrêter.
 */
const MOTIF_PAR_DEFAUT: Motif = "grille";
const ACCENT_PAR_DEFAUT: Accent = "office";

/**
 * Couverture d'article.
 * `titreFantome` : le lettrage géant en filaire, repris du langage du site.
 */
const Cover = ({
  motif,
  accent,
  titreFantome,
  etiquette,
  className = "",
  vtName,
}: {
  motif: Motif;
  accent: Accent;
  titreFantome: string;
  etiquette: string;
  className?: string;
  /**
   * Identité de transition. Quand la même valeur est portée par la vignette
   * d'une page et par la couverture pleine largeur de l'autre, le navigateur
   * anime le passage de l'une à l'autre au lieu d'un simple fondu.
   */
  vtName?: string;
}) => {
  /* `?? ` ne suffirait pas : la valeur peut être une chaîne inconnue venue de
     la base — « bleu », « ancien-motif » — et non seulement `null`. On teste
     donc la présence dans la table, ce qui couvre les deux cas. */
  const motifSur = MOTIFS[motif] ? motif : MOTIF_PAR_DEFAUT;
  const accentSur = ACCENTS[accent] ? accent : ACCENT_PAR_DEFAUT;

  const c = ACCENTS[accentSur];
  const Motif = MOTIFS[motifSur];
  const id = `${motifSur}-${accentSur}`;

  return (
    <svg
      viewBox="0 0 1200 600"
      className={className}
      style={vtName ? { viewTransitionName: vtName } : undefined}
      role="img"
      aria-label={`Illustration : ${etiquette}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Fond id={id} />
      {/* Lettrage fantôme, en filaire, comme les filigranes du site */}
      <text
        x="40"
        y="330"
        fill="none"
        stroke={INK}
        strokeOpacity="0.16"
        strokeWidth="2"
        fontSize="190"
        fontWeight="900"
        letterSpacing="-8"
        fontFamily="'Poppins', sans-serif"
      >
        {titreFantome}
      </text>
      <Motif c={c} />
      <FiletTricolore />
      <Etiquette texte={etiquette} />
    </svg>
  );
};

/**
 * ---------------------------------------------------------------------------
 * LA VIGNETTE D'UN ARTICLE : IMAGE OU COUVERTURE VECTORIELLE
 * ---------------------------------------------------------------------------
 *
 * Un article qui porte une `image` l'affiche. Sinon, il garde sa couverture
 * vectorielle -- et ce n'est pas un repli au rabais : quelques kilo-octets,
 * aucune requête réseau, netteté parfaite à toute taille, et une signature que
 * personne d'autre ne peut avoir.
 *
 * Le choix se fait ICI, une seule fois, plutôt que dans chacune des cinq pages
 * qui affichent une couverture. Sans cela, ajouter l'image à quatre endroits sur
 * cinq aurait donné un blog où la vignette change selon la page d'où l'on vient.
 *
 * `vtName` est conservé dans les deux cas : c'est lui qui fait glisser la
 * vignette de la liste vers la page de l'article pendant la transition.
 */
export const Vignette = ({
  image,
  motif,
  accent,
  titreFantome,
  etiquette,
  className = "",
  vtName,
  alt,
}: {
  image?: string;
  motif: Motif;
  accent: Accent;
  titreFantome: string;
  etiquette: string;
  className?: string;
  vtName?: string;
  /** Texte alternatif. À défaut, le titre de l'article. */
  alt?: string;
}) =>
  image ? (
    <img
      src={image}
      alt={alt ?? etiquette}
      loading="lazy"
      decoding="async"
      className={`object-cover ${className}`}
      style={vtName ? ({ viewTransitionName: vtName } as React.CSSProperties) : undefined}
    />
  ) : (
    <Cover
      motif={motif}
      accent={accent}
      titreFantome={titreFantome}
      etiquette={etiquette}
      className={className}
      vtName={vtName}
    />
  );

export default Cover;
