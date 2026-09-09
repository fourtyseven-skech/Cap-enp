import { useEffect, useRef, useState } from "react";
import { degradeCss, type Degrade, type Theme } from "@/blog/deck/modele";
import { useAncre } from "../ancre";
import { Flottant } from "../ui";

/**
 * ---------------------------------------------------------------------------
 * CHOIX DE COULEUR — sans limite
 * ---------------------------------------------------------------------------
 *
 * La version précédente n'offrait que huit pastilles de la charte. C'était une
 * limite arbitraire : un utilisateur qui prépare une présentation pour un
 * client a besoin des couleurs de ce client, pas des nôtres. La charte reste
 * proposée en premier — c'est le bon défaut — mais elle ne ferme plus la porte.
 *
 * Ce panneau donne :
 *   · la palette du document, d'un clic ;
 *   · la roue chromatique du système ;
 *   · la saisie hexadécimale directe, y compris sur huit chiffres (`#rrggbbaa`) ;
 *   · l'opacité, que les sélecteurs natifs ignorent — d'où le couple
 *     roue + pourcentage, qui fait l'aller-retour sans perte ;
 *   · la pipette du navigateur quand il la propose, pour prélever une couleur
 *     n'importe où à l'écran ;
 *   · les dernières couleurs employées, qui évitent de ressaisir un code ;
 *   · un éditeur de dégradé, quand l'appelant l'autorise.
 */

/* =========================================================================
 * ANALYSE DES COULEURS
 * ======================================================================= */

const versDeux = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/**
 * Ramène n'importe quelle notation à un couple `#rrggbb` + opacité.
 *
 * Les sélecteurs natifs n'acceptent que `#rrggbb` — pas d'alpha, pas de
 * `rgba()`, pas de nom. Sans cette normalisation, une couleur saisie en
 * `rgba(15,23,42,0.6)` remettrait le sélecteur à noir dès sa réouverture, et
 * l'opacité serait perdue au premier clic.
 */
export const analyser = (c: string): { hex: string; a: number } => {
  const v = (c ?? "").trim().toLowerCase();
  if (!v || v === "transparent" || v === "none") return { hex: "#000000", a: 0 };

  if (v.startsWith("#")) {
    const h = v.slice(1);
    if (h.length === 3) return { hex: `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`, a: 1 };
    if (h.length === 6) return { hex: `#${h}`, a: 1 };
    if (h.length === 8) return { hex: `#${h.slice(0, 6)}`, a: parseInt(h.slice(6), 16) / 255 };
  }

  const m = v.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { hex: `#${versDeux(+m[1])}${versDeux(+m[2])}${versDeux(+m[3])}`, a: Number.isFinite(a) ? a : 1 };
  }

  // Nom CSS ou notation exotique : le navigateur sait la résoudre, nous non.
  // Hors navigateur (rendu statique), on renvoie la valeur telle quelle.
  if (typeof document !== "undefined") {
    const n = document.createElement("span");
    n.style.color = v;
    document.body.appendChild(n);
    const calcule = getComputedStyle(n).color;
    n.remove();
    if (calcule && calcule !== v) return analyser(calcule);
  }
  return { hex: "#000000", a: 1 };
};

/** Recompose une couleur, en gardant la notation la plus courte qui suffise. */
export const composer = (hex: string, a: number): string => {
  if (a >= 1) return hex;
  if (a <= 0) return "transparent";
  const { hex: h } = analyser(hex);
  return `${h}${versDeux(a * 255)}`;
};

/* =========================================================================
 * MÉMOIRE DES COULEURS RÉCENTES
 * =======================================================================
 *
 * Partagée par tous les champs et conservée d'une session à l'autre : on
 * revient très souvent à la couleur qu'on vient d'employer, et la retaper à
 * chaque fois est le genre de friction qui décourage d'utiliser autre chose que
 * les pastilles proposées.
 */
const CLE_RECENTES = "ms-couleurs-recentes";

const lireRecentes = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLE_RECENTES) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const noterRecente = (c: string) => {
  if (!c || c === "transparent") return;
  try {
    const l = [c, ...lireRecentes().filter((x) => x !== c)].slice(0, 12);
    localStorage.setItem(CLE_RECENTES, JSON.stringify(l));
  } catch {
    /* stockage indisponible — les récentes ne survivront pas à la session */
  }
};

/* =========================================================================
 * PASTILLE
 * ======================================================================= */

