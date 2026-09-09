/**
 * ---------------------------------------------------------------------------
 * MÉDIATHÈQUE
 * ---------------------------------------------------------------------------
 *
 * Les plafonds du cadrage MEGA-WEB-004 sont appliqués ICI, à l'import, et non
 * rappelés dans une consigne. C'est le point essentiel : une charte que le
 * rédacteur doit se souvenir de respecter sera oubliée — d'autant plus quand la
 * personne qui publie est le dirigeant, pressé et légitime à passer outre.
 *
 * Le traitement (redimensionnement, conversion WebP, ré-encodage) se fait dans
 * le navigateur pour cette simulation. Sur un serveur il devra être refait
 * côté serveur : un traitement navigateur se contourne, et le ré-encodage est
 * aussi ce qui neutralise une charge dissimulée dans un fichier image.
 *
 * Stockage en IndexedDB et non localStorage : les images dépassent largement
 * le quota d'environ 5 Mo de ce dernier.
 */

export const PLAFONDS = {
  /** Refus immédiat au-delà — évite de faire travailler le navigateur pour rien. */
  sourceMo: 15,
  sourcePx: 8000,
  /** Largeur conservée après traitement. */
  largeurMax: 1600,
  /** Déclinaisons produites pour le srcset. */
  tailles: [400, 800, 1600],
  /** Poids visé, puis plafond dur — la qualité baisse par paliers jusqu'à passer. */
  poidsCibleKo: 180,
  poidsMaxKo: 300,
  /** Couverture de partage : ratio Open Graph. */
  couverture: { l: 1200, h: 630 },
};

export type Media = {
  id: string;
  nom: string;
  alt: string;
  mime: string;
  largeur: number;
  hauteur: number;
  poids: number;
  /** Déclinaisons en data URL — remplacées par des chemins côté serveur. */
  variantes: { largeur: number; url: string; poids: number }[];
  cree_le: string;
  par: string;
  /** Mots-clés de classement, saisis dans le panel. */
  etiquettes?: string[];
  /** Légende affichée sous l'image dans l'article. Facultative. */
  legende?: string;
  /** Ce qu'était le fichier déposé, avant traitement — sert à justifier le gain. */
  origine?: { nom: string; largeur: number; hauteur: number; poids: number; mime: string };
};

/* ---------------------------------------------------------------- IndexedDB */

const BASE = "ms-admin-medias";
const TABLE = "medias";

const ouvrir = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(TABLE)) r.result.createObjectStore(TABLE, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const transaction = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await ouvrir();
  return new Promise<T>((res, rej) => {
    const r = f(db.transaction(TABLE, mode).objectStore(TABLE));
    r.onsuccess = () => res(r.result as T);
    r.onerror = () => rej(r.error);
  });
};

export const listerMedias = () => transaction<Media[]>("readonly", (s) => s.getAll());
export const supprimerMedia = (id: string) => transaction<undefined>("readwrite", (s) => s.delete(id));
export const obtenirMedia = (id: string) => transaction<Media | undefined>("readonly", (s) => s.get(id));

/**
 * Modifie les métadonnées d'un média — nom, texte alternatif, légende,
 * étiquettes. L'identifiant ne change JAMAIS : c'est lui que les articles
 * citent, le renommer casserait toutes les images déjà posées.
 */
export const majMedia = async (
  id: string,
  patch: Partial<Pick<Media, "nom" | "alt" | "legende" | "etiquettes">>
): Promise<Media | undefined> => {
  const m = await obtenirMedia(id);
  if (!m) return undefined;
  const maj = { ...m, ...patch };
  await transaction("readwrite", (s) => s.put(maj));
  return maj;
};

/* ------------------------------------------------------------- Traitement */

const chargerImage = (fichier: File): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("Fichier illisible comme image."));
    };
    img.src = url;
  });

/** Réduit puis encode en WebP, en baissant la qualité jusqu'à passer sous le plafond. */
const encoder = (img: HTMLImageElement, largeur: number): { url: string; poids: number; h: number } => {
  const ratio = img.naturalHeight / img.naturalWidth;
  const l = Math.min(largeur, img.naturalWidth);
  const h = Math.round(l * ratio);

  const c = document.createElement("canvas");
  c.width = l;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, l, h);

  let qualite = 0.82;
  let url = c.toDataURL("image/webp", qualite);
  let poids = Math.round((url.length * 3) / 4 / 1024);

  // Paliers dégressifs : on ne descend jamais sous 0,45, en deçà l'image se voit.
  while (poids > PLAFONDS.poidsMaxKo && qualite > 0.45) {
    qualite -= 0.1;
    url = c.toDataURL("image/webp", qualite);
    poids = Math.round((url.length * 3) / 4 / 1024);
  }
  return { url, poids, h };
};

export type Resultat = { ok: boolean; raison?: string; media?: Media };

/**
 * Importe une image. Le texte alternatif est exigé à l'appel : c'est un
 * contrôle bloquant du cadrage, il ne doit pas pouvoir être « ajouté plus tard ».
 */
