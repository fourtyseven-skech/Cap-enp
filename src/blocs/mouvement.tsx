import { coordonnees, type Position } from "@/blog/Fond";
import type { Accent } from "@/blog/covers";

/**
 * Motifs de MOUVEMENT — la famille du trait en pointillé qui dérive.
 *
 * Le pointillé animé est la signature vivante du site, mais il restait
 * prisonnier des motifs du blog : impossible de le poser sur une Aurore ou un
 * Plan technique. Ces calques le libèrent — chacun est un motif autonome,
 * empilable sur n'importe quel fond, et déclinant la même idée dans une
 * direction différente : descente, avancée, orbite, balayage, ruissellement.
 *
 * Grammaire commune : trait fin en tirets courts, pointe optionnelle à la
 * couleur du pôle, dérive lente (voir index.css). L'animation se coupe seule
 * si le visiteur a demandé à réduire les animations.
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

/** Pointe de flèche partagée. */
const Pointe = ({ id, c }: { id: string; c: string }) => (
  <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M 0 1 L 9 5 L 0 9 z" fill={c} opacity="0.55" />
  </marker>
);

/* ========================================================================= */

/**
 * Flèches libres — le motif d'origine, enfin détachable.
 * Quatre courbes qui convergent vers l'ancre choisie.
 */
export const FlechesLibres = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const id = `fl-${accent}-${position}`;
  const trajets = [
    `M ${a.x - 620} ${a.y + 330} C ${a.x - 400} ${a.y + 150}, ${a.x - 300} ${a.y - 40}, ${a.x - 90} ${a.y - 60}`,
    `M ${a.x + 640} ${a.y + 300} C ${a.x + 420} ${a.y + 130}, ${a.x + 300} ${a.y - 20}, ${a.x + 95} ${a.y - 55}`,
    `M ${a.x - 40} ${a.y + 430} C ${a.x - 20} ${a.y + 280}, ${a.x - 30} ${a.y + 150}, ${a.x - 10} ${a.y + 70}`,
    `M ${a.x + 180} ${a.y - 400} C ${a.x + 140} ${a.y - 260}, ${a.x + 90} ${a.y - 180}, ${a.x + 40} ${a.y - 110}`,
  ];
  return (
    <Svg>
      <defs>
        <Pointe id={id} c={HEX[accent]} />
      </defs>
      {trajets.map((d, i) => (
        <path
          key={i}
          className={i % 2 ? "mvt-defile" : "mvt-defile-lent"}
          d={d}
          fill="none"
          stroke={HEX[accent]}
          strokeOpacity="0.38"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 15"
          markerEnd={`url(#${id})`}
          style={{ animationDelay: `${i * -5}s` }}
        />
      ))}
    </Svg>
  );
};

/** Convoyeur — bandes horizontales qui défilent. Logistique, expédition. */
export const Convoyeur = ({ accent }: P) => {
  const id = `cv-${accent}`;
  return (
    <Svg>
      <defs>
        <Pointe id={id} c={HEX[accent]} />
      </defs>
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={i}
          className={i % 2 ? "mvt-defile" : "mvt-defile-lent"}
          d={`M -60 ${110 + i * 145} H 1500`}
          fill="none"
          stroke={i % 2 ? HEX[accent] : INK}
          strokeOpacity={i % 2 ? 0.3 : 0.12}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="3 18"
          markerEnd={i % 2 ? `url(#${id})` : undefined}
          style={{ animationDelay: `${i * -3.5}s` }}
        />
      ))}
    </Svg>
  );
};

/** Ruissellement — filets verticaux qui descendent. Écritures, saisie, flux. */
export const Ruissellement = ({ accent }: P) => (
  <Svg>
    {Array.from({ length: 14 }, (_, i) => {
      const x = 60 + i * 100;
      return (
        <path
          key={i}
          className={i % 3 === 0 ? "mvt-defile" : "mvt-defile-lent"}
          d={`M ${x} -60 V 960`}
          fill="none"
          stroke={i % 3 === 0 ? HEX[accent] : INK}
          strokeOpacity={i % 3 === 0 ? 0.28 : 0.1}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={i % 2 ? "2 22" : "3 16"}
          style={{ animationDelay: `${i * -2.2}s` }}
        />
      );
    })}
  </Svg>
);

/** Orbites — ellipses en pointillé qui tournent. Cycles, récurrence, abonnement. */
export const Orbites = ({ accent, position }: P) => {
  const a = coordonnees(position);
  return (
    <Svg>
      <g>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} className={i % 2 ? "mvt-tourne" : "mvt-tourne-vite"} style={{ transformOrigin: `${a.x}px ${a.y}px` }}>
            <ellipse
              cx={a.x}
              cy={a.y}
              rx={150 + i * 95}
              ry={(150 + i * 95) * (0.42 + i * 0.13)}
              transform={`rotate(${i * 34} ${a.x} ${a.y})`}
              fill="none"
              stroke={i % 2 ? HEX[accent] : INK}
              strokeOpacity={i % 2 ? 0.3 : 0.12}
              strokeWidth="2.5"
              strokeDasharray="4 16"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
      <circle cx={a.x} cy={a.y} r="10" fill={HEX[accent]} opacity="0.4" className="mvt-pulse" />
    </Svg>
  );
};

