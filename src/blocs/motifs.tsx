import { coordonnees, type Position } from "@/blog/Fond";
import type { Accent } from "@/blog/covers";

/**
 * Motifs de filigrane — bibliothèque métier.
 *
 * Le choix des motifs n'est pas esthétique, il est commercial. Megasoft sert
 * des laboratoires, des concessionnaires, des transporteurs, des banques, des
 * industriels, de l'agroalimentaire, du bâtiment, du secteur public. Un lecteur
 * qui reconnaît SON métier dans le fond d'un article reste ; un lecteur qui voit
 * un décor générique passe.
 *
 * Chaque motif est donc soit un signal sectoriel, soit un signal de valeur
 * (conformité, traçabilité, croissance, sécurité) — jamais un ornement.
 *
 * Tous respectent la même grammaire : trait fin, terminaisons rondes, couleur
 * du pôle en accent, encre pour le reste, opacités basses pour rester sous le
 * texte.
 */

const HEX: Record<Accent, string> = { office: "#3B82F6", digital: "#EC4899", service: "#22C55E" };
const INK = "#0F172A";

type P = { accent: Accent; position: Position };

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    className="absolute inset-0 w-full h-full"
    viewBox="0 0 1440 900"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/* ========================================================================= */

/** Conformité — la balance. Comptabilité, SCF, audit, IAS/IFRS. */
export const Conformite = ({ accent, position }: P) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g stroke={HEX[accent]} strokeOpacity="0.22" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d={`M ${a.x} ${a.y - 220} V ${a.y + 190}`} />
        <path d={`M ${a.x - 200} ${a.y - 180} H ${a.x + 200}`} />
        <path d={`M ${a.x - 110} ${a.y + 190} H ${a.x + 110}`} />
        <path d={`M ${a.x - 200} ${a.y - 180} L ${a.x - 265} ${a.y - 30} A 68 68 0 0 0 ${a.x - 135} ${a.y - 30} Z`} />
        <path d={`M ${a.x + 200} ${a.y - 180} L ${a.x + 135} ${a.y - 30} A 68 68 0 0 0 ${a.x + 265} ${a.y - 30} Z`} />
      </g>
      <circle cx={a.x} cy={a.y - 180} r="14" fill={HEX[accent]} opacity="0.28" />
    </Svg>
  );
};

/** Traçabilité — champ de codes-barres. Stock, pharma, immobilisations. */
export const Tracabilite = ({ accent }: P) => (
  <Svg>
    <g>
      {Array.from({ length: 7 }, (_, ligne) =>
        Array.from({ length: 40 }, (_, i) => {
          const x = 40 + i * 36 + ((ligne % 2) * 18);
          const large = (i * 7 + ligne * 3) % 5 === 0;
          return (
            <rect
              key={`${ligne}-${i}`}
              x={x}
              y={70 + ligne * 128}
              width={large ? 9 : 4}
              height="82"
              rx="2"
              fill={large ? HEX[accent] : INK}
              opacity={large ? 0.14 : 0.055}
            />
          );
        })
      )}
    </g>
  </Svg>
);

/** Chronologie — 1990 → aujourd'hui. Ancienneté, historique, jalons. */
export const Chronologie = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const annees = [1990, 1998, 2006, 2014, 2026];
  return (
    <Svg>
      <path d={`M 0 ${a.y} H 1440`} stroke={INK} strokeOpacity="0.12" strokeWidth="3" />
      {annees.map((an, i) => {
        const x = 150 + i * 290;
        const dernier = i === annees.length - 1;
        return (
          <g key={an}>
            <path d={`M ${x} ${a.y - (dernier ? 60 : 34)} V ${a.y}`} stroke={dernier ? HEX[accent] : INK} strokeOpacity={dernier ? 0.4 : 0.14} strokeWidth="3" />
            <circle cx={x} cy={a.y} r={dernier ? 13 : 8} fill={dernier ? HEX[accent] : INK} opacity={dernier ? 0.35 : 0.12} />
            <text
              x={x}
              y={a.y + 62}
              textAnchor="middle"
              fill={dernier ? HEX[accent] : INK}
              fillOpacity={dernier ? 0.3 : 0.11}
              fontSize="46"
              fontWeight="900"
              fontFamily="'Poppins', sans-serif"
            >
              {an}
            </text>
          </g>
        );
      })}
    </Svg>
  );
};

