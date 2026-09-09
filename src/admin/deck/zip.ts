/**
 * ---------------------------------------------------------------------------
 * LECTURE D'ARCHIVE ZIP — sans dépendance
 * ---------------------------------------------------------------------------
 *
 * Un `.pptx` est une archive ZIP contenant du XML. Pour l'ouvrir il faut donc
 * un décompresseur.
 *
 * POURQUOI PAS UNE BIBLIOTHÈQUE. `jszip` pèse une centaine de kilooctets et
 * embarque son propre implémenteur `inflate` — écrit à une époque où les
 * navigateurs n'en avaient pas. Ils en ont un désormais :
 * `DecompressionStream('deflate-raw')`, natif, écrit en C, et déjà chargé. Il
 * ne reste qu'à lire la table des matières de l'archive, soit la centaine de
 * lignes ci-dessous.
 *
 * CE QUE ÇA COÛTE. `DecompressionStream` demande Chrome 80+, Firefox 113+ ou
 * Safari 16.4+. C'est assumé : le panel d'administration est un outil interne,
 * utilisé sur des postes à jour, et l'import s'annonce clairement indisponible
 * plutôt que d'échouer à mi-parcours.
 *
 * CE QU'ON NE FAIT PAS. Écrire une archive, gérer le chiffrement, les archives
 * multi-volumes ou Zip64 au-delà de 4 Go. Un `.pptx` n'en a jamais besoin.
 */

export type Entree = { nom: string; donnees: Uint8Array };

const TEXTE = new TextDecoder("utf-8");

/** Vrai si le navigateur sait décompresser. Testé avant d'ouvrir un fichier. */
export const decompressionDisponible = () =>
  typeof DecompressionStream !== "undefined";

const inflater = async (donnees: Uint8Array): Promise<Uint8Array> => {
  const flux = new Blob([donnees as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flux).arrayBuffer());
};

/**
 * Ouvre une archive et retourne ses fichiers.
 *
 * On lit le RÉPERTOIRE CENTRAL, en queue de fichier, et non les en-têtes
 * locaux : ceux-ci peuvent annoncer une taille nulle et renvoyer à un
 * descripteur placé APRÈS les données, ce qui oblige à deviner où elles
 * s'arrêtent. Le répertoire central, lui, donne les tailles exactes — c'est la
 * source que tout outil sérieux utilise.
 */
export const ouvrirZip = async (fichier: ArrayBuffer): Promise<Map<string, Entree>> => {
  const vue = new DataView(fichier);
  const octets = new Uint8Array(fichier);

  // Le marqueur de fin est à 22 octets de la fin, sauf si l'archive porte un
  // commentaire — on remonte donc jusqu'à 64 Ko, la taille maximale possible.
  let finCentral = -1;
  const debutRecherche = Math.max(0, octets.length - 65558);
  for (let i = octets.length - 22; i >= debutRecherche; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) {
      finCentral = i;
      break;
    }
  }
  if (finCentral < 0) throw new Error("Archive illisible : marqueur de fin introuvable.");

  const nombre = vue.getUint16(finCentral + 10, true);
  let position = vue.getUint32(finCentral + 16, true);

  const sorties = new Map<string, Entree>();

  for (let n = 0; n < nombre; n++) {
    if (vue.getUint32(position, true) !== 0x02014b50) break;

    const methode = vue.getUint16(position + 10, true);
    const tailleCompressee = vue.getUint32(position + 20, true);
    const longueurNom = vue.getUint16(position + 28, true);
    const longueurExtra = vue.getUint16(position + 30, true);
    const longueurCommentaire = vue.getUint16(position + 32, true);
    const decalageLocal = vue.getUint32(position + 42, true);
    const nom = TEXTE.decode(octets.subarray(position + 46, position + 46 + longueurNom));

    // L'en-tête local répète le nom et l'extra, avec des longueurs qui peuvent
    // DIFFÉRER de celles du répertoire central. Il faut donc les relire ici :
    // s'appuyer sur les précédentes décalerait le début des données.
    const nomLocal = vue.getUint16(decalageLocal + 26, true);
    const extraLocal = vue.getUint16(decalageLocal + 28, true);
    const debut = decalageLocal + 30 + nomLocal + extraLocal;
    const brut = octets.subarray(debut, debut + tailleCompressee);

    if (!nom.endsWith("/")) {
      sorties.set(nom, {
        nom,
        donnees: methode === 0 ? brut.slice() : await inflater(brut),
      });
    }

    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }

  return sorties;
};

export const enTexte = (e?: Entree) => (e ? TEXTE.decode(e.donnees) : "");

/** Convertit une entrée binaire en adresse `data:`, pour l'incorporer au document. */
export const enDataURI = (e: Entree, type: string) => {
  let binaire = "";
  // Par tranches : `String.fromCharCode(...tableau)` dépasse la taille maximale
  // de la pile d'appels dès quelques centaines de kilooctets, et une image de
  // présentation les dépasse toujours.
  const pas = 0x8000;
  for (let i = 0; i < e.donnees.length; i += pas) {
    binaire += String.fromCharCode(...e.donnees.subarray(i, i + pas));
  }
  return `data:${type};base64,${btoa(binaire)}`;
};

export const typeMime = (nom: string) => {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  const table: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    emf: "image/emf",
    wmf: "image/wmf",
  };
  return table[ext] ?? "application/octet-stream";
};
