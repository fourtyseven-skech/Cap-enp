import { CSSProperties, useId } from "react";

/**
 * L'Emblème « Double Trait » — item vectorisé d'identité pour Megasoft Office.
 *
 * Un sceau carré-arrondi (squircle) dérivé du monogramme : hachure à 24°,
 * un seul halo bleu (l'accent Office), le M en blanc, et la signature
 * double-trait bleue à 24°. Forme compacte de la marque, réutilisable en
 * favicon, avatar réseaux, icône d'application, filigrane ou sceau de document.
 *
 * - tone="dark"  : version principale, carré Encre, M blanc.
 * - tone="light" : déclinaison claire sur fond Papier, M en Encre.
 * L'accent reste toujours bleu — on ne recolore jamais l'emblème aux
 * couleurs d'un autre pôle.
 */
export const MegasoftEmblem = ({
  className = "",
  style,
  tone = "dark",
}: {
  className?: string;
  style?: CSSProperties;
  tone?: "dark" | "light";
}) => {
  const uid = useId().replace(/:/g, "");
  const clip = `${uid}-clip`;
  const halo = `${uid}-halo`;
  const hatch = `${uid}-hatch`;

  const bg = tone === "dark" ? "#0F172A" : "#F7F5F2";
  const markColor = tone === "dark" ? "#FFFFFF" : "#0F172A";
  const hatchColor = tone === "dark" ? "#FFFFFF" : "#0F172A";
  const ring = tone === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)";

  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      style={style}
      role="img"
      aria-label="Emblème Megasoft Office"
    >
      <defs>
        <clipPath id={clip}>
          <rect x="16" y="16" width="224" height="224" rx="64" />
        </clipPath>
        <radialGradient id={halo} cx="30%" cy="24%" r="78%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={hatch}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(24)"
        >
          <line x1="0" y1="0" x2="0" y2="16" stroke={hatchColor} strokeWidth="1.4" strokeOpacity="0.06" />
        </pattern>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <rect x="16" y="16" width="224" height="224" fill={bg} />
        <rect x="16" y="16" width="224" height="224" fill={`url(#${hatch})`} />
        <rect x="16" y="16" width="224" height="224" fill={`url(#${halo})`} />

        {/* Monogramme M (géométrie officielle, terminaisons rondes) */}
        <g
          transform="translate(57 71) scale(0.62)"
          stroke={markColor}
          strokeWidth="50"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          <path d="M23 106 L104 27" />
          <path d="M118 106 L201 27 L205 106" />
        </g>

        {/* Signature : le double trait, à 24°, en bleu Office */}
        <g stroke="#3B82F6" strokeWidth="9" strokeLinecap="round">
          <line x1="108" y1="192" x2="140" y2="178" />
          <line x1="120" y1="201" x2="152" y2="187" />
        </g>
      </g>

      <rect x="16" y="16" width="224" height="224" rx="64" fill="none" stroke={ring} />
    </svg>
  );
};

export default MegasoftEmblem;