/** Entrepôt — rayonnages et palettes. Logistique, stock, approvisionnement. */
export const Entrepot = ({ accent }: P) => (
  <Svg>
    <g stroke={INK} strokeOpacity="0.1" strokeWidth="3" fill="none">
      {[0, 1, 2, 3].map((r) => (
        <g key={r} transform={`translate(0 ${120 + r * 200})`}>
          <path d="M 60 160 H 1380" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={80 + i * 150} y={60} width="110" height="100" rx="4" />
          ))}
        </g>
      ))}
    </g>
    <g fill={HEX[accent]} opacity="0.13">
      {[[230, 340], [830, 540], [1130, 740], [530, 140]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="110" height="100" rx="4" />
      ))}
    </g>
  </Svg>
);

/** Molécule — nœuds liés. Laboratoires, analyses, pharma. */
export const Molecule = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const n: [number, number][] = [
    [0, 0], [190, -120], [220, 130], [-180, 150], [-210, -110], [400, 20], [-400, 30], [60, 300], [40, -290],
  ];
  const liens = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 5], [3, 6], [4, 6], [2, 7], [3, 7], [1, 8], [4, 8]];
  return (
    <Svg>
      <g stroke={INK} strokeOpacity="0.1" strokeWidth="2.5">
        {liens.map(([i, j], k) => (
          <line key={k} x1={a.x + n[i][0]} y1={a.y + n[i][1]} x2={a.x + n[j][0]} y2={a.y + n[j][1]} />
        ))}
      </g>
      {n.map(([dx, dy], i) => (
        <circle
          key={i}
          cx={a.x + dx}
          cy={a.y + dy}
          r={i === 0 ? 32 : 19}
          fill={i % 3 === 0 ? HEX[accent] : INK}
          opacity={i % 3 === 0 ? 0.16 : 0.07}
        />
      ))}
    </Svg>
  );
};

