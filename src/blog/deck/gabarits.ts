import {
  NUIT,
  PAPIER,
  STYLE_TABLEAU,
  THEME_MEGASOFT,
  diapositiveVide,
  forme,
  graphique,
  identifiant,
  image,
  tableau,
  texte,
  type Diapositive,
  type Element,
  type Theme,
} from "./modele";

/**
 * ---------------------------------------------------------------------------
 * GABARITS DE DÉPART
 * ---------------------------------------------------------------------------
 *
 * CE QUE CES GABARITS NE SONT PAS. Ce ne sont pas des moules : la diapositive
 * produite n'a aucun lien avec le gabarit qui l'a créée. Chaque élément est
 * ordinaire — déplaçable, redimensionnable, supprimable — exactement comme s'il
 * avait été posé à la main. C'est la différence entre un logiciel de
 * présentation et un générateur de diapositives, et c'est tout l'objet de cette
 * refonte.
 *
 * Leur seul rôle est d'éviter la page blanche. On clique « Titre et contenu »,
 * on obtient deux blocs bien placés, et on les bouge si on veut.
 *
 * LA GRILLE. Marge de 96 unités à gauche et à droite, 72 en haut et en bas, sur
 * un canevas de 1280 × 720. Ces valeurs ne sont pas arbitraires : elles
 * reproduisent les marges du site, ce qui fait qu'une diapositive et une page
 * d'article ont la même respiration.
 */

const M = 96;
const HAUT = 72;
const LARGEUR_UTILE = 1280 - M * 2;

/** La signature Megasoft : les trois barres de couleur des pôles. */
export const signature = (x = M, y = HAUT, largeur = 34): Element[] =>
  THEME_MEGASOFT.accents.map((c, i) =>
    forme({
      x: x + i * (largeur + 6),
      y,
      l: largeur,
      h: 3,
      forme: "rectangle",
      remplissage: c,
      rayon: 0,
      verrouille: true,
    })
  );

const surtitre = (contenu: string, theme: Theme, y = HAUT + 24) =>
  texte({
    x: M,
    y,
    l: LARGEUR_UTILE,
    h: 26,
    html: contenu,
    taille: 15,
    graisse: 800,
    couleur: theme.accents[0],
    majuscules: true,
    interlettre: 0.3,
    interligne: 1.2,
  });

const titre = (contenu: string, theme: Theme, y = HAUT + 66, taille = 54) =>
  texte({
    x: M,
    y,
    l: LARGEUR_UTILE,
    h: Math.round(taille * 2.2),
    html: contenu,
    taille,
    graisse: 800,
    couleur: theme.encre,
    police: "titrage",
    interligne: 1.08,
  });

const corps = (contenu: string, theme: Theme, y: number, h = 240) =>
  texte({
    x: M,
    y,
    l: LARGEUR_UTILE,
    h,
    html: contenu,
    taille: 26,
    graisse: 400,
    couleur: theme.encre,
    interligne: 1.5,
    opacite: 0.86,
  });

/* =========================================================================
 * LES GABARITS
 * ======================================================================= */

export type Gabarit = {
  cle: string;
  nom: string;
  /** Ce à quoi il sert — affiché au survol dans la bibliothèque. */
  role: string;
  produire: (theme: Theme) => Diapositive;
};

