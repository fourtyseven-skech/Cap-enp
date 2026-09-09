import sharp from "sharp";

/**
 * ---------------------------------------------------------------------------
 * CONVERSION DES IMAGES EN WEBP
 * ---------------------------------------------------------------------------
 *
 * Une seule implémentation, partagée par les deux chemins d'envoi :
 *
 *   · `src/contenu/mediasDev.ts` — le serveur de développement, en mode local ;
 *   · `serveur/src/images.ts`    — l'API, en mode serveur.
 *
 * Deux implémentations auraient fini par diverger, et la même image aurait
 * donné deux fichiers différents selon l'endroit d'où elle a été envoyée.
 *
 * ⚠️ Ce module tourne UNIQUEMENT dans Node : `sharp` est un module natif, il
 * n'existe pas dans un navigateur. Il est importé par le serveur de
 * développement et par les scripts de build — jamais par un composant.
 */

/**
 * Largeur maximale conservée.
 *
 * Aucun emplacement du site n'affiche plus large que la colonne d'un article.
 * Garder 6 000 pixels ne change rien à ce que voit le visiteur et fait payer la
 * différence à chaque chargement.
 */
export const LARGEUR_MAX = 2000;

/**
 * Qualité WebP.
 *
 * 82 est le point où l'on cesse de voir la différence sur une photographie tout
 * en divisant le poids par cinq à dix. Monter à 95 double le fichier sans gain
 * perceptible ; descendre à 70 fait apparaître des artefacts dans les dégradés.
 */
export const QUALITE = 82;

export type ImageConvertie = {
  octets: Buffer;
  largeur: number;
  hauteur: number;
  taille: number;
};

/**
 * Le type réel d'un fichier, lu dans ses premiers octets.
 *
 * Ni l'extension ni le type annoncé par le navigateur ne sont dignes de
 * confiance : les deux viennent du client. La signature, elle, est dans le
 * fichier.
 *
 * Le SVG est volontairement absent : il peut contenir du code exécutable, et
 * devient une faille dès qu'il est servi depuis le même domaine que le site.
 */
export const reconnaitreImage = (o: Buffer): string | null => {
  const hex = (n: number, l: number) => o.subarray(n, n + l).toString("hex");
  const ascii = (n: number, l: number) => o.subarray(n, n + l).toString("ascii");

  if (hex(0, 3) === "ffd8ff") return "image/jpeg";
  if (hex(0, 8) === "89504e470d0a1a0a") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftypavif") return "image/avif";
  if (ascii(0, 3) === "GIF") return "image/gif";
  return null;
};

export const convertirEnWebp = async (
  octets: Buffer,
  typeReel: string
): Promise<ImageConvertie> => {
  /*
   * `animated: true` pour les GIF.
   *
   * Sans cette option, sharp ne lit que la première image et une animation
   * arrive en ligne figée — sans erreur, sans message.
   */
  const anime = typeReel === "image/gif";
  const source = sharp(octets, { animated: anime, failOn: "error" });

  const depart = await source.metadata();
  if (!depart.width || !depart.height) {
    throw new Error("Ce fichier ne semble pas être une image valide.");
  }

  /*
   * Sur un GIF animé, `height` est la hauteur de la BANDE complète — toutes les
   * vignettes empilées. La hauteur d'une image seule est `pageHeight`.
   */
  const hauteurReelle = depart.pageHeight ?? depart.height;

  let travail = source;
  if (depart.width > LARGEUR_MAX) {
    travail = travail.resize({ width: LARGEUR_MAX, withoutEnlargement: true });
  }

  /*
   * Avec perte d'abord, sans perte en repli.
   *
   * Le mode avec perte convient aux photographies. Mais une capture d'écran ou
   * un logo — peu de couleurs, de grands aplats, des bords nets — se compresse
   * déjà très bien en PNG, et le WebP avec perte produit alors un fichier PLUS
   * GROS tout en dégradant les contours du texte.
   *
   * Trouvé en recette : une image de 78 Ko ressortait à 1,4 Mo.
   */
  let converti = await travail.webp({ quality: QUALITE, effort: 4 }).toBuffer();

  if (converti.length >= octets.length) {
    const sansPerte = await travail.webp({ lossless: true, effort: 4 }).toBuffer();
    if (sansPerte.length < converti.length) converti = sansPerte;
  }

  const echelle = depart.width > LARGEUR_MAX ? LARGEUR_MAX / depart.width : 1;

  return {
    octets: converti,
    largeur: Math.round(depart.width * echelle),
    hauteur: Math.round(hauteurReelle * echelle),
    taille: converti.length,
  };
};