const Pastille = ({
  couleur,
  actif,
  titre,
  onClick,
  taille = 22,
}: {
  couleur: string;
  actif?: boolean;
  titre?: string;
  onClick: () => void;
  taille?: number;
}) => (
  <button
    type="button"
    title={titre ?? couleur}
    onClick={onClick}
    style={{ width: taille, height: taille, background: couleur === "transparent" ? undefined : couleur }}
    className={`relative shrink-0 rounded-md border-2 transition-transform ${
      actif ? "border-slate-900 scale-110" : "border-slate-200 hover:border-slate-400"
    } ${couleur === "transparent" ? "bg-white overflow-hidden" : ""}`}
  >
    {couleur === "transparent" && (
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-full h-px bg-red-500 rotate-45" />
      </span>
    )}
  </button>
);

/* =========================================================================
 * ÉDITEUR DE DÉGRADÉ
 * ======================================================================= */

const EditeurDegrade = ({
  valeur,
  onChange,
  onRetirer,
}: {
  valeur: Degrade;
  onChange: (d: Degrade) => void;
  onRetirer: () => void;
}) => (
  <div className="space-y-2">
    <div
      className="h-8 rounded-lg border border-slate-200"
      style={{ backgroundImage: degradeCss(valeur) }}
      aria-hidden
    />
    <label className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10.5px] font-bold text-slate-500">Angle</span>
      <input
        type="range"
        min={0}
        max={360}
        value={valeur.angle}
        onChange={(e) => onChange({ ...valeur, angle: Number(e.target.value) })}
        className="flex-1"
      />
      <span className="w-9 text-right text-[10.5px] tabular-nums text-slate-500">{valeur.angle}°</span>
    </label>

    {valeur.arrets.map((s, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <input
          type="color"
          value={analyser(s.couleur).hex}
          onChange={(e) =>
            onChange({
              ...valeur,
              arrets: valeur.arrets.map((x, j) => (j === i ? { ...x, couleur: e.target.value } : x)),
            })
          }
          className="w-6 h-6 shrink-0 rounded-md border border-slate-300 p-0 cursor-pointer"
        />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(s.a * 100)}
          onChange={(e) =>
            onChange({
              ...valeur,
              arrets: valeur.arrets.map((x, j) => (j === i ? { ...x, a: Number(e.target.value) / 100 } : x)),
            })
          }
          className="flex-1"
        />
        <button
          type="button"
          disabled={valeur.arrets.length <= 2}
          onClick={() => onChange({ ...valeur, arrets: valeur.arrets.filter((_, j) => j !== i) })}
          className="w-5 shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-30"
          aria-label="Retirer cet arrêt"
        >
          ×
        </button>
      </div>
    ))}

    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() =>
          onChange({
            ...valeur,
            arrets: [...valeur.arrets, { a: 1, couleur: valeur.arrets[valeur.arrets.length - 1].couleur }],
          })
        }
        className="flex-1 px-2 py-1 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-slate-500"
      >
        + Arrêt
      </button>
      <button
        type="button"
        onClick={onRetirer}
        className="flex-1 px-2 py-1 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-slate-500"
      >
        Couleur unie
      </button>
    </div>
  </div>
);

/* =========================================================================
 * LE CHAMP
 * ======================================================================= */

