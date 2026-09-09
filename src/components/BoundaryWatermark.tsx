/**
 * A giant background watermark that straddles the seam between two stacked
 * sections. It is rendered as TWO halves that share one config:
 *
 *   - the upper section renders it with edge="bottom" (its box is pinned to the
 *     section's bottom edge and shifted down 50%, so only the glyph's TOP half
 *     shows, clipped by the section's overflow-hidden);
 *   - the lower section renders it with edge="top" (pinned to the top edge and
 *     shifted up 50%, so only the BOTTOM half shows).
 *
 * Both halves occupy the exact same page rectangle (same text, size, x-offset)
 * and paint the same vertical gradient (colorTop -> colorBottom), so together
 * they read as one continuous glyph whose color melts softly from the upper
 * section's hue into the lower section's hue right across the seam.
 *
 * Because each half lives inside its own section (between the section
 * background and its content), this works even when a section has an opaque
 * background (e.g. the dark "Pourquoi nous" and footer).
 */

export type Boundary = {
  /** Text/glyph that crosses the seam. */
  text: string;
  /** Responsive font-size utilities, identical on both halves. */
  size: string;
  /** Horizontal position utility, identical on both halves, e.g. "right-[2%]". */
  pos: string;
  /** Colour of the top of the glyph (the upper section's hue). */
  colorTop: string;
  /** Colour of the bottom of the glyph (the lower section's hue). */
  colorBottom: string;
  /** Overall opacity of the watermark. */
  opacity?: number;
};

const ink = "hsl(var(--ms-ink))";
const blue = "hsl(var(--ms-blue))";
const mauve = "hsl(var(--ms-mauve))";
const green = "hsl(var(--ms-green))";
const white = "hsl(0 0% 100%)";

/**
 * Une entrée par couture, DANS L'ORDRE DE LA PAGE. Chacune est référencée par
 * la section du dessus (edge="bottom") ET par celle du dessous (edge="top").
 *
 * ⚠️ CETTE CHAÎNE DOIT SUIVRE L'ORDRE RÉEL DE src/pages/Index.tsx.
 *
 * Une section insérée au milieu casse silencieusement la couture qu'elle
 * traverse : les deux moitiés du glyphe restent affichées, mais séparées par la
 * hauteur de l'intruse — on voit alors le haut d'un chiffre en bas d'une
 * section, et son bas mille pixels plus loin. C'est arrivé avec « MEGA ERP »,
 * glissée entre Solutions et Pourquoi nous : le « 3 » s'est retrouvé coupé en
 * deux sur 995 px, mesurés.
 *
 * Toute section ajoutée doit donc reprendre la couture qu'elle interrompt et en
 * ouvrir une nouvelle. L'audit qui détecte ces ruptures est décrit dans le
 * commentaire de `BoundaryWatermark` ci-dessous.
 *
 * CE QUE DIT CHAQUE GLYPHE
 * ------------------------
 * Ce ne sont PAS des numéros de section — la question a été posée, ce qui
 * prouve que la règle méritait d'être écrite. Chaque glyphe reprend un chiffre
 * ou un symbole de la section qui le PRÉCÈDE, et le fait déborder sur la
 * suivante :
 *
 *   1990  l'année de fondation         (Qui sommes-nous)
 *   3     les trois pôles              (Solutions)
 *   ERP   le produit présenté          (MEGA ERP)
 *   ?     « Pourquoi choisir… ? »      (Pourquoi nous)
 *   5     les cinq villes partenaires  (Partenaires)
 *   12K   les 12 000 utilisateurs      (bande de chiffres du Hero)
 *   300+  les 300+ clients             (Références)
 *   @     le contact                   (Contact)
 *
 * ⚠️ « 12K » est le seul à ne pas venir de la section juste au-dessus : le
 * chiffre appartient à la bande du Hero, pas aux Témoignages, qui n'ont pas de
 * chiffre publiable. Écart assumé — il fait le pont entre les utilisateurs et
 * les clients. Si la note des avis est un jour affichée, « 4,4 » serait le
 * glyphe naturel de cette couture.
 *
 * Un glyphe ajouté doit donc dire quelque chose de la section qu'il quitte :
 * sans cela le décor cesse d'être une lecture et devient un motif.
 */
/**
 * Les tailles mobiles sont calibrées pour que le glyphe tienne ENTIER dans la
 * largeur du téléphone. Un chiffre en gras avance d'environ 0,62 em par
 * caractère : « 300+ » à 40 vw occupait ~99 vw et se faisait rogner d'un côté
 * ou de l'autre selon l'ancrage. Les valeurs ci-dessous laissent une marge à
 * chaque bord — le filigrane reste hors-champ du regard, mais complet.
 */
