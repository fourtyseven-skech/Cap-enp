/**
 * ---------------------------------------------------------------------------
 * MODÈLE DE DOCUMENT — aligné sur `nyblnet/bento`
 * ---------------------------------------------------------------------------
 *
 * Une diapositive est une PAGE VIDE sur laquelle on POSE des éléments, à
 * l'endroit qu'on veut, à la taille qu'on veut. Elle n'a pas de « type » : elle
 * a une liste d'éléments, chacun portant sa géométrie. Les gabarits ne sont pas
 * des moules, seulement des points de départ qui produisent des éléments
 * ordinaires, immédiatement déplaçables et supprimables.
 *
 * REPÈRE DE COORDONNÉES. Tout est exprimé dans un canevas de 1280 × 720 — le
 * « 16:9 » de tous les logiciels du genre. La scène entière est ensuite mise à
 * l'échelle. Un texte de 44 unités occupe donc la même part de l'écran sur un
 * portable et sur un vidéoprojecteur, et l'éditeur peut travailler à 60 % sans
 * que la composition change.
 *
 * MORPHING. Un élément conserve son identifiant quand on duplique une
 * diapositive. Deux diapositives qui partagent un identifiant d'élément le font
 * donc GLISSER de l'une à l'autre. `morph` permet d'apparier deux éléments
 * créés séparément sans toucher à leur identité — c'est exactement la
 * distinction `id` / `morphId` de bento, et elle compte : réaffecter un `id`
 * pour créer une paire casserait la sélection, les groupes et l'historique.
 *
 * ISOMORPHE. Aucun accès au DOM ni à `window` : ce module est lu par l'éditeur,
 * par le présentateur, et par l'export qui rend les diapositives hors
 * navigateur.
 */

/* =========================================================================
 * GÉOMÉTRIE
 * ======================================================================= */

export const FORMATS = {
  "16:9": { largeur: 1280, hauteur: 720 },
  "4:3": { largeur: 1024, hauteur: 768 },
  "A4 paysage": { largeur: 1123, hauteur: 794 },
} as const;

export type NomFormat = keyof typeof FORMATS;

export type Boite = {
  x: number;
  y: number;
  l: number;
  h: number;
  /** Rotation en degrés, sens horaire, autour du centre de la boîte. */
  rot?: number;
};

/* =========================================================================
 * PEINTURE
 * ======================================================================= */

/**
 * Dégradé linéaire. Les couleurs acceptent toute notation CSS, `rgba()`
 * comprise — c'est ce qui permet un dégradé qui s'efface plutôt que de virer
 * vers une autre teinte.
 */
export type Degrade = {
  /** Degrés, convention CSS : 0 = bas→haut, 90 = gauche→droite. */
  angle: number;
  /** Arrêts ordonnés ; `a` va de 0 à 1 le long de la ligne du dégradé. */
  arrets: { a: number; couleur: string }[];
};

/**
 * Ombre portée, appliquée en `drop-shadow` et non en `box-shadow` : elle suit
 * ainsi la FORME RÉELLE de l'élément — coins arrondis, ellipse, découpe d'une
 * image transparente, contour des lettres. Une `box-shadow` dessinerait un
 * rectangle derrière un rond.
 */
export type Ombre = { x?: number; y?: number; flou: number; couleur: string };

export const degradeCss = (d: Degrade) =>
  `linear-gradient(${d.angle}deg, ${d.arrets
    .slice()
    .sort((a, b) => a.a - b.a)
    .map((s) => `${s.couleur} ${Math.round(s.a * 100)}%`)
    .join(", ")})`;

/* =========================================================================
 * ÉLÉMENTS
 * ======================================================================= */

export type Aligne = "gauche" | "centre" | "droite";
export type Graphe = "barres" | "lignes" | "aires" | "secteurs" | "nuage";

/** Animation d'entrée d'un élément, jouée en mode présentation seulement. */
export type Entree =
  | "fondu"
  | "fondu-haut"
  | "fondu-bas"
  | "glisse-gauche"
  | "glisse-droite"
  | "glisse-haut"
  | "glisse-bas"
  | "zoom";