export const ChampCouleur = ({
  valeur,
  onChange,
  theme,
  transparent,
  degrade,
  onDegrade,
  libelle,
}: {
  valeur: string;
  onChange: (c: string) => void;
  theme: Theme;
  /** Autorise « aucune couleur ». */
  transparent?: boolean;
  /** Dégradé courant, si l'appelant en accepte un. */
  degrade?: Degrade;
  onDegrade?: (d: Degrade | undefined) => void;
  libelle?: string;
}) => {
  const bouton = useRef<HTMLButtonElement>(null);
  const { ancre, ouvert, basculer, fermer } = useAncre();
  const [recentes, setRecentes] = useState<string[]>([]);
  const [hex, setHex] = useState("");

  const { hex: courant, a } = analyser(valeur);

  useEffect(() => {
    if (ouvert) {
      setRecentes(lireRecentes());
      setHex(a >= 1 ? courant : `${courant}${versDeux(a * 255)}`);
    }
  }, [ouvert, courant, a]);

  const poser = (c: string) => {
    onChange(c);
    noterRecente(c);
  };

  const palette = [
    theme.encre,
    theme.attenue,
    ...theme.accents,
    "#FFFFFF",
    "#F7F5F1",
    "#0F172A",
    "#F97316",
    "#EAB308",
    "#8B5CF6",
    "#14B8A6",
    "#EF4444",
  ];

  /** La pipette n'existe pas partout : on ne montre le bouton que si elle est là. */
  const pipetteDispo = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <>
      <button
        ref={bouton}
        type="button"
        title={libelle ?? valeur}
        onClick={(e) => {
          e.stopPropagation();
          basculer(bouton.current);
        }}
        className={`ms-presse flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors ${
          ouvert ? "border-slate-500 bg-slate-50" : "border-slate-300 hover:border-slate-500"
        }`}
      >
        <span
          className="w-5 h-5 rounded-md border border-black/10 shrink-0"
          style={{
            backgroundImage: degrade
              ? degradeCss(degrade)
              : "linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%)",
            backgroundSize: degrade ? undefined : "6px 6px",
            backgroundPosition: degrade ? undefined : "0 0, 3px 3px",
            backgroundColor: degrade ? undefined : valeur,
          }}
        />
        <span className="text-[11px] font-mono text-slate-500 truncate max-w-[70px]">
          {degrade ? "dégradé" : valeur === "transparent" ? "aucune" : courant}
        </span>
      </button>

      <Flottant ancre={ancre} ouvert={ouvert} onFermer={fermer} declencheur={bouton} classe="w-[264px]">
        <div className="p-3 space-y-3">
          {degrade && onDegrade ? (
            <EditeurDegrade valeur={degrade} onChange={onDegrade} onRetirer={() => onDegrade(undefined)} />
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Palette du document
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {transparent && (
                    <Pastille couleur="transparent" titre="Aucune" actif={a === 0} onClick={() => poser("transparent")} />
                  )}
                  {palette.map((c) => (
                    <Pastille
                      key={c}
                      couleur={c}
                      actif={courant.toLowerCase() === c.toLowerCase() && a >= 1}
                      onClick={() => poser(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={courant}
                  onChange={(e) => poser(composer(e.target.value, a))}
                  className="w-9 h-9 shrink-0 rounded-lg border border-slate-300 p-0 cursor-pointer"
                  title="Roue chromatique"
                />
                <input
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  onBlur={() => {
                    // Validé à la sortie du champ, pas à la frappe : sinon
                    // « #3B » serait interprété en cours de saisie et la couleur
                    // sauterait au noir entre deux caractères.
                    const v = hex.trim();
                    if (/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
                      poser(v.startsWith("#") ? v : `#${v}`);
                    } else {
                      setHex(a >= 1 ? courant : `${courant}${versDeux(a * 255)}`);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    e.stopPropagation();
                  }}
                  placeholder="#3B82F6"
                  className="ms-champ flex-1 min-w-0 border border-slate-300 rounded-lg px-2 py-1.5 text-[12px] font-mono text-slate-700"
                />
                {pipetteDispo && (
                  <button
                    type="button"
                    title="Pipette — prélever une couleur à l'écran"
                    onClick={async () => {
                      try {
                        const Pipette = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
                        const r = await new Pipette().open();
                        poser(r.sRGBHex);
                      } catch {
                        /* prélèvement annulé — rien à faire */
                      }
                    }}
                    className="ms-presse w-9 h-9 shrink-0 rounded-lg border border-slate-300 text-[15px] hover:border-slate-500"
                  >
                    ⌖
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10.5px] font-bold text-slate-500">Opacité</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(a * 100)}
                  onChange={(e) => poser(composer(courant, Number(e.target.value) / 100))}
                  className="flex-1"
                />
                <span className="w-9 text-right text-[10.5px] tabular-nums text-slate-500">
                  {Math.round(a * 100)} %
                </span>
              </label>

              {recentes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Récemment employées
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentes.map((c) => (
                      <Pastille key={c} couleur={c} taille={18} onClick={() => poser(c)} />
                    ))}
                  </div>
                </div>
              )}

              {onDegrade && (
                <button
                  type="button"
                  onClick={() =>
                    onDegrade({
                      angle: 135,
                      arrets: [
                        { a: 0, couleur: courant },
                        { a: 1, couleur: theme.accents[1] },
                      ],
                    })
                  }
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-slate-500"
                >
                  Passer en dégradé
                </button>
              )}
            </>
          )}
        </div>
      </Flottant>
    </>
  );
};

export default ChampCouleur;
