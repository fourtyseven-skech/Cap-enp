/**
 * ---------------------------------------------------------------------------
 * LE POIDS DES FICHIERS ENVOYÉS — CÔTÉ SERVEUR
 * ---------------------------------------------------------------------------
 *
 * ⚠️ MIROIR DE `src/contenu/poids.ts`. Les nombres doivent être identiques.
 *
 * Pourquoi deux fichiers : l'API est un projet TypeScript séparé (`rootDir:
 * src`), dont la compilation refuse d'importer hors de son propre dossier.
 * Plutôt qu'un chemin relatif qui casserait `npm run build`, les deux fichiers
 * portent les mêmes seuils et `scripts/verifier-seuils.mjs` échoue s'ils
 * divergent. La recette tient l'accord, pas la mémoire du développeur.
 *
 * Le raisonnement complet — pourquoi trois paliers plutôt qu'une interdiction —
 * est écrit dans le fichier d'origine et n'est pas recopié ici.
 *
 * C'EST CE FICHIER QUI FAIT AUTORITÉ
 * ----------------------------------
 * Le panel se sert des mêmes seuils pour prévenir à l'avance, mais un refus
 * décidé dans le navigateur ne refuse rien : il suffit de ne pas passer par le
 * navigateur. Le contrôle réel est ici.
 */

export type GenreMedia = "image" | "video";
export type Niveau = "vert" | "orange" | "rouge";

const Ko = 1024;
const Mo = 1024 * 1024;

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

export const enPoids = (octets: number): string =>
  octets >= Mo
    ? `${(octets / Mo).toFixed(1).replace(".", ",")} Mo`
    : `${Math.round(octets / Ko)} Ko`;