export const GABARITS: Gabarit[] = [
  {
    cle: "vierge",
    nom: "Vierge",
    role: "Une page blanche. C'est le point de départ par défaut.",
    produire: (theme) => diapositiveVide(theme.fond),
  },

  {
    cle: "ouverture",
    nom: "Ouverture",
    role: "La première diapositive : sujet, promesse, signature.",
    produire: (theme) => ({
      ...diapositiveVide(theme.fond),
      elements: [
        ...signature(M, 250, 44),
        surtitre("Megasoft Office", theme, 292),
        titre("Le titre de votre présentation", theme, 330, 64),
        corps("Une phrase qui annonce ce que la salle va y gagner.", theme, 490, 70),
      ],
    }),
  },

  {
    cle: "titre-contenu",
    nom: "Titre et contenu",
    role: "Le gabarit le plus courant : un titre, un bloc de texte.",
    produire: (theme) => ({
      ...diapositiveVide(theme.fond),
      elements: [titre("Titre de la diapositive", theme, HAUT, 44), corps("Votre contenu.", theme, HAUT + 130)],
    }),
  },

  {
    cle: "section",
    nom: "Séparateur de partie",
    role: "Annonce un chapitre. Fond sombre pour marquer la rupture.",
    produire: (theme) => ({
      ...diapositiveVide(NUIT),
      elements: [
        texte({
          x: 900,
          y: 120,
          l: 300,
          h: 300,
          html: "01",
          taille: 260,
          graisse: 900,
          couleur: "#FFFFFF",
          aligne: "droite",
          opacite: 0.06,
          police: "titrage",
          interligne: 1,
          verrouille: true,
        }),
        ...signature(M, 300, 40),
        titre("Titre de la partie", { ...theme, encre: "#FFFFFF" }, 340, 62),
      ],
    }),
  },

  {
    cle: "deux-colonnes",
    nom: "Deux colonnes",
    role: "Avant / après, ou eux / nous.",
    produire: (theme) => {
      const l = (LARGEUR_UTILE - 40) / 2;
      return {
        ...diapositiveVide(theme.fond),
        elements: [
          titre("Ce qui change", theme, HAUT, 40),
          forme({ x: M, y: 230, l, h: 340, remplissage: PAPIER, rayon: 22 }),
          texte({
            x: M + 32,
            y: 262,
            l: l - 64,
            h: 30,
            html: "Sans",
            taille: 16,
            graisse: 800,
            couleur: theme.attenue,
            majuscules: true,
            interlettre: 0.2,
          }),
          texte({
            x: M + 32,
            y: 306,
            l: l - 64,
            h: 240,
            html: "Premier point<br>Deuxième point",
            taille: 21,
            couleur: theme.encre,
            interligne: 1.7,
          }),
          forme({
            x: M + l + 40,
            y: 230,
            l,
            h: 340,
            remplissage: "#FFFFFF",
            contour: theme.accents[0],
            epaisseur: 2,
            rayon: 22,
          }),
          texte({
            x: M + l + 72,
            y: 262,
            l: l - 64,
            h: 30,
            html: "Avec",
            taille: 16,
            graisse: 800,
            couleur: theme.accents[0],
            majuscules: true,
            interlettre: 0.2,
          }),
          texte({
            x: M + l + 72,
            y: 306,
            l: l - 64,
            h: 240,
            html: "Premier point<br>Deuxième point",
            taille: 21,
            couleur: theme.encre,
            interligne: 1.7,
          }),
        ],
      };
    },
  },

  {
    cle: "chiffres",
    nom: "Chiffres clés",
    role: "La preuve chiffrée, en tuiles. Le format le plus mémorisé d'un exposé.",
    produire: (theme) => {
      const l = (LARGEUR_UTILE - 2 * 28) / 3;
      const tuiles: Element[] = [];
      [
        ["300+", "Clients accompagnés"],
        ["35+", "Années d'expertise"],
        ["12", "Modules métier"],
      ].forEach(([n, legende], i) => {
        const x = M + i * (l + 28);
        tuiles.push(
          forme({ x, y: 250, l, h: 220, remplissage: PAPIER, rayon: 24, etape: i }),
          texte({
            x: x + 28,
            y: 290,
            l: l - 56,
            h: 80,
            html: n,
            taille: 66,
            graisse: 900,
            couleur: theme.accents[i % 3],
            police: "titrage",
            interligne: 1,
            etape: i,
          }),
          texte({
            x: x + 28,
            y: 384,
            l: l - 56,
            h: 60,
            html: legende,
            taille: 15,
            graisse: 700,
            couleur: theme.attenue,
            majuscules: true,
            interlettre: 0.1,
            interligne: 1.4,
            etape: i,
          })
        );
      });
      return {
        ...diapositiveVide(theme.fond),
        elements: [titre("Megasoft en chiffres", theme, HAUT, 40), ...tuiles],
      };
    },
  },

  {
    cle: "citation",
    nom: "Citation",
    role: "Pleine page, sans rien d'autre — une citation partage mal l'écran.",
    produire: (theme) => ({
      ...diapositiveVide(PAPIER),
      elements: [
        texte({
          x: 60,
          y: 90,
          l: 200,
          h: 220,
          html: "«",
          taille: 220,
          graisse: 900,
          couleur: theme.accents[0],
          opacite: 0.16,
          police: "titrage",
          interligne: 1,
          verrouille: true,
        }),
        texte({
          x: M + 40,
          y: 210,
          l: LARGEUR_UTILE - 80,
          h: 220,
          html: "Une phrase forte, détachée du reste de l'exposé.",
          taille: 42,
          graisse: 800,
          couleur: theme.encre,
          police: "titrage",
          interligne: 1.2,
        }),
        forme({ x: M + 40, y: 470, l: 48, h: 3, remplissage: theme.accents[0], rayon: 0 }),
        texte({
          x: M + 104,
          y: 458,
          l: 500,
          h: 30,
          html: "Prénom Nom, fonction",
          taille: 18,
          graisse: 700,
          couleur: theme.attenue,
        }),
      ],
    }),
  },

  {
    cle: "image-pleine",
    nom: "Image pleine page",
    role: "L'image occupe tout, le texte se pose par-dessus.",
    produire: (theme) => ({
      ...diapositiveVide(NUIT),
      elements: [
        image({ x: 0, y: 0, l: 1280, h: 720, rayon: 0, alt: "" }),
        forme({
          x: 0,
          y: 380,
          l: 1280,
          h: 340,
          remplissage: "rgba(15,23,42,0.72)",
          rayon: 0,
          verrouille: true,
        }),
        titre("Sur le terrain", { ...theme, encre: "#FFFFFF" }, 470, 46),
      ],
    }),
  },

  {
    cle: "graphique",
    nom: "Graphique",
    role: "Barres, lignes, aires ou secteurs. Dessiné dans la page, sans service extérieur.",
    produire: (theme) => ({
      ...diapositiveVide(theme.fond),
      elements: [
        titre("L'évolution en un coup d'œil", theme, HAUT, 40),
        graphique({ x: M, y: 210, l: LARGEUR_UTILE, h: 380, couleur: theme.accents[0] }),
      ],
    }),
  },

  {
    cle: "tableau",
    nom: "Tableau",
    role: "Des données alignées. Devient un vrai tableau Markdown à la conversion en article.",
    produire: (theme) => ({
      ...diapositiveVide(theme.fond),
      elements: [
        titre("Comparatif", theme, HAUT, 40),
        tableau({
          x: M,
          y: 220,
          l: LARGEUR_UTILE,
          h: 320,
          style: { ...STYLE_TABLEAU, couleurEntete: theme.accents[0] },
        }),
      ],
    }),
  },

  {
    cle: "action",
    nom: "Appel à l'action",
    role: "La diapositive qui doit convertir. À placer juste avant la fin.",
    produire: (theme) => ({
      ...diapositiveVide(NUIT),
      elements: [
        forme({
          x: 880,
          y: -120,
          l: 520,
          h: 520,
          forme: "ellipse",
          remplissage: theme.accents[0],
          opacite: 0.22,
          verrouille: true,
        }),
        ...signature(M, 230, 44),
        titre("Un besoin de gestion à cadrer ?", { ...theme, encre: "#FFFFFF" }, 272, 52),
        texte({
          x: M,
          y: 400,
          l: 660,
          h: 80,
          html: "Chaque projet démarre par un audit de vos process réels.",
          taille: 22,
          couleur: "#FFFFFF",
          opacite: 0.62,
          interligne: 1.5,
        }),
        forme({ x: M, y: 506, l: 268, h: 62, remplissage: "#FFFFFF", rayon: 999 }),
        texte({
          x: M,
          y: 524,
          l: 268,
          h: 30,
          html: "Demander une démo",
          taille: 19,
          graisse: 800,
          couleur: NUIT,
          aligne: "centre",
        }),
      ],
    }),
  },
];

export const parCle = (cle: string) => GABARITS.find((g) => g.cle === cle);

/** Produit une diapositive à partir d'un gabarit, avec des identifiants neufs. */
export const depuisGabarit = (cle: string, theme: Theme): Diapositive => {
  const g = parCle(cle) ?? GABARITS[0];
  const d = g.produire(theme);
  // Les identifiants sont refaits ici et non dans les gabarits : deux
  // diapositives créées depuis le même gabarit partageraient sinon les
  // identifiants de leurs éléments, et le présentateur les ferait glisser l'une
  // vers l'autre comme s'il s'agissait des mêmes blocs.
  return { ...d, id: identifiant("d"), elements: d.elements.map((e) => ({ ...e, id: identifiant() })) };
};

/* Réexports utiles aux appelants qui composent leurs propres diapositives. */
export { M as MARGE, HAUT as MARGE_HAUT, LARGEUR_UTILE, corps, surtitre, titre };
