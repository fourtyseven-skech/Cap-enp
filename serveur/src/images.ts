import sharp from "sharp";
import { ErreurHttp } from "./erreurs.js";

/**
 * ---------------------------------------------------------------------------
 * CONVERSION DES IMAGES
 * ---------------------------------------------------------------------------
 *
 * Toute image envoyée depuis le panel est convertie en **WebP** avant d'être
 * enregistrée. L'original n'est pas conservé.
 *
 * POURQUOI CONVERTIR
 * ------------------
 * Le poids. Une photo de 3 Mo prise au téléphone et déposée telle quelle dans
 * un article détruit le temps de chargement de la page — précisément ce qui a
 * été gagné à la main sur ce site. En WebP à qualité 82, la même image fait
 * quelques dizaines de kilo-octets pour une différence invisible à l'écran.
 *
 * Et c'est ce qui rend le stockage en base raisonnable : quelques dizaines de
 * kilo-octets par image, PostgreSQL les tient sans effort. Trois mégaoctets,
 * multipliés par des centaines d'images, alourdiraient chaque sauvegarde.
 *
 * POURQUOI PAS DE PROFIL DE REPLI
 * -------------------------------
 * WebP est reconnu par tous les navigateurs depuis 2020, Safari compris. Garder
 * un JPEG de secours doublerait le stockage pour une population de visiteurs
 * qui n'existe plus.
 */

/**
 * Largeur maximale conservée.
 *
 * Au-delà, l'image est réduite. Aucun emplacement du site n'affiche plus large
 * que la colonne d'un article ; conserver 6000 pixels de large ne change rien
 * à ce que voit le visiteur et fait payer la différence à chaque chargement.
 * La hauteur suit, la proportion est préservée.
 */
const LARGEUR_MAX = 2000;

/**
 * Qualité WebP.
 *
 * 82 est le point où l'on cesse de voir la différence sur des photographies,
 * tout en divisant le poids par cinq à dix. Monter à 95 double le fichier sans
 * gain perceptible ; descendre à 70 fait apparaître des artefacts dans les
 * dégradés — ciels, ombres, fonds de captures d'écran.
 */
const QUALITE = 82;

export type ImageConvertie = {
  octets: Buffer;
  largeur: number;
  hauteur: number;
  taille: number;
};

/** Types que l'on sait convertir. Tout le reste est refusé plus haut. */
export const EST_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/**
 * Convertit une image en WebP.
 *
 * @param octets   le fichier reçu
 * @param typeReel le type déterminé par la SIGNATURE du fichier, jamais celui
 *                 annoncé par le navigateur
 */
export const convertirEnWebp = async (
  octets: Buffer,
  typeReel: string
): Promise<ImageConvertie> => {
  try {
    /*
     * `animated: true` pour les GIF.
     *
     * Sans cette option, sharp ne lit que la première image et une animation
     * arrive en ligne figée — sans erreur, sans message. WebP sait porter
     * l'animation, il n'y a donc aucune raison de la perdre.
     */
    const anime = typeReel === "image/gif";
    const source = sharp(octets, { animated: anime, failOn: "error" });

    const depart = await source.metadata();
    if (!depart.width || !depart.height) {
      throw new ErreurHttp(
        "donnees_invalides",
        "Ce fichier ne semble pas être une image valide."
      );
    }

    /*
     * Sur un GIF animé, `metadata().height` est la hauteur de la BANDE
     * complète — toutes les vignettes empilées. La hauteur d'une image seule
     * est `pageHeight`. Sans cette distinction, un GIF de 10 vignettes est
     * enregistré avec une hauteur dix fois trop grande, et la mise en page qui
     * s'en sert réserve dix fois trop de place.
     */
    const hauteurReelle = depart.pageHeight ?? depart.height;

    let travail = source;
    if (depart.width > LARGEUR_MAX) {
      // `withoutEnlargement` par principe : on ne veut jamais agrandir une
      // petite image, ce qui la rendrait floue sans rien apporter.
      travail = travail.resize({ width: LARGEUR_MAX, withoutEnlargement: true });
    }

    /*
     * On tente d'abord le mode AVEC PERTE, puis le mode SANS PERTE si le
     * premier n'a rien gagné.
     *
     * Le mode avec perte convient aux photographies -- c'est le cas courant.
     * Mais une capture d'écran, un logo, un graphique : peu de couleurs, de
     * grands aplats, des bords nets. Le PNG d'origine les compresse déjà très
     * bien sans rien perdre, et le WebP avec perte produit alors un fichier
     * PLUS GROS tout en dégradant les contours du texte.
     *
     * Le défaut a été trouvé en recette : une image test de 78 Ko ressortait à
     * 1,4 Mo. Sans ce contrôle, une capture d'écran déposée dans un article
     * aurait alourdi la page au lieu de l'alléger -- exactement l'inverse du
     * but de la conversion.
     */
    let converti = await travail.webp({ quality: QUALITE, effort: 4 }).toBuffer();
    let mode = "avec perte";

    if (converti.length >= octets.length) {
      const sansPerte = await travail.webp({ lossless: true, effort: 4 }).toBuffer();
      if (sansPerte.length < converti.length) {
        converti = sansPerte;
        mode = "sans perte";
      }
    }

    // Trace utile : c'est la seule façon de comprendre, plus tard, pourquoi une
    // image donnée pèse ce qu'elle pèse.
    if (converti.length >= octets.length) {
      console.warn(
        `[images] conversion sans gain (${mode}) : ` +
          `${Math.round(octets.length / 1024)} Ko vers ${Math.round(converti.length / 1024)} Ko`
      );
    }

    const echelle = depart.width > LARGEUR_MAX ? LARGEUR_MAX / depart.width : 1;

    return {
      octets: converti,
      largeur: Math.round(depart.width * echelle),
      hauteur: Math.round(hauteurReelle * echelle),
      taille: converti.length,
    };
  } catch (e) {
    if (e instanceof ErreurHttp) throw e;
    /*
     * sharp échoue sur un fichier corrompu ou tronqué. Le message d'origine
     * est technique et anglais ; il n'aide pas la personne devant l'écran et
     * renseignerait un attaquant sur la bibliothèque utilisée.
     */
    console.error("[images] conversion impossible :", e);
    throw new ErreurHttp(
      "donnees_invalides",
      "Cette image n'a pas pu être traitée. Elle est peut-être endommagée ou incomplète."
    );
  }
};