type Commun = Boite & {
  id: string;
  /**
   * Appariement de morphing explicite. Absent, c'est `id` qui fait foi — le cas
   * courant, celui de la diapositive dupliquée.
   */
  morph?: string;
  /**
   * Empêche la sélection à la souris. Sert aux fonds, aux filigranes et aux
   * éléments d'un gabarit qu'on ne veut plus déplacer par mégarde. Le panneau
   * des calques reste le moyen de les reprendre.
   */
  verrouille?: boolean;
  masque?: boolean;
  opacite?: number;
  /** Une ou plusieurs ombres : une élévation sombre plus un halo clair, par ex. */
  ombre?: Ombre | Ombre[];
  /** Flou gaussien SUR l'élément, en unités du canevas. */
  flou?: number;
  /** Mode de fusion CSS : `screen` pour un halo, `multiply` pour un duotone. */
  fusion?: string;
  /**
   * Groupe d'édition : les éléments partageant cette clé se sélectionnent et se
   * déplacent ensemble. Alt-clic descend jusqu'à l'élément isolé.
   */
  groupe?: string;
  /**
   * Rôle de mise en page — ce que l'élément EST sur la diapositive. Sert au
   * changement de gabarit, qui déplace le contenu entre éléments de même rôle,
   * à la manière des espaces réservés de PowerPoint.
   */
  role?: "titre" | "sous-titre" | "corps" | "etiquette";
  /** Pendant la présentation, un clic saute vers la diapositive d'identifiant. */
  lien?: string;
  /**
   * Apparition différée : l'élément ne paraît qu'au N-ième clic. Zéro ou
   * absent, il est là dès l'arrivée. C'est l'« apparition au clic » des
   * logiciels de présentation.
   */
  etape?: number;
  /** Effets de présentation, joués en mode projection uniquement. */
  fx?: {
    entree?: Entree;
    /** Durée en secondes ; absente, la valeur par défaut du type d'entrée. */
    duree?: number;
    /** Rang dans l'enchaînement ; deux rangs égaux entrent ensemble. */
    ordre?: number;
    /** Anime les nombres du texte de zéro jusqu'à leur valeur. */
    compteur?: boolean;
  };
};

export type ElTexte = Commun & {
  type: "texte";
  /** HTML EN LIGNE uniquement : gras, italique, souligné, liens. Jamais de blocs. */
  html: string;
  taille: number;
  graisse: number;
  couleur: string;
  /** Peint dans les lettres ; l'emporte sur `couleur`. */
  degrade?: Degrade;
  aligne: Aligne;
  interligne: number;
  interlettre?: number;
  majuscules?: boolean;
  italique?: boolean;
  souligne?: boolean;
  police?: "sans" | "titrage" | "mono";
  vertical?: "haut" | "milieu" | "bas";
  /**
   * Lettres évidées. `remplissage: "none"` rend l'intérieur transparent — le
   * grand mot creux d'un séparateur de partie.
   */
  contourTexte?: { epaisseur: number; couleur: string; remplissage?: string };
  /**
   * Point de liste, dessiné À L'INTÉRIEUR du bloc.
   *
   * Un cercle posé à côté aurait été plus simple, mais aurait fait de chaque
   * puce deux objets : on en déplacerait un et pas l'autre, et la conversion en
   * article n'aurait aucun moyen de savoir qu'il s'agissait d'une liste.
   */
  puce?: boolean;
  /** Invite d'espace réservé, affichée grisée tant que le bloc est vide. */
  invite?: string;
};

export type NomForme = "rectangle" | "ellipse" | "triangle" | "losange" | "ligne" | "fleche" | "barre" | "etoile";
export type BoutLigne = "aucun" | "fleche" | "point" | "barre";

export type ElForme = Commun & {
  type: "forme";
  forme: NomForme;
  remplissage: string;
  /** L'emporte sur `remplissage`, qui reste le repli plein. */
  degrade?: Degrade;
  contour: string;
  epaisseur: number;
  rayon: number;
  trait?: "plein" | "tirets" | "points";
  debut?: BoutLigne;
  fin?: BoutLigne;
};

