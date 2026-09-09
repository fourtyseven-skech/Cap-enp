import type { ComponentType, CSSProperties } from "react";
import {
  FORMATS,
  degradeCss,
  type Diapositive,
  type Document,
  type ElForme,
  type ElGraphique,
  type ElImage,
  type ElTableau,
  type ElTexte,
  type ElVideo,
  type Element,
  type Ombre,
  type Theme,
} from "./modele";

/**
 * ---------------------------------------------------------------------------
 * RENDU D'UNE DIAPOSITIVE — source unique
 * ---------------------------------------------------------------------------
 *
 * Ce module ne dépend ni de l'éditeur, ni du présentateur, ni de l'export : les
 * trois le consomment, aucun ne le possède. C'est ce qui garantit qu'une
 * diapositive composée dans le panel est EXACTEMENT celle qui sera projetée
 * puis exportée — dupliquer le dessin produirait des écarts qu'on ne découvre
 * qu'en salle.
 *
 * Chaque élément est positionné en absolu dans le repère du document ; c'est
 * l'appelant qui met la scène à l'échelle. Aucun accès au DOM ni à `window` :
 * l'export rend ces mêmes composants hors navigateur.
 *
 * Les styles sont EN LIGNE, pas en classes utilitaires. Ce n'est pas un
 * relâchement : couleurs, tailles, graisses et dégradés viennent du DOCUMENT,
 * saisis par l'utilisateur. Une classe Tailwind est décidée à la compilation ;
 * ici tout est décidé à l'exécution.
 */

export type RenduGraphique = ComponentType<{ el: ElGraphique; theme: Theme }>;

const POLICES = {
  sans: "'Inter Tight', system-ui, sans-serif",
  titrage: "Poppins, system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
};

/**
 * Les ombres passent par `drop-shadow` et non par `box-shadow` : elles suivent
 * ainsi la FORME RÉELLE — coins arrondis, ellipse, découpe d'une image
 * transparente, contour des lettres. Une `box-shadow` dessinerait un rectangle
 * derrière un rond.
 */
const filtre = (el: Element): string | undefined => {
  const parts: string[] = [];
  const ombres = el.ombre ? (Array.isArray(el.ombre) ? el.ombre : [el.ombre]) : [];
  for (const o of ombres as Ombre[]) {
    parts.push(`drop-shadow(${o.x ?? 0}px ${o.y ?? 6}px ${o.flou}px ${o.couleur})`);
  }
  if (el.flou) parts.push(`blur(${el.flou}px)`);
  return parts.length ? parts.join(" ") : undefined;
};

/* =========================================================================
 * TEXTE
 * ======================================================================= */

