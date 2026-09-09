import Cover, { type Accent, type Motif } from "@/blog/covers";
import Fond, { coordonnees, type Position } from "@/blog/Fond";
import {
  Bouclier,
  Chronologie,
  Conformite,
  Croissance,
  Empreinte,
  Engrenages,
  Entrepot,
  Equipes,
  Flux,
  Meridiens,
  Molecule,
  Planning,
  Serveurs,
  TrameM,
  Tracabilite,
} from "./motifs";
import {
  Chevrons,
  Constellation,
  Convoyeur,
  FlechesLibres,
  Ondes,
  Orbites,
  Radar,
  Ruissellement,
  Spirale,
} from "./mouvement";

/**
 * Bibliothèque de fonds et de filigranes.
 *
 * Objectif marketing : qu'un article ne ressemble jamais à un document
 * administratif. Le fond doit poser une intention avant même la première ligne
 * — technique, commerciale, éditoriale — tout en restant dans la charte.
 *
 * L'administrateur choisit dans une bibliothèque fermée et règle la POSITION.
 * Il ne saisit jamais une couleur : les trois teintes de pôle sont les seules
 * disponibles, ce qui rend impossible la sortie de charte tout en laissant
 * dix-huit ambiances très différentes.
 */

export type { Position };
export const POSITIONS: Position[] = [
  "haut-gauche", "haut", "haut-droite",
  "gauche", "centre", "droite",
  "bas-gauche", "bas", "bas-droite",
];

const HEX: Record<Accent, string> = { office: "#3B82F6", digital: "#EC4899", service: "#22C55E" };
const INK = "#0F172A";

export type Famille = "Sobre" | "Lumière" | "Structure" | "Signature" | "Métier" | "Valeur" | "Flèches" | "Mouvement";

/**
 * Les motifs à flèches du blog, rendus empilables.
 *
 * Ils apportent trois choses d'un coup — trame de points, halos colorés et
 * flèches en pointillé qui dérivent lentement — et c'est justement ce qui les
 * rend efficaces comme socle d'ambiance. Ils gardent leur mot en filigrane.
 */
const Fleches =
  (motif: Motif, mot: string) =>
  ({ accent, position }: { accent: Accent; position: Position }) => (
    <Fond motif={motif} accent={accent} mot={mot} position={position} mode="absolu" />
  );

export type PresetFond = {
  cle: string;
  nom: string;
  /** À quel usage il convient — affiché en aide dans la bibliothèque. */
  note: string;
  famille: Famille;
  /** Texte clair attendu sur ce fond. */
  sombre?: boolean;
  /** Le preset exploite-t-il la position ? (sinon le sélecteur est grisé) */
  positionnable: boolean;
  base: string;
  Couche: (p: { accent: Accent; position: Position }) => JSX.Element | null;
};

/* =========================================================================
 * Briques réutilisables
 * ======================================================================= */

const Trame = ({ pas = 24, opacite = 0.05 }: { pas?: number; opacite?: number }) => (
  <div
    className="absolute inset-0"
    style={{
      backgroundImage: `radial-gradient(${INK}${Math.round(opacite * 255).toString(16).padStart(2, "0")} 1px, transparent 1px)`,
      backgroundSize: `${pas}px ${pas}px`,
    }}
  />
);

const Halo = ({ c, position, force = 0.18, rayon = 55 }: { c: string; position: Position; force?: number; rayon?: number }) => {
  const a = coordonnees(position);
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(ellipse ${rayon}% ${rayon * 0.8}% at ${a.xPct}% ${a.yPct}%, ${c}${Math.round(force * 255).toString(16).padStart(2, "0")}, transparent 70%)`,
      }}
    />
  );
};

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {children}
  </svg>
);

/* =========================================================================
 * SOBRE — lecture longue, discrétion
 * ======================================================================= */

const Papier = () => null;

const TramePoints = () => <Trame />;

const Millimetre = ({ accent }: { accent: Accent }) => (
  <div
    className="absolute inset-0"
    style={{
      backgroundImage: `linear-gradient(${HEX[accent]}14 1px, transparent 1px), linear-gradient(90deg, ${HEX[accent]}14 1px, transparent 1px), linear-gradient(${INK}0a 1px, transparent 1px), linear-gradient(90deg, ${INK}0a 1px, transparent 1px)`,
      backgroundSize: "100px 100px, 100px 100px, 20px 20px, 20px 20px",
    }}
  />
);

const Diagonales = ({ accent }: { accent: Accent }) => (
  <div
    className="absolute inset-0"
    style={{
      backgroundImage: `repeating-linear-gradient(135deg, ${HEX[accent]}0f 0px, ${HEX[accent]}0f 2px, transparent 2px, transparent 14px)`,
    }}
  />
);

/* =========================================================================
 * LUMIÈRE — halos, dégradés : l'ambiance la plus « marketing »
 * ======================================================================= */

const Aurore = ({ position }: { position: Position }) => {
  const a = coordonnees(position);
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at ${a.xPct}% ${a.yPct}%, ${HEX.office}2e, transparent 65%),
                       radial-gradient(ellipse 55% 45% at ${100 - a.xPct}% ${Math.min(a.yPct + 30, 95)}%, ${HEX.digital}26, transparent 65%),
                       radial-gradient(ellipse 50% 40% at ${a.xPct}% ${Math.min(a.yPct + 55, 100)}%, ${HEX.service}20, transparent 65%)`,
        }}
      />
      <Trame opacite={0.04} />
    </>
  );
};