export type ElImage = Commun & {
  type: "image";
  src: string;
  alt: string;
  ajustement: "couvrir" | "contenir" | "etirer";
  rayon: number;
};

export type ElGraphique = Commun & {
  type: "graphique";
  graphe: Graphe;
  serie: { etiquette: string; valeur: number }[];
  couleur: string;
  /** Palette de série ; absente, elle dérive de `couleur` et du thème. */
  palette?: string[];
  grille: boolean;
  legende?: string;
  empile?: boolean;
};

export type CelluleTableau = { html: string; aligne?: Aligne; couleur?: string; fond?: string; gras?: boolean };

/** Look d'ensemble du tableau. Les cellules ne portent que des exceptions. */
export type StyleTableau = {
  fondEntete: string;
  couleurEntete: string;
  /** Teinte des lignes paires ; absente, pas de zébrure. */
  zebrure?: string;
  couleurBord: string;
  epaisseurBord: number;
  padX: number;
  padY: number;
  taille: number;
  couleur: string;
  rayon: number;
};

export type ElTableau = Commun & {
  type: "tableau";
  /** Poids fractionnaires des colonnes, normalisés au rendu. */
  colonnes: { p: number }[];
  lignes: CelluleTableau[][];
  entete: boolean;
  style: StyleTableau;
};

export type ElVideo = Commun & {
  type: "media";
  nature: "video" | "audio";
  src: string;
  affiche?: string;
  ajustement?: "couvrir" | "contenir";
  rayon?: number;
  auto?: boolean;
  boucle?: boolean;
  muet?: boolean;
  controles?: boolean;
};

export type Element = ElTexte | ElForme | ElImage | ElGraphique | ElTableau | ElVideo;
export type TypeElement = Element["type"];

/* =========================================================================
 * DIAPOSITIVE ET DOCUMENT
 * ======================================================================= */

export type Transition = "aucune" | "fondu" | "glisse" | "zoom" | "morph";

export type Fond = {
  couleur: string;
  degrade?: Degrade;
  image?: string;
  voile?: number;
};

export type Diapositive = {
  id: string;
  nom?: string;
  fond: Fond;
  elements: Element[];
  notes: string;
  transition?: Transition;
  /**
   * Hors du déroulé linéaire : sautée en projection et à l'export PDF, mais
   * toujours modifiable et atteignable par un lien. C'est ce qui sert au
   * matériel d'annexe qu'on ne montre que si on vous le demande.
   */
  masque?: boolean;
  /** Ancre de l'article correspondant, quand la présentation en est dérivée. */
  ancre?: string;
};

/**
 * Palette du document. Les couleurs du site sont les valeurs par défaut, mais
 * elles restent MODIFIABLES : une présentation faite pour un client peut
 * emprunter ses couleurs sans qu'on touche au code.
 */
export type Theme = {
  fond: string;
  encre: string;
  attenue: string;
  accents: [string, string, string];
  /** Couleurs de série des nouveaux graphiques. */
  paletteGraphique?: string[];
  tableau?: Partial<StyleTableau>;
};

export type Document = {
  version: 3;
  id: string;
  titre: string;
  format: NomFormat;
  theme: Theme;
  diapositives: Diapositive[];
  meta: {
    auteur: string;
    cree_le: string;
    maj_le: string;
    slug?: string;
    categorie?: string;
    societe?: string;
    sujet?: string;
    /** Slug de l'article dont ce document est issu, le cas échéant. */
    article?: string;
  };
};

/* =========================================================================
 * VALEURS DE DÉPART
 * ======================================================================= */

/**
 * Thème par défaut : la charte du site.
 *
 * FOND BLANC. Aucun logiciel de présentation ne livre une page vierge sombre —
 * on part du blanc, et on assombrit une diapositive quand on veut qu'elle
 * tranche. L'encre et les trois accents sont ceux des pôles Megasoft.
 */
