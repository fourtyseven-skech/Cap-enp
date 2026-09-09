/**
 * ---------------------------------------------------------------------------
 * LE POIDS DES FICHIERS ENVOYÉS
 * ---------------------------------------------------------------------------
 *
 * POURQUOI DES SEUILS
 * -------------------
 * Le temps de chargement de ce site a été gagné à la main : images en WebP,
 * vidéos déclinées en deux résolutions, pré-génération des pages. Une seule
 * vidéo de 40 Mo déposée depuis le panel efface tout ce travail, et personne
 * ne s'en aperçoit — le site reste beau sur le poste de bureau qui l'a
 * envoyée, et devient inutilisable sur un téléphone en 3G.
 *
 * Interdire serait plus simple, mais faux : il existe de bonnes raisons de
 * publier un fichier lourd, et ce n'est pas au développeur de décider à la
 * place du client ce qu'il a le droit de mettre sur son propre site.
 *
 * Donc trois paliers :
 *
 *   · VERT    — rien à dire ;
 *   · ORANGE  — un avertissement, l'envoi se fait quand même ;
 *   · ROUGE   — l'envoi est REFUSÉ tant qu'une case explicite n'est pas
 *               cochée, et cette acceptation part au journal avec le nom du
 *               compte, la taille réelle et la date.
 *
 * La responsabilité devient écrite, datée et signée. Ce n'est plus « le site
 * est devenu lent », c'est « le 6 septembre, tel compte a accepté un fichier
 * de 14 Mo ».
 *
 * OÙ CES SEUILS SONT APPLIQUÉS
 * ----------------------------
 * Au SERVEUR, jamais dans le navigateur seul : le panel s'en sert pour prévenir
 * à l'avance et proposer la case, mais c'est l'API qui refuse. Un fichier lourd
 * envoyé par un outil qui ignore le panel se heurte au même mur.
 *
 * ⚠️ CE FICHIER A UN MIROIR : `serveur/src/poids.ts`
 * --------------------------------------------------
 * L'API est un projet TypeScript séparé, dont la compilation refuse d'importer
 * hors de son propre `src/`. Les deux fichiers portent donc les mêmes nombres,
 * et `scripts/verifier-seuils.mjs` échoue s'ils divergent — c'est la recette
 * qui tient l'accord, pas la bonne volonté.
 */

export type GenreMedia = "image" | "video";
export type Niveau = "vert" | "orange" | "rouge";

const Ko = 1024;
const Mo = 1024 * 1024;

/**
 * Les seuils, en octets.
 *
 * Pour une IMAGE, ils s'appliquent APRÈS conversion en WebP : une photo de 4 Mo
 * prise au téléphone en fait 120 Ko une fois convertie, et l'avertir sur les
 * 4 Mo d'origine serait une fausse alerte. Pour une VIDÉO, faute de `ffmpeg`
 * sur l'hébergement, aucune conversion n'a lieu : c'est le fichier tel quel.
 */
export const SEUILS: Record<GenreMedia, { vert: number; rouge: number }> = {
  image: { vert: 300 * Ko, rouge: 1 * Mo },
  video: { vert: 3 * Mo, rouge: 10 * Mo },
};

export const niveauDePoids = (genre: GenreMedia, octets: number): Niveau => {
  const s = SEUILS[genre];
  if (octets > s.rouge) return "rouge";
  if (octets > s.vert) return "orange";
  return "vert";
};

/** « 320 Ko », « 1,4 Mo » — la forme française, séparateur compris. */
export const enPoids = (octets: number): string =>
  octets >= Mo
    ? `${(octets / Mo).toFixed(1).replace(".", ",")} Mo`
    : `${Math.round(octets / Ko)} Ko`;

/**
 * La phrase que le client coche.
 *
 * Elle nomme la taille réelle et la conséquence. « J'accepte les conditions »
 * n'engage personne ; « je comprends que ce fichier de 14 Mo ralentira le site
 * pour les visiteurs mobiles » se relit sans ambiguïté deux ans plus tard.
 */
export const phraseAssumee = (genre: GenreMedia, octets: number): string =>
  `Je comprends que ${genre === "video" ? "cette vidéo" : "cette image"} de ` +
  `${enPoids(octets)} ralentira le site pour les visiteurs mobiles, et j'assume ce choix.`;

/** L'avertissement du palier orange — informatif, il ne bloque rien. */
export const avertissement = (genre: GenreMedia, octets: number): string =>
  `${enPoids(octets)} — au-delà de ${enPoids(SEUILS[genre].vert)}, ` +
  `l'affichage se ressent sur une connexion mobile.`;