/** Balayage radar — arcs en pointillé depuis un point. Veille, contrôle, audit. */
export const Radar = ({ accent, position }: P) => {
  const a = coordonnees(position);
  return (
    <Svg>
      {[1, 2, 3, 4, 5].map((i) => {
        const r = i * 115;
        return (
          <circle
            key={i}
            className={i % 2 ? "mvt-defile" : "mvt-defile-inverse"}
            cx={a.x}
            cy={a.y}
            r={r}
            fill="none"
            stroke={i % 2 ? HEX[accent] : INK}
            strokeOpacity={i % 2 ? 0.26 : 0.1}
            strokeWidth="2.5"
            strokeDasharray="5 20"
            style={{ animationDelay: `${i * -4}s` }}
          />
        );
      })}
      <g className="mvt-tourne-vite" style={{ transformOrigin: `${a.x}px ${a.y}px` }}>
        <path
          d={`M ${a.x} ${a.y} L ${a.x + 575} ${a.y}`}
          stroke={HEX[accent]}
          strokeOpacity="0.3"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </Svg>
  );
};

/** Ondes — sinusoïdes en pointillé. Signal, transmission, communication. */
export const Ondes = ({ accent }: P) => (
  <Svg>
    {Array.from({ length: 5 }, (_, i) => {
      const y = 150 + i * 155;
      const amp = 42 + i * 9;
      let d = `M -60 ${y}`;
      for (let x = -60; x < 1500; x += 120) {
        d += ` q 30 ${-amp} 60 0 q 30 ${amp} 60 0`;
      }
      return (
        <path
          key={i}
          className={i % 2 ? "mvt-defile" : "mvt-defile-inverse"}
          d={d}
          fill="none"
          stroke={i % 2 ? HEX[accent] : INK}
          strokeOpacity={i % 2 ? 0.28 : 0.1}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="3 15"
          style={{ animationDelay: `${i * -6}s` }}
        />
      );
    })}
  </Svg>
);

/** Constellation — nœuds reliés par des pointillés. Réseau, intégration, API. */
export const Constellation = ({ accent, position }: P) => {
  const a = coordonnees(position);
  const n: [number, number][] = [
    [-480, -190], [-250, 60], [-40, -230], [180, 110], [420, -120],
    [560, 170], [-380, 260], [90, 330], [330, -300],
  ];
  const liens = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [3, 7], [2, 8], [6, 7], [4, 8]];
  return (
    <Svg>
      <g>
        {liens.map(([i, j], k) => (
          <line
            key={k}
            className={k % 2 ? "mvt-defile" : "mvt-defile-lent"}
            x1={a.x + n[i][0]}
            y1={a.y + n[i][1]}
            x2={a.x + n[j][0]}
            y2={a.y + n[j][1]}
            stroke={k % 3 === 0 ? HEX[accent] : INK}
            strokeOpacity={k % 3 === 0 ? 0.3 : 0.1}
            strokeWidth="2"
            strokeDasharray="3 13"
            strokeLinecap="round"
            style={{ animationDelay: `${k * -2.5}s` }}
          />
        ))}
      </g>
      {n.map(([dx, dy], i) => (
        <circle
          key={i}
          className={i % 3 === 0 ? "mvt-pulse" : undefined}
          cx={a.x + dx}
          cy={a.y + dy}
          r={i % 3 === 0 ? 11 : 7}
          fill={i % 3 === 0 ? HEX[accent] : INK}
          opacity={i % 3 === 0 ? 0.45 : 0.14}
          style={{ animationDelay: `${i * -1.3}s` }}
        />
      ))}
    </Svg>
  );
};

/** Chevrons — progression par paliers. Étapes, déploiement, montée en charge. */
export const Chevrons = ({ accent }: P) => {
  const id = `ch-${accent}`;
  return (
    <Svg>
      <defs>
        <Pointe id={id} c={HEX[accent]} />
      </defs>
      {Array.from({ length: 7 }, (_, ligne) => {
        const y = 80 + ligne * 130;
        let d = `M -60 ${y}`;
        for (let x = -60; x < 1520; x += 170) {
          d += ` L ${x + 85} ${y - 34} L ${x + 170} ${y}`;
        }
        return (
          <path
            key={ligne}
            className={ligne % 2 ? "mvt-defile" : "mvt-defile-lent"}
            d={d}
            fill="none"
            stroke={ligne % 2 ? HEX[accent] : INK}
            strokeOpacity={ligne % 2 ? 0.26 : 0.09}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 14"
            markerEnd={ligne % 2 ? `url(#${id})` : undefined}
            style={{ animationDelay: `${ligne * -4}s` }}
          />
        );
      })}
    </Svg>
  );
};

/** Spirale — enroulement en pointillé. Amélioration continue, itération. */
export const Spirale = ({ accent, position }: P) => {
  const a = coordonnees(position);
  let d = `M ${a.x} ${a.y}`;
  for (let t = 0; t < 40; t += 0.35) {
    const r = t * 13;
    d += ` L ${a.x + Math.cos(t) * r} ${a.y + Math.sin(t) * r * 0.72}`;
  }
  return (
    <Svg>
      <path
        className="mvt-defile-lent"
        d={d}
        fill="none"
        stroke={HEX[accent]}
        strokeOpacity="0.3"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="4 16"
      />
      <circle cx={a.x} cy={a.y} r="9" fill={HEX[accent]} opacity="0.45" className="mvt-pulse" />
    </Svg>
  );
};