export const THEME_MEGASOFT: Theme = {
  fond: "#FFFFFF",
  encre: "#0F172A",
  attenue: "#64748B",
  accents: ["#3B82F6", "#EC4899", "#22C55E"],
};

export const NUIT = "#0F172A";
export const PAPIER = "#F7F5F1";

export const STYLE_TABLEAU: StyleTableau = {
  fondEntete: "transparent",
  couleurEntete: "#3B82F6",
  couleurBord: "rgba(15,23,42,0.10)",
  epaisseurBord: 1,
  padX: 14,
  padY: 10,
  taille: 18,
  couleur: "#0F172A",
  rayon: 12,
};

/**
 * Compteur des identifiants prévisibles. `null` = tirage au sort.
 *
 * Voir `avecIdentifiantsStables` juste en dessous.
 */
let compteurStable: number | null = null;

/**
 * Exécute un travail en rendant les identifiants PRÉVISIBLES.
 *
 * POURQUOI
 * --------
 * Les présentations dérivées des articles sont produites au build et déposées
 * dans la page. Avec des identifiants tirés au sort, deux constructions du même
 * article donnaient deux pages différentes alors que rien n'avait changé.
 *
 * Invisible à l'œil — même texte, même poids, quelques caractères au milieu
 * d'un bloc JSON — mais un build non reproductible empêche de répondre à la
 * seule question qui compte pendant une migration de contenu : « ma
 * modification a-t-elle changé autre chose que ce que je voulais ? »
 *
 * CE QUE ÇA NE CHANGE PAS
 * -----------------------
 * Les identifiants n'ont besoin d'être uniques QUE dans un document. Un
 * compteur le garantit aussi bien qu'un tirage, et sans collision possible.
 *
 * Hors de cet appel, le tirage au sort reste la règle : une présentation créée
 * à la main dans le panel n'a aucune source dont hériter, et deux documents
 * créés à la suite ne doivent pas porter les mêmes identifiants.
 */
export const avecIdentifiantsStables = <T>(travail: () => T): T => {
  const precedent = compteurStable;
  compteurStable = 0;
  try {
    return travail();
  } finally {
    // On restaure au lieu de remettre à `null` : un appel imbriqué ne doit pas
    // rendre le tirage au sort à celui qui l'englobe.
    compteurStable = precedent;
  }
};

export const identifiant = (prefixe = "e") =>
  compteurStable === null
    ? `${prefixe}_${Math.random().toString(36).slice(2, 9)}`
    : `${prefixe}_${(++compteurStable).toString(36).padStart(5, "0")}`;

export const dimensions = (doc: Document) => FORMATS[doc.format];

export const diapositiveVide = (fond = THEME_MEGASOFT.fond): Diapositive => ({
  id: identifiant("d"),
  fond: { couleur: fond },
  elements: [],
  notes: "",
  transition: "fondu",
});

export const documentVide = (auteur: string, titre = "Nouvelle présentation"): Document => {
  const maintenant = new Date().toISOString();
  return {
    version: 3,
    id: identifiant("doc"),
    titre,
    format: "16:9",
    theme: { ...THEME_MEGASOFT },
    diapositives: [diapositiveVide()],
    meta: { auteur, cree_le: maintenant, maj_le: maintenant },
  };
};

/* =========================================================================
 * FABRIQUES
 * ======================================================================= */

export const texte = (p: Partial<ElTexte> = {}): ElTexte => ({
  id: identifiant(),
  type: "texte",
  x: 120,
  y: 300,
  l: 560,
  h: 90,
  html: "Votre texte",
  taille: 32,
  graisse: 500,
  couleur: THEME_MEGASOFT.encre,
  aligne: "gauche",
  interligne: 1.3,
  police: "sans",
  vertical: "haut",
  ...p,
});

export const forme = (p: Partial<ElForme> = {}): ElForme => ({
  id: identifiant(),
  type: "forme",
  x: 480,
  y: 260,
  l: 320,
  h: 200,
  forme: "rectangle",
  remplissage: THEME_MEGASOFT.accents[0],
  contour: "transparent",
  epaisseur: 0,
  rayon: 16,
  ...p,
});