const Texte = ({ el, theme }: { el: ElTexte; theme: Theme }) => {
  const vide = !el.html || !el.html.replace(/<[^>]*>/g, "").trim();

  const typo: CSSProperties = {
    fontFamily: POLICES[el.police ?? "sans"],
    fontSize: el.taille,
    fontWeight: el.graisse,
    fontStyle: el.italique ? "italic" : "normal",
    textDecoration: el.souligne ? "underline" : undefined,
    color: vide ? theme.attenue : el.couleur,
    lineHeight: el.interligne,
    letterSpacing: el.interlettre ? `${el.interlettre}em` : undefined,
    textTransform: el.majuscules ? "uppercase" : "none",
    // Les mots longs ne doivent pas déborder de leur boîte : sur une scène de
    // dimensions fixes, un débordement ne rogne pas la mise en page, il sort du
    // cadre — et on ne s'en aperçoit qu'une fois projeté.
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  };

  // Dégradé peint DANS les lettres. `background-clip: text` exige une couleur
  // de texte transparente : sans elle, le fond opaque recouvrirait le dégradé.
  if (el.degrade) {
    typo.backgroundImage = degradeCss(el.degrade);
    typo.WebkitBackgroundClip = "text";
    typo.backgroundClip = "text";
    typo.color = "transparent";
  }

  if (el.contourTexte) {
    typo.WebkitTextStrokeWidth = el.contourTexte.epaisseur;
    typo.WebkitTextStrokeColor = el.contourTexte.couleur;
    if (el.contourTexte.remplissage === "none") typo.color = "transparent";
    else if (el.contourTexte.remplissage) typo.color = el.contourTexte.remplissage;
  }

  const cadre: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent:
      el.vertical === "milieu" ? "center" : el.vertical === "bas" ? "flex-end" : "flex-start",
    textAlign: el.aligne === "centre" ? "center" : el.aligne === "droite" ? "right" : "left",
  };

  const contenu = vide && el.invite ? el.invite : el.html;

  if (el.puce) {
    const d = Math.max(6, el.taille * 0.26);
    return (
      <div style={{ ...cadre, flexDirection: "row", alignItems: "flex-start", gap: el.taille * 0.62 }}>
        <span
          style={{
            flex: "none",
            width: d,
            height: d,
            borderRadius: "50%",
            background: el.couleur === theme.encre ? theme.accents[0] : el.couleur,
            // Alignée sur la première ligne, pas sur le haut de la boîte :
            // centrée dans la hauteur de ligne.
            marginTop: (el.taille * el.interligne - d) / 2,
          }}
        />
        <span style={{ ...typo, flex: 1 }} dangerouslySetInnerHTML={{ __html: contenu }} />
      </div>
    );
  }

  return (
    <div
      style={{ ...cadre, flexDirection: "column", ...typo }}
      dangerouslySetInnerHTML={{ __html: contenu }}
    />
  );
};

/* =========================================================================
 * FORME
 * ======================================================================= */

const POLYGONES: Record<string, string> = {
  triangle: "50,0 100,100 0,100",
  losange: "50,0 100,50 50,100 0,50",
  etoile: "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35",
};

const Forme = ({ el }: { el: ElForme }) => {
  const peinture = el.degrade ? degradeCss(el.degrade) : el.remplissage;

  if (el.forme === "rectangle" || el.forme === "barre" || el.forme === "ellipse") {
    // Boîtes CSS plutôt que SVG : moins de nœuds, et le navigateur les compose
    // plus vite quand on en déplace une à la souris.
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: peinture,
          border: el.epaisseur
            ? `${el.epaisseur}px ${el.trait === "tirets" ? "dashed" : el.trait === "points" ? "dotted" : "solid"} ${el.contour}`
            : "none",
          borderRadius: el.forme === "ellipse" ? "50%" : el.forme === "barre" ? 999 : el.rayon,
        }}
      />
    );
  }

  if (POLYGONES[el.forme]) {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <polygon
          points={POLYGONES[el.forme]}
          fill={el.remplissage}
          stroke={el.epaisseur ? el.contour : "none"}
          strokeWidth={el.epaisseur}
        />
      </svg>
    );
  }

  // Ligne et flèche : tracées d'un bord à l'autre de la boîte, à mi-hauteur.
  const trait = el.contour === "transparent" || !el.contour ? el.remplissage : el.contour;
  const ep = el.epaisseur || 3;
  const debut = el.debut ?? "aucun";
  const fin = el.fin ?? (el.forme === "fleche" ? "fleche" : "aucun");
  const marge = ep * 3;

  const Marqueur = ({ id, sorte, sens }: { id: string; sorte: string; sens: number }) => (
    <marker id={id} markerWidth="10" markerHeight="10" refX={sens > 0 ? 7 : 3} refY="3" orient="auto">
      {sorte === "fleche" && <path d={sens > 0 ? "M0,0 L8,3 L0,6 z" : "M8,0 L0,3 L8,6 z"} fill={trait} />}
      {sorte === "point" && <circle cx="3.5" cy="3" r="2.6" fill={trait} />}
      {sorte === "barre" && <rect x={sens > 0 ? 6 : 1} y="0" width="1.6" height="6" fill={trait} />}
    </marker>
  );

  return (
    <svg viewBox={`0 0 ${Math.max(el.l, 1)} ${Math.max(el.h, 1)}`} style={{ width: "100%", height: "100%" }}>
      <defs>
        {debut !== "aucun" && <Marqueur id={`d-${el.id}`} sorte={debut} sens={-1} />}
        {fin !== "aucun" && <Marqueur id={`f-${el.id}`} sorte={fin} sens={1} />}
      </defs>
      <line
        x1={debut !== "aucun" ? marge : 0}
        y1={el.h / 2}
        x2={el.l - (fin !== "aucun" ? marge : 0)}
        y2={el.h / 2}
        stroke={trait}
        strokeWidth={ep}
        strokeLinecap="round"
        strokeDasharray={
          el.trait === "tirets" ? `${ep * 3} ${ep * 2}` : el.trait === "points" ? `1 ${ep * 2}` : undefined
        }
        markerStart={debut !== "aucun" ? `url(#d-${el.id})` : undefined}
        markerEnd={fin !== "aucun" ? `url(#f-${el.id})` : undefined}
      />
    </svg>
  );
};