/** Engrenages — mécanique. Automobile, GMAO, maintenance. */
export const Engrenages = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const roue = (cx: number, cy: number, r: number, dents: number, c: string, o: number) => (
    <g stroke={c} strokeOpacity={o} strokeWidth="7" fill="none">
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.42} />
      {Array.from({ length: dents }, (_, i) => {
        const ang = (i * Math.PI * 2) / dents;
        return (
          <line
            key={i}
            x1={cx + Math.cos(ang) * r}
            y1={cy + Math.sin(ang) * r}
            x2={cx + Math.cos(ang) * (r + 26)}
            y2={cy + Math.sin(ang) * (r + 26)}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
  return (
    <Svg>
      {roue(a.x, a.y, 165, 14, HEX[accent], 0.22)}
      {roue(a.x + 265, a.y - 155, 100, 10, INK, 0.1)}
      {roue(a.x - 235, a.y + 175, 85, 9, INK, 0.09)}
    </Svg>
  );
};

/** Croissance — histogramme ascendant et flèche. Résultats, rentabilité. */
export const Croissance = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const h = [70, 120, 100, 175, 155, 240, 220, 320];
  return (
    <Svg>
      <path d={`M ${a.x - 440} ${a.y + 200} H ${a.x + 460}`} stroke={INK} strokeOpacity="0.12" strokeWidth="3" />
      {h.map((v, i) => (
        <rect
          key={i}
          x={a.x - 420 + i * 108}
          y={a.y + 200 - v}
          width="66"
          height={v}
          rx="8"
          fill={i >= 5 ? HEX[accent] : INK}
          opacity={i >= 5 ? 0.16 : 0.07}
        />
      ))}
      <path
        d={`M ${a.x - 400} ${a.y + 120} L ${a.x - 100} ${a.y + 20} L ${a.x + 130} ${a.y - 60} L ${a.x + 400} ${a.y - 190}`}
        stroke={HEX[accent]}
        strokeOpacity="0.35"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={`M ${a.x + 400} ${a.y - 190} l -46 6 m 46 -6 l -8 -46`} stroke={HEX[accent]} strokeOpacity="0.35" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Svg>
  );
};

/** Baies serveurs — infrastructure, hébergement, sauvegarde. */
export const Serveurs = ({ accent }: P) => (
  <Svg>
    {[0, 1, 2, 3, 4].map((baie) => (
      <g key={baie} transform={`translate(${70 + baie * 280} 130)`}>
        <rect x="0" y="0" width="220" height="640" rx="12" stroke={INK} strokeOpacity="0.1" strokeWidth="3" fill="none" />
        {Array.from({ length: 9 }, (_, u) => (
          <g key={u}>
            <rect x="18" y={26 + u * 66} width="184" height="44" rx="6" fill={INK} opacity="0.05" />
            <circle cx={40} cy={48 + u * 66} r="6" fill={(u + baie) % 4 === 0 ? HEX[accent] : INK} opacity={(u + baie) % 4 === 0 ? 0.4 : 0.12} />
            <rect x={62} y={44 + u * 66} width={60 + ((u * 13 + baie * 7) % 90)} height="7" rx="3.5" fill={INK} opacity="0.08" />
          </g>
        ))}
      </g>
    ))}
  </Svg>
);

/** Méridiens — portée internationale. Groupes, export, multi-sites. */
export const Meridiens = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const R = 330;
  return (
    <Svg>
      <g stroke={INK} strokeOpacity="0.1" strokeWidth="2.5" fill="none">
        <circle cx={a.x} cy={a.y} r={R} stroke={HEX[accent]} strokeOpacity="0.2" strokeWidth="3.5" />
        {[0.28, 0.58, 0.85].map((k, i) => (
          <g key={i}>
            <ellipse cx={a.x} cy={a.y} rx={R * k} ry={R} />
            <line x1={a.x - R} y1={a.y - R * k} x2={a.x + R} y2={a.y - R * k} />
            <line x1={a.x - R} y1={a.y + R * k} x2={a.x + R} y2={a.y + R * k} />
          </g>
        ))}
        <line x1={a.x - R} y1={a.y} x2={a.x + R} y2={a.y} stroke={HEX[accent]} strokeOpacity="0.2" strokeWidth="3.5" />
        <line x1={a.x} y1={a.y - R} x2={a.x} y2={a.y + R} />
      </g>
    </Svg>
  );
};

/** Flux — processus qui s'enchaînent. Méthode, déploiement, chaîne de valeur. */
export const Flux = ({ accent }: P) => (
  <Svg>
    <g fill="none" strokeWidth="3" strokeLinecap="round">
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M -60 ${140 + i * 165} C 300 ${60 + i * 165}, 620 ${300 + i * 165}, 980 ${180 + i * 165} S 1360 ${60 + i * 165}, 1500 ${190 + i * 165}`}
          stroke={i % 2 ? HEX[accent] : INK}
          strokeOpacity={i % 2 ? 0.16 : 0.07}
        />
      ))}
    </g>
    {[[240, 205], [700, 380], [1120, 545], [430, 700]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="11" fill={HEX[accent]} opacity="0.22" />
    ))}
  </Svg>
);

/** Bouclier — sécurité, sauvegarde, conformité des données. */
export const Bouclier = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const b = (s: number, c: string, o: number) => (
    <path
      d={`M ${a.x} ${a.y - 260 * s}
          L ${a.x + 210 * s} ${a.y - 160 * s}
          V ${a.y + 40 * s}
          C ${a.x + 210 * s} ${a.y + 180 * s}, ${a.x + 100 * s} ${a.y + 250 * s}, ${a.x} ${a.y + 290 * s}
          C ${a.x - 100 * s} ${a.y + 250 * s}, ${a.x - 210 * s} ${a.y + 180 * s}, ${a.x - 210 * s} ${a.y + 40 * s}
          V ${a.y - 160 * s} Z`}
      fill="none"
      stroke={c}
      strokeOpacity={o}
      strokeWidth="6"
      strokeLinejoin="round"
    />
  );
  return (
    <Svg>
      {b(1, HEX[accent], 0.24)}
      {b(0.72, INK, 0.1)}
      <path
        d={`M ${a.x - 70} ${a.y + 10} l 55 60 l 105 -125`}
        fill="none"
        stroke={HEX[accent]}
        strokeOpacity="0.3"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

/** Planning — horloge et créneaux. Ordonnancement, APS, délais. */
export const Planning = ({ accent, position }: P) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g fill="none" stroke={INK} strokeOpacity="0.1" strokeWidth="3">
        <circle cx={a.x} cy={a.y} r="250" />
        {Array.from({ length: 12 }, (_, i) => {
          const ang = (i * Math.PI * 2) / 12 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={a.x + Math.cos(ang) * 210}
              y1={a.y + Math.sin(ang) * 210}
              x2={a.x + Math.cos(ang) * 250}
              y2={a.y + Math.sin(ang) * 250}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <path
        d={`M ${a.x} ${a.y} V ${a.y - 165}`}
        stroke={HEX[accent]}
        strokeOpacity="0.32"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M ${a.x} ${a.y} L ${a.x + 120} ${a.y + 78}`}
        stroke={HEX[accent]}
        strokeOpacity="0.32"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx={a.x} cy={a.y} r="14" fill={HEX[accent]} opacity="0.35" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={a.x + 320} y={a.y - 130 + i * 90} width={200 - i * 40} height="42" rx="21" fill={HEX[accent]} opacity={0.12 - i * 0.02} />
      ))}
    </Svg>
  );
};