export const image = (p: Partial<ElImage> = {}): ElImage => ({
  id: identifiant(),
  type: "image",
  x: 420,
  y: 170,
  l: 440,
  h: 300,
  src: "",
  alt: "",
  ajustement: "couvrir",
  rayon: 12,
  ...p,
});

export const graphique = (p: Partial<ElGraphique> = {}): ElGraphique => ({
  id: identifiant(),
  type: "graphique",
  x: 180,
  y: 190,
  l: 800,
  h: 380,
  graphe: "barres",
  serie: [
    { etiquette: "2023", valeur: 42 },
    { etiquette: "2024", valeur: 58 },
    { etiquette: "2025", valeur: 76 },
  ],
  couleur: THEME_MEGASOFT.accents[0],
  grille: true,
  ...p,
});

const cell = (html = ""): CelluleTableau => ({ html });

export const tableau = (p: Partial<ElTableau> = {}): ElTableau => ({
  id: identifiant(),
  type: "tableau",
  x: 200,
  y: 220,
  l: 760,
  h: 260,
  entete: true,
  colonnes: [{ p: 1 }, { p: 1 }],
  lignes: [
    [cell("Colonne"), cell("Colonne")],
    [cell("Valeur"), cell("Valeur")],
    [cell("Valeur"), cell("Valeur")],
  ],
  style: { ...STYLE_TABLEAU },
  ...p,
});

export const media = (p: Partial<ElVideo> = {}): ElVideo => ({
  id: identifiant(),
  type: "media",
  nature: "video",
  x: 340,
  y: 160,
  l: 600,
  h: 338,
  src: "",
  ajustement: "couvrir",
  rayon: 12,
  controles: true,
  muet: true,
  ...p,
});

export const FABRIQUES: Record<TypeElement, (p?: Partial<Element>) => Element> = {
  texte: (p) => texte(p as Partial<ElTexte>),
  forme: (p) => forme(p as Partial<ElForme>),
  image: (p) => image(p as Partial<ElImage>),
  graphique: (p) => graphique(p as Partial<ElGraphique>),
  tableau: (p) => tableau(p as Partial<ElTableau>),
  media: (p) => media(p as Partial<ElVideo>),
};

export const cellule = cell;

/* =========================================================================
 * OPÉRATIONS
 * ======================================================================= */

/**
 * Duplique une diapositive EN CONSERVANT les identifiants de ses éléments.
 *
 * C'est là que se joue le morphing, et c'est contre-intuitif : partout ailleurs
 * une copie reçoit de nouveaux identifiants. Ici, garder les mêmes est
 * précisément ce qui permet au présentateur de reconnaître « le même titre » de
 * part et d'autre et de le faire glisser. Dupliquer, déplacer un bloc, et
 * l'animation existe — sans rien déclarer.
 */
export const dupliquerDiapositive = (d: Diapositive): Diapositive => ({
  ...structuredClone(d),
  id: identifiant("d"),
});

/**
 * Duplique en COUPANT le lien de morphing : chaque élément reçoit une nouvelle
 * identité. À utiliser quand on réemploie une mise en page pour un contenu sans
 * rapport, où voir les blocs glisser depuis la diapositive précédente n'aurait
 * aucun sens.
 */
export const dupliquerSansMorph = (d: Diapositive): Diapositive => ({
  ...structuredClone(d),
  id: identifiant("d"),
  elements: structuredClone(d.elements).map((e) => ({ ...e, id: identifiant() })),
});

/** Rectangle englobant d'un ensemble d'éléments, rotation ignorée. */
export const englobant = (elements: Element[]): Boite | null => {
  if (!elements.length) return null;
  const x = Math.min(...elements.map((e) => e.x));
  const y = Math.min(...elements.map((e) => e.y));
  const x2 = Math.max(...elements.map((e) => e.x + e.l));
  const y2 = Math.max(...elements.map((e) => e.y + e.h));
  return { x, y, l: x2 - x, h: y2 - y };
};