export const BOUNDARIES: Record<string, Boundary> = {
  // Qui sommes-nous (ink) -> Solutions (blue)
  quisommes_solutions: { text: "1990", size: "text-[32vw] md:text-[21vw]", pos: "right-[1%]", colorTop: ink, colorBottom: blue, opacity: 0.06 },
  // Solutions (blue) -> MEGA ERP (ink) — le « 3 » referme les trois pôles.
  solutions_megaerp: { text: "3", size: "text-[46vw] md:text-[30vw]", pos: "left-[4%]", colorTop: blue, colorBottom: ink, opacity: 0.07 },
  // MEGA ERP (ink) -> Pourquoi nous (white on dark)
  megaerp_pourquoi: { text: "ERP", size: "text-[30vw] md:text-[20vw]", pos: "right-[3%]", colorTop: ink, colorBottom: white, opacity: 0.06 },
  // Pourquoi nous (white on dark) -> Partenaires (blue)
  pourquoi_partenaires: { text: "?", size: "text-[46vw] md:text-[30vw]", pos: "right-[6%]", colorTop: white, colorBottom: blue, opacity: 0.07 },
  // Partenaires (blue) -> Témoignage (mauve) — les CINQ villes partenaires.
  // Écrit « 5 » et non « 05 » : le zéro initial le faisait lire comme un numéro
  // d’ordre, au point qu’on a cru à une numérotation de sections dont il aurait
  // manqué les quatre autres. Un chiffre nu ne laisse pas ce doute.
  partenaires_temoignage: { text: "5", size: "text-[38vw] md:text-[24vw]", pos: "left-[2%]", colorTop: blue, colorBottom: mauve, opacity: 0.07 },
  // Témoignage (mauve) -> Références (green) — les 12 000 utilisateurs actifs,
  // chiffre de la section Stats, juste avant les clients qui les emploient.
  temoignage_references: { text: "12K", size: "text-[36vw] md:text-[23vw]", pos: "right-[3%]", colorTop: mauve, colorBottom: green, opacity: 0.06 },
  // Références (green) -> Contact (blue)
  references_contact: { text: "300+", size: "text-[30vw] md:text-[21vw]", pos: "right-[2%]", colorTop: green, colorBottom: blue, opacity: 0.06 },
  // Sections libres (ink) -> Contact (blue).
  //
  // N'existe que si le client a ajouté au moins une section libre. Dans ce cas
  // le bloc reprend la couture « 300+ » venue de Références et en ouvre une
  // nouvelle ici : sans cela, les deux moitiés du chiffre seraient séparées par
  // le bloc inséré, et le filigrane apparaîtrait coupé.
  //
  // Le « + » se lit comme « et le reste » : c'est exactement ce que le bloc
  // ajoute au discours de la page.
  libres_contact: { text: "+", size: "text-[40vw] md:text-[26vw]", pos: "left-[6%]", colorTop: ink, colorBottom: blue, opacity: 0.06 },
  // Contact (blue) -> Footer (white on dark)
  contact_footer: { text: "@", size: "text-[40vw] md:text-[25vw]", pos: "left-[4%]", colorTop: blue, colorBottom: white, opacity: 0.07 },
};

const BoundaryWatermark = ({
  boundary,
  edge,
}: {
  boundary: Boundary;
  edge: "top" | "bottom";
}) => {
  const atBottom = edge === "bottom";
  return (
    <div
      aria-hidden
      className={`absolute ${boundary.pos} ${boundary.size} ${atBottom ? "bottom-0" : "top-0"} py-[0.22em] font-titrage font-black leading-none tracking-tighter whitespace-nowrap select-none pointer-events-none`}
      style={{
        transform: atBottom ? "translateY(50%)" : "translateY(-50%)",
        /* Le dégradé est découpé à la forme du texte (`background-clip: text`),
           mais un fond ne se peint que dans la boîte de l'élément. Avec
           `leading-none`, cette boîte fait exactement 1 em alors qu'un glyphe
           gras déborde au-dessus et en dessous : les hampes et les jambages ne
           recevaient aucune couleur et le chiffre apparaissait tranché net en
           haut et en bas. Le remplissage vertical rend la boîte plus haute que
           le glyphe — ajouté symétriquement, il ne déplace pas le centre, donc
           la jointure entre les deux moitiés reste exactement sur la couture. */
        backgroundImage: `linear-gradient(to bottom, ${boundary.colorTop}, ${boundary.colorBottom})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        opacity: boundary.opacity ?? 0.07,
      }}
    >
      {boundary.text}
    </div>
  );
};

export default BoundaryWatermark;