/** Équipes — utilisateurs. Paie, RH, formation, adoption. */
export const Equipes = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const p = (dx: number, dy: number, s: number, c: string, o: number) => (
    <g fill={c} opacity={o}>
      <circle cx={a.x + dx} cy={a.y + dy} r={38 * s} />
      <path d={`M ${a.x + dx - 62 * s} ${a.y + dy + 122 * s} a ${62 * s} ${72 * s} 0 0 1 ${124 * s} 0 Z`} />
    </g>
  );
  return (
    <Svg>
      {p(0, 0, 1.25, HEX[accent], 0.16)}
      {p(-215, 55, 1, INK, 0.07)}
      {p(215, 55, 1, INK, 0.07)}
      {p(-410, 110, 0.8, INK, 0.05)}
      {p(410, 110, 0.8, INK, 0.05)}
    </Svg>
  );
};

/** Signature M — le monogramme en trame répétée. Identité pure. */
export const TrameM = ({ accent }: P) => (
  <Svg>
    <defs>
      <pattern id="trame-m" width="240" height="200" patternUnits="userSpaceOnUse">
        <g
          transform="translate(38 44) scale(0.62)"
          stroke={HEX[accent]}
          strokeOpacity="0.11"
          strokeWidth="46"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          <path d="M23 106 L104 27" />
          <path d="M118 106 L201 27 L205 106" />
        </g>
      </pattern>
    </defs>
    <rect width="1440" height="900" fill="url(#trame-m)" />
  </Svg>
);

/** Empreinte — arcs concentriques. Identité, unicité, signature. */
export const Empreinte = ({ accent, position }: P) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g fill="none" strokeLinecap="round">
        {Array.from({ length: 11 }, (_, i) => {
          const r = 60 + i * 42;
          const debut = -1.9 + (i % 3) * 0.24;
          const fin = 1.75 - (i % 4) * 0.22;
          const x1 = a.x + Math.cos(debut) * r;
          const y1 = a.y + Math.sin(debut) * r;
          const x2 = a.x + Math.cos(fin) * r;
          const y2 = a.y + Math.sin(fin) * r;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${fin - debut > Math.PI ? 1 : 0} 1 ${x2} ${y2}`}
              stroke={i % 3 === 0 ? HEX[accent] : INK}
              strokeOpacity={i % 3 === 0 ? 0.2 : 0.08}
              strokeWidth="5"
            />
          );
        })}
      </g>
    </Svg>
  );
};