/** Nombre de clics nécessaires pour dévoiler entièrement une diapositive. */
export const nombreEtapes = (d: Diapositive) =>
  d.elements.reduce((n, e) => Math.max(n, e.etape ?? 0), 0);

/**
 * Étend une sélection aux membres des groupes concernés.
 *
 * Cliquer un membre prend le groupe entier : c'est ce que font tous les
 * logiciels du genre, et c'est ce qui rend le groupage utile — sans quoi il ne
 * serait qu'une étiquette décorative.
 */
export const etendreAuxGroupes = (elements: Element[], ids: string[]): string[] => {
  const groupes = new Set(
    elements.filter((e) => ids.includes(e.id) && e.groupe).map((e) => e.groupe as string)
  );
  if (!groupes.size) return ids;
  const sortie = new Set(ids);
  for (const e of elements) if (e.groupe && groupes.has(e.groupe)) sortie.add(e.id);
  return [...sortie];
};

/* =========================================================================
 * RELECTURE
 * ======================================================================= */

/**
 * Relit un document venu de l'extérieur — import JSON, sauvegarde, futur
 * serveur — en complétant ce qui manque et en migrant les formats antérieurs.
 *
 * Un fichier écrit à la main ou produit par un agent — le cas d'usage
 * revendiqué par bento — n'aura jamais tous les champs. Refuser un document
 * pour une propriété absente fermerait la porte à cet usage ; on pose les
 * valeurs par défaut et on l'ouvre.
 */
export const relire = (brut: unknown, auteur = "Inconnu"): Document | null => {
  const d = brut as Partial<Document> & { diapositives?: unknown[] };
  if (!d || typeof d !== "object" || !Array.isArray(d.diapositives)) return null;

  const maintenant = new Date().toISOString();
  return {
    version: 3,
    id: d.id ?? identifiant("doc"),
    titre: d.titre ?? "Présentation importée",
    format: d.format && d.format in FORMATS ? d.format : "16:9",
    theme: { ...THEME_MEGASOFT, ...(d.theme ?? {}) },
    diapositives: (d.diapositives as Partial<Diapositive>[]).map((s) => ({
      id: s?.id ?? identifiant("d"),
      nom: s?.nom,
      fond: { couleur: THEME_MEGASOFT.fond, ...(s?.fond ?? {}) },
      elements: Array.isArray(s?.elements) ? s.elements.filter(Boolean).map(normaliser) : [],
      notes: s?.notes ?? "",
      transition: s?.transition ?? "fondu",
      ancre: s?.ancre,
      masque: s?.masque,
    })),
    meta: {
      auteur: d.meta?.auteur ?? auteur,
      cree_le: d.meta?.cree_le ?? maintenant,
      maj_le: maintenant,
      slug: d.meta?.slug,
      categorie: d.meta?.categorie,
      societe: d.meta?.societe,
      sujet: d.meta?.sujet,
      article: d.meta?.article,
    },
  };
};

/** Complète un élément partiel avec les valeurs par défaut de son type. */
const normaliser = (e: Element): Element => {
  const base = { ...e, id: e.id ?? identifiant() };
  switch (e.type) {
    case "forme":
      return forme(base as Partial<ElForme>);
    case "image":
      return image(base as Partial<ElImage>);
    case "graphique":
      return graphique(base as Partial<ElGraphique>);
    case "tableau": {
      const t = tableau(base as Partial<ElTableau>);
      // Un tableau importé peut décrire ses cellules en simples chaînes : on
      // accepte les deux, sinon un fichier écrit à la main serait refusé pour
      // un détail de forme.
      const lignes = (t.lignes as unknown as (CelluleTableau | string)[][]).map((r) =>
        r.map((c) => (typeof c === "string" ? cell(c) : { html: "", ...c }))
      );
      const colonnes = t.colonnes?.length ? t.colonnes : (lignes[0] ?? []).map(() => ({ p: 1 }));
      return { ...t, lignes, colonnes, style: { ...STYLE_TABLEAU, ...(t.style ?? {}) } };
    }
    case "media":
      return media(base as Partial<ElVideo>);
    default:
      return texte(base as Partial<ElTexte>);
  }
};