export const importer = async (fichier: File, alt: string, par: string): Promise<Resultat> => {
  if (!alt.trim()) return { ok: false, raison: "Le texte alternatif est obligatoire." };
  if (!fichier.type.startsWith("image/")) return { ok: false, raison: "Seules les images sont acceptées." };

  // Le SVG peut contenir du script : refusé à l'import plutôt que nettoyé.
  if (fichier.type === "image/svg+xml") {
    return { ok: false, raison: "Le format SVG n'est pas accepté : il peut contenir du code exécutable." };
  }
  if (fichier.size > PLAFONDS.sourceMo * 1024 * 1024) {
    return { ok: false, raison: `Fichier trop lourd (${Math.round(fichier.size / 1024 / 1024)} Mo, maximum ${PLAFONDS.sourceMo} Mo).` };
  }

  let img: HTMLImageElement;
  try {
    img = await chargerImage(fichier);
  } catch {
    return { ok: false, raison: "Fichier illisible comme image." };
  }

  if (img.naturalWidth > PLAFONDS.sourcePx || img.naturalHeight > PLAFONDS.sourcePx) {
    return { ok: false, raison: `Dimensions excessives (${img.naturalWidth} × ${img.naturalHeight} px).` };
  }

  const variantes = PLAFONDS.tailles
    .filter((t) => t <= Math.max(img.naturalWidth, PLAFONDS.tailles[0]))
    .map((t) => {
      const e = encoder(img, t);
      return { largeur: Math.min(t, img.naturalWidth), url: e.url, poids: e.poids };
    });

  const principale = variantes[variantes.length - 1];
  const media: Media = {
    id: `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    nom: fichier.name.replace(/\.[^.]+$/, ""),
    alt: alt.trim(),
    mime: "image/webp",
    largeur: principale.largeur,
    hauteur: Math.round(principale.largeur * (img.naturalHeight / img.naturalWidth)),
    poids: principale.poids,
    variantes,
    cree_le: new Date().toISOString(),
    par,
    etiquettes: [],
    // Conservé pour pouvoir montrer le gain réel : c'est ce qui rend la
    // contrainte acceptable plutôt que subie.
    origine: {
      nom: fichier.name,
      largeur: img.naturalWidth,
      hauteur: img.naturalHeight,
      poids: Math.round(fichier.size / 1024),
      mime: fichier.type,
    },
  };

  await transaction("readwrite", (s) => s.put(media));
  return { ok: true, media };
};

/* ---------------------------------------------------------------------------
 * EMPLOI DANS LES ARTICLES
 * ---------------------------------------------------------------------------
 * Une image de la médiathèque pèse plusieurs dizaines de milliers de caractères
 * une fois encodée en data URL. La coller telle quelle dans le corps d'un
 * article rendrait le Markdown illisible, impossible à relire et à comparer
 * d'une version à l'autre — et la moindre correction de texte deviendrait un
 * exercice de recherche à travers un mur de base64.
 *
 * Le corps ne porte donc qu'une RÉFÉRENCE courte : `![alt](media:m_abc123)`.
 * Elle survit au renommage, se lit d'un coup d'œil, et se résout au dernier
 * moment — à l'aperçu comme à l'export — en la vraie image.
 *
 * Le jour où un serveur héberge les fichiers, seule `resoudre` change : elle
 * renverra `/medias/m_abc123-1600.webp` au lieu d'une data URL, et tous les
 * articles déjà écrits en profiteront sans être retouchés.
 * ------------------------------------------------------------------------- */

/** Repère une référence `media:ID` dans un lien Markdown ou un attribut src. */
export const REFERENCE = /media:(m_[a-z0-9]+)/gi;

/** Référence courte à insérer dans le corps de l'article. */
export const versMarkdown = (m: Media) => `![${m.alt}](media:${m.id})`;

/** Variante la plus large — celle qu'on sert par défaut. */
const principale = (m: Media) => m.variantes[m.variantes.length - 1];

/** Adresse d'une déclinaison précise, ou de la plus large par défaut. */
export const urlMedia = (m: Media, largeur?: number) =>
  (largeur ? m.variantes.find((v) => v.largeur >= largeur) ?? principale(m) : principale(m)).url;

/**
 * Remplace les références par les adresses réelles. Appelée à l'aperçu et à
 * l'export ; une référence dont le média a été supprimé est laissée telle
 * quelle, ce qui la rend visible dans l'article plutôt que silencieusement
 * transformée en image cassée.
 */
export const resoudre = (texte: string, medias: Media[]): string => {
  const parId = new Map(medias.map((m) => [m.id, m]));
  return texte.replace(REFERENCE, (brut, id: string) => {
    const m = parId.get(id);
    return m ? urlMedia(m) : brut;
  });
};

/** Identifiants des médias cités par un texte — sert au comptage d'emplois. */
export const referencesDe = (texte: string): string[] => [
  ...new Set([...texte.matchAll(REFERENCE)].map((x) => x[1])),
];

/** Balise <img> complète avec srcset, pour un collage en HTML brut. */
export const versHtml = (m: Media) =>
  `<img src="${principale(m).url}" srcset="${m.variantes
    .map((v) => `${v.url} ${v.largeur}w`)
    .join(", ")}" sizes="(max-width: 768px) 100vw, 768px" width="${m.largeur}" height="${m.hauteur}" alt="${m.alt}" loading="lazy" decoding="async" />`;

/**
 * Place occupée par la médiathèque. `navigator.storage.estimate()` répond pour
 * toute l'origine (IndexedDB + caches) : le total des médias est donc calculé à
 * part, sinon on afficherait un chiffre que rien dans l'écran n'explique.
 */
export const quota = async (): Promise<{ utiliseMo: number; disponibleMo: number } | null> => {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e?.quota) return null;
    return {
      utiliseMo: Math.round(((e.usage ?? 0) / 1024 / 1024) * 10) / 10,
      disponibleMo: Math.round((e.quota / 1024 / 1024) * 10) / 10,
    };
  } catch {
    return null;
  }
};