const Projecteur = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle 46% at ${a.xPct}% ${a.yPct}%, ${HEX[accent]}2b, transparent 62%),
                       radial-gradient(circle 70% at ${a.xPct}% ${a.yPct}%, transparent 40%, ${INK}0d 100%)`,
        }}
      />
      <Trame opacite={0.045} />
    </>
  );
};

const Prisme = ({ position }: { position: Position }) => {
  const a = coordonnees(position);
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `conic-gradient(from 210deg at ${a.xPct}% ${a.yPct}%, ${HEX.office}24, ${HEX.digital}22, ${HEX.service}20, ${HEX.office}24)`,
        maskImage: "radial-gradient(ellipse 85% 75% at 50% 40%, black, transparent)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 40%, black, transparent)",
      }}
    />
  );
};

const Bulles = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  const cercles = [
    { dx: 0, dy: 0, r: 210, o: 0.2, c: HEX[accent] },
    { dx: 260, dy: 150, r: 150, o: 0.14, c: HEX.digital },
    { dx: -220, dy: 190, r: 175, o: 0.12, c: HEX.service },
    { dx: 130, dy: -170, r: 120, o: 0.16, c: HEX.office },
  ];
  return (
    <Svg>
      <defs>
        <filter id="flou-bulles" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="55" />
        </filter>
      </defs>
      <g filter="url(#flou-bulles)">
        {cercles.map((c, i) => (
          <circle key={i} cx={a.x + c.dx} cy={a.y + c.dy} r={c.r} fill={c.c} opacity={c.o} />
        ))}
      </g>
    </Svg>
  );
};

const Rayons = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <defs>
        <mask id="masque-rayons">
          <radialGradient id="deg-rayons" cx={`${a.xPct}%`} cy={`${a.yPct}%`} r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <rect width="1440" height="900" fill="url(#deg-rayons)" />
        </mask>
      </defs>
      <g mask="url(#masque-rayons)">
        {Array.from({ length: 18 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 18;
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} L ${a.x + Math.cos(angle) * 1500} ${a.y + Math.sin(angle) * 1500}`}
              stroke={HEX[accent]}
              strokeWidth={i % 2 ? 26 : 12}
              opacity="0.07"
            />
          );
        })}
      </g>
    </Svg>
  );
};

/* =========================================================================
 * STRUCTURE — technique, industriel : parle aux clients ERP/MES
 * ======================================================================= */

const Blueprint = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${HEX[accent]}12 1px, transparent 1px), linear-gradient(90deg, ${HEX[accent]}12 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />
      <Svg>
        <g stroke={HEX[accent]} strokeOpacity="0.3" strokeWidth="1.5" fill="none">
          <circle cx={a.x} cy={a.y} r="120" strokeDasharray="6 8" />
          <circle cx={a.x} cy={a.y} r="200" strokeDasharray="6 8" opacity="0.6" />
          <path d={`M ${a.x - 260} ${a.y} H ${a.x + 260}`} />
          <path d={`M ${a.x} ${a.y - 260} V ${a.y + 260}`} />
        </g>
        <circle cx={a.x} cy={a.y} r="6" fill={HEX[accent]} opacity="0.5" />
      </Svg>
    </>
  );
};

const Isometrique = ({ accent }: { accent: Accent }) => (
  <div
    className="absolute inset-0"
    style={{
      backgroundImage: `repeating-linear-gradient(30deg, ${HEX[accent]}12 0 1px, transparent 1px 44px),
                        repeating-linear-gradient(-30deg, ${HEX[accent]}12 0 1px, transparent 1px 44px),
                        repeating-linear-gradient(90deg, ${INK}0a 0 1px, transparent 1px 44px)`,
    }}
  />
);