/* =========================================================================
 * IMAGE ET MÉDIA
 * ======================================================================= */

const Image = ({ el, theme }: { el: ElImage; theme: Theme }) =>
  el.src ? (
    <img
      src={el.src}
      alt={el.alt}
      style={{
        width: "100%",
        height: "100%",
        objectFit: el.ajustement === "contenir" ? "contain" : el.ajustement === "etirer" ? "fill" : "cover",
        borderRadius: el.rayon,
        display: "block",
      }}
    />
  ) : (
    // Emplacement vide : un cadre explicite vaut mieux qu'un trou — on voit
    // qu'une image est attendue là, et où elle se posera.
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: el.rayon,
        border: `2px dashed ${theme.attenue}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.attenue,
        fontFamily: POLICES.sans,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      Image
    </div>
  );

const Media = ({ el, theme }: { el: ElVideo; theme: Theme }) => {
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: el.ajustement === "contenir" ? "contain" : "cover",
    borderRadius: el.rayon ?? 12,
    display: "block",
    background: "#000",
  };

  if (!el.src) {
    return (
      <div
        style={{
          ...style,
          background: "transparent",
          border: `2px dashed ${theme.attenue}66`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.attenue,
          fontFamily: POLICES.sans,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {el.nature === "audio" ? "Audio" : "Vidéo"}
      </div>
    );
  }

  if (el.nature === "audio") return <audio src={el.src} controls={el.controles} style={{ width: "100%" }} />;

  // La lecture automatique n'est jamais déclenchée ici : sur la toile et dans
  // les miniatures, toutes les vidéos joueraient en même temps. Le présentateur
  // la lance lui-même à l'arrivée sur la diapositive.
  return (
    <video
      src={el.src}
      poster={el.affiche}
      controls={el.controles}
      loop={el.boucle}
      muted={el.muet}
      playsInline
      style={style}
    />
  );
};

/* =========================================================================
 * TABLEAU
 * ======================================================================= */

const Tableau = ({ el }: { el: ElTableau }) => {
  const s = el.style;
  const total = el.colonnes.reduce((n, c) => n + (c.p || 1), 0) || 1;

  return (
    <div style={{ width: "100%", height: "100%", borderRadius: s.rayon, overflow: "hidden" }}>
      <table
        style={{
          width: "100%",
          height: "100%",
          borderCollapse: "collapse",
          // Indispensable : sans lui, une cellule longue élargit sa colonne et
          // toute la composition bouge à la frappe.
          tableLayout: "fixed",
          fontFamily: POLICES.sans,
          fontSize: s.taille,
          color: s.couleur,
        }}
      >
        <colgroup>
          {el.colonnes.map((c, i) => (
            <col key={i} style={{ width: `${((c.p || 1) / total) * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {el.lignes.map((ligne, i) => {
            const entete = el.entete && i === 0;
            const zebre = !entete && s.zebrure && (el.entete ? i % 2 === 0 : i % 2 === 1);
            return (
              <tr key={i} style={{ background: entete ? s.fondEntete : zebre ? s.zebrure : undefined }}>
                {ligne.map((c, j) => (
                  <td
                    key={j}
                    style={{
                      padding: `${s.padY}px ${s.padX}px`,
                      borderBottom: `${s.epaisseurBord}px solid ${entete ? s.couleurEntete : s.couleurBord}`,
                      fontWeight: entete || c.gras ? 800 : 500,
                      color: c.couleur ?? (entete ? s.couleurEntete : s.couleur),
                      background: c.fond,
                      fontSize: entete ? Math.round(s.taille * 0.82) : s.taille,
                      textTransform: entete ? "uppercase" : "none",
                      letterSpacing: entete ? "0.08em" : undefined,
                      textAlign: c.aligne === "centre" ? "center" : c.aligne === "droite" ? "right" : "left",
                      verticalAlign: "middle",
                      overflowWrap: "break-word",
                    }}
                    dangerouslySetInnerHTML={{ __html: c.html }}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* =========================================================================
 * UN ÉLÉMENT DANS SON CADRE
 * ======================================================================= */

export const RenduElement = ({
  el,
  theme,
  graphique: Graphique,
}: {
  el: Element;
  theme: Theme;
  graphique?: RenduGraphique;
}) => (
  <div
    // `data-morph` porte la clé d'appariement : `morph` s'il est posé, sinon
    // l'identifiant. C'est ce que lit le présentateur pour faire glisser un
    // élément d'une diapositive à l'autre.
    data-morph={el.morph ?? el.id}
    data-etape={el.etape ?? 0}
    style={{
      position: "absolute",
      left: el.x,
      top: el.y,
      width: el.l,
      height: el.h,
      transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
      opacity: el.opacite ?? 1,
      filter: filtre(el),
      mixBlendMode: (el.fusion as CSSProperties["mixBlendMode"]) || undefined,
    }}
  >
    {el.type === "texte" && <Texte el={el} theme={theme} />}
    {el.type === "forme" && <Forme el={el} />}
    {el.type === "image" && <Image el={el} theme={theme} />}
    {el.type === "media" && <Media el={el} theme={theme} />}
    {el.type === "tableau" && <Tableau el={el} />}
    {el.type === "graphique" &&
      (Graphique ? (
        <Graphique el={el} theme={theme} />
      ) : (
        // Sans moteur de graphique fourni, on montre les chiffres plutôt qu'un
        // cadre vide : la diapositive reste exploitable.
        <ul
          style={{
            display: "flex",
            gap: 16,
            width: "100%",
            height: "100%",
            alignItems: "center",
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontFamily: POLICES.sans,
          }}
        >
          {el.serie.map((p, i) => (
            <li key={i} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ display: "block", fontSize: 38, fontWeight: 900, color: el.couleur }}>
                {p.valeur}
              </span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: theme.attenue }}>
                {p.etiquette}
              </span>
            </li>
          ))}
        </ul>
      ))}
  </div>
);

/* =========================================================================
 * UNE DIAPOSITIVE
 * ======================================================================= */

export const RenduDiapositive = ({
  d,
  doc,
  etape = Infinity,
  graphique,
  anime = false,
  style,
}: {
  d: Diapositive;
  doc: Document;
  /**
   * Dernière étape d'apparition dévoilée. `Infinity` montre tout — ce que
   * veulent l'éditeur, les miniatures et l'export statique.
   */
  etape?: number;
  graphique?: RenduGraphique;
  /** Joue les animations d'entrée. Vrai en projection seulement. */
  anime?: boolean;
  style?: CSSProperties;
}) => {
  const { largeur, hauteur } = FORMATS[doc.format];
  const fond = d.fond.degrade ? degradeCss(d.fond.degrade) : d.fond.couleur || doc.theme.fond;

  return (
    <div
      style={{
        position: "relative",
        width: largeur,
        height: hauteur,
        overflow: "hidden",
        background: fond,
        ...style,
      }}
    >
      {d.fond.image && (
        <>
          <img
            src={d.fond.image}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {!!d.fond.voile && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: d.fond.couleur || "#000",
                opacity: d.fond.voile,
              }}
            />
          )}
        </>
      )}

      {d.elements
        .filter((e) => !e.masque)
        .map((e) => (
          <div
            key={e.id}
            className={`ms-appar${anime && e.fx?.entree ? ` ms-e-${e.fx.entree}` : ""}`}
            data-vu={(e.etape ?? 0) <= etape ? "1" : "0"}
            style={{
              position: "absolute",
              inset: 0,
              ["--ms-duree" as string]: e.fx?.duree ? `${e.fx.duree}s` : undefined,
              ["--ms-retard" as string]: e.fx?.ordre ? `${e.fx.ordre * 0.09}s` : undefined,
            }}
          >
            <RenduElement el={e} theme={doc.theme} graphique={graphique} />
          </div>
        ))}
    </div>
  );
};

/**
 * Styles d'apparition et d'entrée.
 *
 * Exportés en texte plutôt qu'en fichier CSS : le rendu est monté dans le
 * panel, dans une page du blog ET recopié tel quel dans le fichier exporté. Une
 * feuille externe ne suivrait dans aucun des trois cas.
 */
export const STYLES_RENDU = `
.ms-appar { transition: opacity 380ms cubic-bezier(0.22,1,0.36,1), transform 380ms cubic-bezier(0.22,1,0.36,1); }
.ms-appar[data-vu="0"] { opacity: 0; transform: translateY(12px); pointer-events: none; }
.ms-appar[data-vu="1"] { opacity: 1; transform: none; }

@keyframes ms-fondu { from { opacity: 0 } to { opacity: 1 } }
@keyframes ms-fondu-haut { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes ms-fondu-bas { from { opacity: 0; transform: translateY(-16px) } to { opacity: 1; transform: none } }
@keyframes ms-glisse-gauche { from { opacity: 0; transform: translateX(120px) } to { opacity: 1; transform: none } }
@keyframes ms-glisse-droite { from { opacity: 0; transform: translateX(-120px) } to { opacity: 1; transform: none } }
@keyframes ms-glisse-haut { from { opacity: 0; transform: translateY(120px) } to { opacity: 1; transform: none } }
@keyframes ms-glisse-bas { from { opacity: 0; transform: translateY(-120px) } to { opacity: 1; transform: none } }
@keyframes ms-zoom { from { opacity: 0; transform: scale(0.88) } to { opacity: 1; transform: none } }

.ms-appar[class*="ms-e-"][data-vu="1"] {
  animation-duration: var(--ms-duree, 0.55s);
  animation-delay: var(--ms-retard, 0s);
  animation-fill-mode: both;
  animation-timing-function: cubic-bezier(0.22,1,0.36,1);
}
.ms-e-fondu[data-vu="1"] { animation-name: ms-fondu }
.ms-e-fondu-haut[data-vu="1"] { animation-name: ms-fondu-haut }
.ms-e-fondu-bas[data-vu="1"] { animation-name: ms-fondu-bas }
.ms-e-glisse-gauche[data-vu="1"] { animation-name: ms-glisse-gauche; animation-duration: var(--ms-duree, 0.75s) }
.ms-e-glisse-droite[data-vu="1"] { animation-name: ms-glisse-droite; animation-duration: var(--ms-duree, 0.75s) }
.ms-e-glisse-haut[data-vu="1"] { animation-name: ms-glisse-haut; animation-duration: var(--ms-duree, 0.75s) }
.ms-e-glisse-bas[data-vu="1"] { animation-name: ms-glisse-bas; animation-duration: var(--ms-duree, 0.75s) }
.ms-e-zoom[data-vu="1"] { animation-name: ms-zoom }

@media (prefers-reduced-motion: reduce) {
  .ms-appar { transition: none !important; transform: none !important; animation: none !important; }
}
`;