const Circuit = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  const traces = [
    `M ${a.x - 420} ${a.y - 200} h 180 v -120 h 220`,
    `M ${a.x - 420} ${a.y + 40} h 260 v 160 h 300`,
    `M ${a.x + 420} ${a.y - 60} h -200 v 140 h -180`,
    `M ${a.x + 120} ${a.y - 320} v 180 h 260`,
    `M ${a.x - 120} ${a.y + 300} v -160 h -240`,
  ];
  return (
    <Svg>
      <g stroke={HEX[accent]} strokeOpacity="0.22" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {traces.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {traces.map((d, i) => {
        const m = d.match(/M ([\d.-]+) ([\d.-]+)/);
        return m ? <circle key={i} cx={Number(m[1])} cy={Number(m[2])} r="7" fill={HEX[accent]} opacity="0.35" /> : null;
      })}
      <Trame />
    </Svg>
  );
};

const Topographie = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g fill="none" stroke={HEX[accent]} strokeOpacity="0.17" strokeWidth="1.8">
        {Array.from({ length: 9 }, (_, i) => {
          const e = 90 + i * 78;
          return (
            <path
              key={i}
              d={`M ${a.x - e * 1.5} ${a.y}
                  C ${a.x - e} ${a.y - e * 0.85}, ${a.x + e * 0.6} ${a.y - e * 1.1}, ${a.x + e * 1.5} ${a.y - e * 0.15}
                  C ${a.x + e * 2} ${a.y + e * 0.5}, ${a.x + e * 0.4} ${a.y + e * 1.15}, ${a.x - e * 0.8} ${a.y + e * 0.8}
                  C ${a.x - e * 1.7} ${a.y + e * 0.55}, ${a.x - e * 1.8} ${a.y + e * 0.2}, ${a.x - e * 1.5} ${a.y} Z`}
            />
          );
        })}
      </g>
    </Svg>
  );
};

const Hexagones = ({ accent }: { accent: Accent }) => (
  <Svg>
    <defs>
      <pattern id="hex" width="56" height="97" patternUnits="userSpaceOnUse">
        <path
          d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 64 L56 80 M28 64 L0 80"
          fill="none"
          stroke={HEX[accent]}
          strokeOpacity="0.16"
          strokeWidth="1.4"
        />
      </pattern>
    </defs>
    <rect width="1440" height="900" fill="url(#hex)" />
  </Svg>
);

/* =========================================================================
 * SIGNATURE — fortement identitaire Megasoft
 * ======================================================================= */

const RubanTricolore = ({ position }: { position: Position }) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g transform={`rotate(-24 ${a.x} ${a.y})`}>
        {[HEX.office, HEX.digital, HEX.service].map((c, i) => (
          <rect key={c} x={-400} y={a.y - 150 + i * 92} width="2400" height="64" fill={c} opacity={0.13 - i * 0.02} />
        ))}
      </g>
      <Trame opacite={0.04} />
    </Svg>
  );
};

const Encre = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 55% at ${a.xPct}% ${a.yPct}%, ${HEX[accent]}40, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
    </>
  );
};

const Monogramme = ({ accent, position }: { accent: Accent; position: Position }) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g
        transform={`translate(${a.x - 340} ${a.y - 200}) scale(3)`}
        stroke={HEX[accent]}
        strokeOpacity="0.1"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M23 106 L104 27" />
        <path d="M118 106 L201 27 L205 106" />
      </g>
      <Trame opacite={0.04} />
    </Svg>
  );
};

const FiletsRepetes = () => (
  <Svg>
    {Array.from({ length: 7 }, (_, i) => (
      <g key={i} transform={`translate(0 ${70 + i * 128})`} opacity={0.5}>
        <rect x="60" y="0" width="120" height="5" rx="2.5" fill={HEX.office} opacity="0.22" />
        <rect x="190" y="0" width="120" height="5" rx="2.5" fill={HEX.digital} opacity="0.2" />
        <rect x="320" y="0" width="120" height="5" rx="2.5" fill={HEX.service} opacity="0.18" />
        <rect x="1000" y="0" width="120" height="5" rx="2.5" fill={HEX.service} opacity="0.14" />
        <rect x="1130" y="0" width="120" height="5" rx="2.5" fill={HEX.office} opacity="0.16" />
      </g>
    ))}
  </Svg>
);

/* =========================================================================
 * LA BIBLIOTHÈQUE
 * ======================================================================= */

export const PRESETS_FOND: PresetFond[] = [
  // ---- Sobre
  { cle: "papier", nom: "Papier", note: "Neutre. Le fond de référence, confortable en lecture longue.", famille: "Sobre", positionnable: false, base: "bg-background", Couche: Papier },
  { cle: "points", nom: "Trame de points", note: "Texture discrète. Donne du relief sans distraire.", famille: "Sobre", positionnable: false, base: "bg-background", Couche: TramePoints },
  { cle: "millimetre", nom: "Papier millimétré", note: "Rigueur technique. Pour les sujets méthode et chiffrage.", famille: "Sobre", positionnable: false, base: "bg-background", Couche: ({ accent }) => <Millimetre accent={accent} /> },
  { cle: "diagonales", nom: "Diagonales", note: "Rayures fines. Dynamise sans peser.", famille: "Sobre", positionnable: false, base: "bg-background", Couche: ({ accent }) => <Diagonales accent={accent} /> },

  // ---- Lumière
  { cle: "aurore", nom: "Aurore", note: "Les trois pôles en dégradés fondus. Le plus spectaculaire — idéal en une.", famille: "Lumière", positionnable: true, base: "bg-background", Couche: ({ position }) => <Aurore position={position} /> },
  { cle: "projecteur", nom: "Projecteur", note: "Une zone éclairée, le reste en retrait. Concentre le regard.", famille: "Lumière", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Projecteur accent={accent} position={position} /> },
  { cle: "prisme", nom: "Prisme", note: "Balayage circulaire tricolore. Très contemporain.", famille: "Lumière", positionnable: true, base: "bg-background", Couche: ({ position }) => <Prisme position={position} /> },
  { cle: "bulles", nom: "Bulles floutées", note: "Masses colorées diffuses. Chaleureux, adapté aux sujets humains.", famille: "Lumière", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Bulles accent={accent} position={position} /> },
  { cle: "rayons", nom: "Rayons", note: "Faisceau depuis un point. Effet d'annonce, très accrocheur.", famille: "Lumière", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Rayons accent={accent} position={position} /> },

  // ---- Structure
  { cle: "blueprint", nom: "Plan technique", note: "Grille et cibles de visée. Parle aux clients industriels.", famille: "Structure", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Blueprint accent={accent} position={position} /> },
  { cle: "isometrique", nom: "Isométrique", note: "Volume et profondeur. Infrastructure, cloud, architecture.", famille: "Structure", positionnable: false, base: "bg-background", Couche: ({ accent }) => <Isometrique accent={accent} /> },
  { cle: "circuit", nom: "Circuit", note: "Pistes et nœuds. Signale un contenu résolument logiciel.", famille: "Structure", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Circuit accent={accent} position={position} /> },
  { cle: "topographie", nom: "Topographie", note: "Courbes de niveau. Élégant et premium, très distinctif.", famille: "Structure", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Topographie accent={accent} position={position} /> },
  { cle: "hexagones", nom: "Hexagones", note: "Maillage régulier. Évoque le réseau et la modularité.", famille: "Structure", positionnable: false, base: "bg-background", Couche: ({ accent }) => <Hexagones accent={accent} /> },

  // ---- Signature
  { cle: "ruban", nom: "Ruban tricolore", note: "Les trois pôles en bandes obliques. La signature la plus directe.", famille: "Signature", positionnable: true, base: "bg-background", Couche: ({ position }) => <RubanTricolore position={position} /> },
  { cle: "monogramme", nom: "Monogramme", note: "Le M en très grand, en filigrane. Sobre et immédiatement reconnaissable.", famille: "Signature", positionnable: true, base: "bg-background", Couche: ({ accent, position }) => <Monogramme accent={accent} position={position} /> },
  { cle: "filets", nom: "Filets répétés", note: "Rythme tricolore sur toute la hauteur. Très éditorial.", famille: "Signature", positionnable: false, base: "bg-background", Couche: FiletsRepetes },
  { cle: "encre", nom: "Encre", note: "Fond sombre, texte clair. Impact maximal — à réserver aux annonces.", famille: "Signature", sombre: true, positionnable: true, base: "bg-ms-dark", Couche: ({ accent, position }) => <Encre accent={accent} position={position} /> },
  { cle: "trame-m", nom: "Trame monogramme", note: "Le M répété en filigrane régulier. Marquage de marque le plus dense.", famille: "Signature", positionnable: false, base: "bg-transparent", Couche: TrameM },

  // ---- Métier : le lecteur doit reconnaître SON secteur
  { cle: "conformite", nom: "Conformité", note: "La balance. Comptabilité, SCF, audit, normes IAS/IFRS.", famille: "Métier", positionnable: true, base: "bg-transparent", Couche: Conformite },
  { cle: "tracabilite", nom: "Traçabilité", note: "Champ de codes-barres. Stock, pharma, immobilisations.", famille: "Métier", positionnable: false, base: "bg-transparent", Couche: Tracabilite },
  { cle: "entrepot", nom: "Entrepôt", note: "Rayonnages et palettes. Logistique, approvisionnement.", famille: "Métier", positionnable: false, base: "bg-transparent", Couche: Entrepot },
  { cle: "molecule", nom: "Laboratoire", note: "Nœuds liés. Analyses médicales, pharmacie, qualité.", famille: "Métier", positionnable: true, base: "bg-transparent", Couche: Molecule },
  { cle: "engrenages", nom: "Mécanique", note: "Engrenages imbriqués. Automobile, GMAO, maintenance.", famille: "Métier", positionnable: true, base: "bg-transparent", Couche: Engrenages },
  { cle: "serveurs", nom: "Baies serveurs", note: "Racks et voyants. Infrastructure, hébergement, sauvegarde.", famille: "Métier", positionnable: false, base: "bg-transparent", Couche: Serveurs },
  { cle: "planning", nom: "Ordonnancement", note: "Horloge et créneaux. APS, planification, délais.", famille: "Métier", positionnable: true, base: "bg-transparent", Couche: Planning },
  { cle: "equipes", nom: "Équipes", note: "Silhouettes. Paie, RH, formation, adoption utilisateurs.", famille: "Métier", positionnable: true, base: "bg-transparent", Couche: Equipes },

  // ---- Valeur : ce que le client vient chercher
  { cle: "croissance", nom: "Croissance", note: "Histogramme et courbe ascendante. Résultats, rentabilité, marge.", famille: "Valeur", positionnable: true, base: "bg-transparent", Couche: Croissance },
  { cle: "bouclier", nom: "Sécurité", note: "Bouclier et validation. Données, sauvegardes, conformité.", famille: "Valeur", positionnable: true, base: "bg-transparent", Couche: Bouclier },
  { cle: "meridiens", nom: "International", note: "Méridiens. Groupes, export, multi-sites.", famille: "Valeur", positionnable: true, base: "bg-transparent", Couche: Meridiens },
  { cle: "flux", nom: "Flux de processus", note: "Lignes qui s'enchaînent. Méthode, déploiement, chaîne de valeur.", famille: "Valeur", positionnable: false, base: "bg-transparent", Couche: Flux },
  { cle: "chronologie", nom: "Chronologie 1990", note: "Frise des trente-cinq ans. Ancienneté et solidité.", famille: "Valeur", positionnable: true, base: "bg-transparent", Couche: Chronologie },
  { cle: "empreinte", nom: "Empreinte", note: "Arcs concentriques. Identité, unicité, savoir-faire propre.", famille: "Valeur", positionnable: true, base: "bg-transparent", Couche: Empreinte },

  // ---- Flèches : trame + halos + flèches animées, en un seul calque
  { cle: "fl-registre", nom: "Registre", note: "Flèches descendantes, comme une écriture qui se pose. Comptabilité, SCF.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("grille", "COÛT") },
  { cle: "fl-cadence", nom: "Cadence", note: "Flèches montantes, rythme d'atelier. Production, MES.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("atelier", "MES") },
  { cle: "fl-reseau", nom: "Réseau", note: "Flèches qui serpentent, comme un itinéraire. Transport, TMS.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("routes", "TMS") },
  { cle: "fl-strates", nom: "Strates", note: "Flèches qui traversent les couches. Infrastructure, cloud.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("couches", "CLOUD") },
  { cle: "fl-devises", nom: "Devises", note: "Monnaies du monde et flèches convergentes. Offres et tarifs.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("devises", "OFFRE") },
  { cle: "fl-jalons", nom: "Jalons", note: "Progression franche vers la droite. Annonces de version.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("jalons", "V12") },
  { cle: "fl-question", nom: "Question", note: "Flèches courtes, droit au but. Info rapide, FAQ.", famille: "Flèches", positionnable: true, base: "bg-background", Couche: Fleches("question", "?") },

  // ---- Mouvement : le pointillé qui dérive, enfin combinable avec tout
  { cle: "mv-fleches", nom: "Flèches libres", note: "Quatre courbes qui convergent vers l'ancre. Le motif d'origine, posable sur n'importe quel fond.", famille: "Mouvement", positionnable: true, base: "bg-transparent", Couche: FlechesLibres },
  { cle: "mv-convoyeur", nom: "Convoyeur", note: "Bandes horizontales qui défilent. Expédition, chaîne, cadence.", famille: "Mouvement", positionnable: false, base: "bg-transparent", Couche: Convoyeur },
  { cle: "mv-ruissellement", nom: "Ruissellement", note: "Filets verticaux qui descendent. Saisie, écritures, flux de données.", famille: "Mouvement", positionnable: false, base: "bg-transparent", Couche: Ruissellement },
  { cle: "mv-orbites", nom: "Orbites", note: "Ellipses en pointillé qui tournent. Cycles, récurrence, abonnement.", famille: "Mouvement", positionnable: true, base: "bg-transparent", Couche: Orbites },
  { cle: "mv-radar", nom: "Balayage radar", note: "Arcs et aiguille rotative. Veille, contrôle, audit.", famille: "Mouvement", positionnable: true, base: "bg-transparent", Couche: Radar },
  { cle: "mv-ondes", nom: "Ondes", note: "Sinusoïdes en pointillé. Signal, transmission, communication.", famille: "Mouvement", positionnable: false, base: "bg-transparent", Couche: Ondes },
  { cle: "mv-constellation", nom: "Constellation", note: "Nœuds reliés, points pulsants. Réseau, intégration, interfaces.", famille: "Mouvement", positionnable: true, base: "bg-transparent", Couche: Constellation },
  { cle: "mv-chevrons", nom: "Chevrons", note: "Progression par paliers. Étapes, déploiement, montée en charge.", famille: "Mouvement", positionnable: false, base: "bg-transparent", Couche: Chevrons },
  { cle: "mv-spirale", nom: "Spirale", note: "Enroulement continu. Amélioration continue, itération.", famille: "Mouvement", positionnable: true, base: "bg-transparent", Couche: Spirale },
];

export const FAMILLES: Famille[] = ["Mouvement", "Flèches", "Lumière", "Métier", "Valeur", "Structure", "Signature", "Sobre"];
export const parCleFond = (cle: string) => PRESETS_FOND.find((f) => f.cle === cle) ?? PRESETS_FOND[0];

/** Rend un fond seul — utilisé pour les vignettes de la bibliothèque. */
export const RenduFond = ({
  preset,
  accent,
  position,
}: {
  preset: PresetFond;
  accent: Accent;
  position: Position;
}) => (
  <div className={`absolute inset-0 overflow-hidden ${preset.base}`} aria-hidden="true">
    <preset.Couche accent={accent} position={position} />
  </div>
);

/* =========================================================================
 * PILE DE CALQUES
 * =========================================================================
 * « Un fond + un filigrane » ne suffisait pas : on veut pouvoir poser une
 * lumière, puis une signature par-dessus, puis un motif métier. C'est la façon
 * dont raisonnent les outils de composition — et c'est ce qui permet de
 * fabriquer des ambiances qu'aucune liste finie de presets ne contiendrait.
 *
 * Chaque calque garde sa couleur, sa position et son opacité propres, donc deux
 * articles utilisant les mêmes presets ne se ressemblent pas nécessairement.
 */

export type Calque = {
  /** Identifiant du calque dans la pile (pas celui du preset). */
  id: string;
  preset: string;
  accent: Accent;
  position: Position;
  /** Multiplicateur d'intensité, 0 à 1. Indispensable en superposition. */
  opacite: number;
};

export const calqueParDefaut = (preset: string, accent: Accent = "office"): Calque => ({
  id: `c_${Math.random().toString(36).slice(2, 8)}`,
  preset,
  accent,
  position: "centre",
  opacite: 1,
});

/**
 * Rend la pile complète, du premier calque au dernier.
 *
 * Le premier calque pose la couleur de base ; les suivants sont
 * systématiquement transparents pour ne pas masquer ceux d'en dessous — sans
 * quoi superposer n'aurait aucun sens.
 */
export const RenduPile = ({ calques }: { calques: Calque[] }) => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
    {calques.map((c, i) => {
      const preset = parCleFond(c.preset);
      return (
        <div
          key={c.id}
          className={`absolute inset-0 overflow-hidden ${i === 0 ? preset.base : "bg-transparent"}`}
          style={{ opacity: c.opacite }}
        >
          <preset.Couche accent={c.accent} position={c.position} />
        </div>
      );
    })}
  </div>
);

/** La pile contient-elle un calque sombre en base ? (le texte passe en clair) */
export const pileSombre = (calques: Calque[]) =>
  calques.length > 0 && parCleFond(calques[0].preset).sombre === true;

/* =========================================================================
 * FILIGRANES — compositions prêtes à l'emploi
 * =========================================================================
 * Une composition est une PILE calibrée : un socle d'ambiance, un motif qui
 * porte le sujet, parfois une signature de marque, chacun avec sa couleur, sa
 * position et son intensité déjà accordées.
 *
 * C'est le raccourci qui fait gagner du temps au quotidien : le rédacteur
 * choisit un sujet, pas trois calques. Et comme le résultat reste une pile
 * ordinaire, il peut ensuite ajuster, retirer ou compléter n'importe quel
 * calque — la composition est un point de départ, jamais une contrainte.
 *
 * Règle de dosage appliquée partout : un socle à pleine intensité, un motif de
 * sujet entre 30 et 50 %, une signature sous 25 %. Au-delà, le texte souffre.
 */

export type Composition = {
  cle: string;
  nom: string;
  /** À quel type d'article elle convient. */
  usage: string;
  couches: { preset: string; accent: Accent; position: Position; opacite: number }[];
};

export const COMPOSITIONS: Composition[] = [
  {
    cle: "signature",
    nom: "Signature Megasoft",
    usage: "Le passe-partout de la marque. Convient à tout article sans sujet sectoriel marqué.",
    couches: [
      { preset: "aurore", accent: "office", position: "haut-droite", opacite: 1 },
      { preset: "monogramme", accent: "office", position: "bas-gauche", opacite: 0.3 },
    ],
  },
  {
    cle: "comptabilite",
    nom: "Comptabilité & SCF",
    usage: "Écritures, normes IAS/IFRS, audit, coûts de revient.",
    couches: [
      { preset: "fl-registre", accent: "service", position: "bas-droite", opacite: 1 },
      { preset: "conformite", accent: "service", position: "droite", opacite: 0.4 },
      { preset: "millimetre", accent: "service", position: "centre", opacite: 0.25 },
    ],
  },
  {
    cle: "atelier",
    nom: "Atelier en marche",
    usage: "Production, MES, cadence, ordres de fabrication.",
    couches: [
      { preset: "fl-cadence", accent: "office", position: "bas-gauche", opacite: 1 },
      { preset: "engrenages", accent: "office", position: "haut-droite", opacite: 0.32 },
      { preset: "blueprint", accent: "office", position: "centre", opacite: 0.2 },
    ],
  },
  {
    cle: "logistique",
    nom: "Chaîne logistique",
    usage: "TMS, tournées, entrepôt, approvisionnement.",
    couches: [
      { preset: "fl-reseau", accent: "digital", position: "haut-droite", opacite: 1 },
      { preset: "entrepot", accent: "digital", position: "centre", opacite: 0.28 },
      { preset: "flux", accent: "digital", position: "centre", opacite: 0.22 },
    ],
  },
  {
    cle: "offre",
    nom: "Offre commerciale",
    usage: "Tarifs, formules, plans de paiement. Le fond le plus orienté conversion.",
    couches: [
      { preset: "fl-devises", accent: "digital", position: "haut", opacite: 1 },
      { preset: "croissance", accent: "digital", position: "bas", opacite: 0.35 },
    ],
  },
  {
    cle: "annonce",
    nom: "Annonce produit",
    usage: "Sortie de version, nouveau module. Fond sombre, impact maximal.",
    couches: [
      { preset: "encre", accent: "office", position: "haut-droite", opacite: 1 },
      { preset: "chronologie", accent: "office", position: "bas", opacite: 0.45 },
      { preset: "trame-m", accent: "office", position: "centre", opacite: 0.14 },
    ],
  },
  {
    cle: "laboratoire",
    nom: "Laboratoire & pharma",
    usage: "MEGA LAB, MEGA PHARMA, analyses, qualité.",
    couches: [
      { preset: "projecteur", accent: "service", position: "haut-droite", opacite: 1 },
      { preset: "molecule", accent: "service", position: "gauche", opacite: 0.34 },
      { preset: "hexagones", accent: "service", position: "centre", opacite: 0.18 },
    ],
  },
  {
    cle: "infrastructure",
    nom: "Infrastructure & cloud",
    usage: "Hébergement, desktop contre cloud, architecture technique.",
    couches: [
      { preset: "fl-strates", accent: "digital", position: "droite", opacite: 1 },
      { preset: "serveurs", accent: "digital", position: "centre", opacite: 0.24 },
      { preset: "isometrique", accent: "digital", position: "centre", opacite: 0.2 },
    ],
  },
  {
    cle: "securite",
    nom: "Sécurité des données",
    usage: "Sauvegardes, conformité, continuité d'activité.",
    couches: [
      { preset: "projecteur", accent: "office", position: "centre", opacite: 1 },
      { preset: "bouclier", accent: "office", position: "centre", opacite: 0.34 },
      { preset: "circuit", accent: "office", position: "bas-droite", opacite: 0.18 },
    ],
  },
  {
    cle: "international",
    nom: "Groupe international",
    usage: "Grands comptes, multi-sites, export. Rassure sur la capacité à suivre.",
    couches: [
      { preset: "aurore", accent: "office", position: "haut", opacite: 1 },
      { preset: "meridiens", accent: "office", position: "droite", opacite: 0.28 },
    ],
  },
  {
    cle: "rh",
    nom: "Paie & ressources humaines",
    usage: "MEGA PAYE, GRH, formation, adoption des équipes.",
    couches: [
      { preset: "bulles", accent: "service", position: "haut-droite", opacite: 1 },
      { preset: "equipes", accent: "service", position: "bas-gauche", opacite: 0.32 },
    ],
  },
  {
    cle: "heritage",
    nom: "Trente-cinq ans de terrain",
    usage: "Qui sommes-nous, anniversaire, rétrospective. Joue l'ancienneté.",
    couches: [
      { preset: "ruban", accent: "office", position: "centre", opacite: 1 },
      { preset: "chronologie", accent: "office", position: "centre", opacite: 0.5 },
      { preset: "empreinte", accent: "office", position: "droite", opacite: 0.18 },
    ],
  },
  {
    cle: "planification",
    nom: "Planification & délais",
    usage: "MEGA APS, ordonnancement, tenue des engagements.",
    couches: [
      { preset: "blueprint", accent: "office", position: "gauche", opacite: 1 },
      { preset: "planning", accent: "office", position: "droite", opacite: 0.34 },
    ],
  },
  {
    cle: "tracabilite",
    nom: "Traçabilité",
    usage: "Codes-barres, inventaires, immobilisations, lots.",
    couches: [
      { preset: "projecteur", accent: "service", position: "haut", opacite: 1 },
      { preset: "tracabilite", accent: "service", position: "centre", opacite: 0.3 },
    ],
  },
  {
    cle: "question",
    nom: "Info rapide",
    usage: "Réponse courte à une question fréquente. Léger et lisible.",
    couches: [
      { preset: "fl-question", accent: "office", position: "haut-droite", opacite: 1 },
      { preset: "diagonales", accent: "office", position: "centre", opacite: 0.35 },
    ],
  },
  {
    cle: "editorial",
    nom: "Éditorial sobre",
    usage: "Analyse de fond, lecture longue. Le fond s'efface devant le texte.",
    couches: [
      { preset: "millimetre", accent: "office", position: "centre", opacite: 0.55 },
      { preset: "filets", accent: "office", position: "centre", opacite: 0.35 },
    ],
  },
];

/** Transforme une composition en pile éditable. */
export const instancierComposition = (c: Composition): Calque[] =>
  c.couches.map((x) => ({ ...calqueParDefaut(x.preset, x.accent), position: x.position, opacite: x.opacite }));

/* ------------------------------------------------------------------------- */

export type PresetFiligrane = {
  cle: string;
  nom: string;
  note: string;
  motif: Motif | null;
  accent: Accent;
  mot: string;
};

export const PRESETS_FILIGRANE: PresetFiligrane[] = [
  { cle: "aucun", nom: "Aucun", note: "Pas de filigrane.", motif: null, accent: "office", mot: "" },
  { cle: "registre", nom: "Registre", note: "Lignes comptables, flèches descendantes. Comptabilité, SCF.", motif: "grille", accent: "service", mot: "COÛT" },
  { cle: "atelier", nom: "Cadence", note: "Barres rythmées, flèches montantes. Production, MES.", motif: "atelier", accent: "office", mot: "MES" },
  { cle: "reseau", nom: "Réseau", note: "Nœuds et itinéraire. Transport, tournées, TMS.", motif: "routes", accent: "digital", mot: "TMS" },
  { cle: "strates", nom: "Strates", note: "Plans empilés. Infrastructure, cloud.", motif: "couches", accent: "digital", mot: "CLOUD" },
  { cle: "devises", nom: "Devises", note: "Dinar en tête, monnaies du monde. Offres et tarifs.", motif: "devises", accent: "digital", mot: "OFFRE" },
  { cle: "jalons", nom: "Jalons", note: "Frise de versions. Annonces produit.", motif: "jalons", accent: "office", mot: "V12" },
  { cle: "question", nom: "Question", note: "Point d'interrogation géant. Info rapide, FAQ.", motif: "question", accent: "office", mot: "?" },
];

export const parCleFiligrane = (cle: string) => PRESETS_FILIGRANE.find((f) => f.cle === cle) ?? PRESETS_FILIGRANE[0];

export const RenduFiligrane = ({ preset, position }: { preset: PresetFiligrane; position: Position }) =>
  preset.motif ? <Fond motif={preset.motif} accent={preset.accent} mot={preset.mot} position={position} /> : null;

export const VignetteFiligrane = ({ preset }: { preset: PresetFiligrane }) =>
  preset.motif ? (
    <Cover motif={preset.motif} accent={preset.accent} titreFantome={preset.mot} etiquette={preset.nom} className="w-full h-full block" />
  ) : (
    <div className="w-full h-full bg-ms-paper" />
  );
