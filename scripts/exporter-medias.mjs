import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";

/**
 * ---------------------------------------------------------------------------
 * LE PONT DES MÉDIAS : DE LA BASE VERS LE SITE
 * ---------------------------------------------------------------------------
 *
 * Exécuté avant chaque build, juste après l'export des articles.
 *
 * Les images envoyées depuis le panel sont converties en WebP et stockées dans
 * PostgreSQL. Le site, lui, est statique : il ne consulte aucune base. Ce
 * script recopie donc les images de la base vers `public/medias/`, d'où Vite
 * les emporte dans `dist/` et où l'hébergeur les sert comme n'importe quel
 * fichier.
 *
 * POURQUOI LES IMAGES SONT EN BASE ET PAS SUR LE DISQUE
 * ----------------------------------------------------
 * Le site se reconstruit depuis le dépôt Git, souvent sur une machine remise à
 * neuf. Un fichier posé sur le disque du serveur ne survit pas forcément à un
 * redéploiement — et une image perdue ne se remarque qu'une fois la page en
 * ligne. La base est le seul endroit dont on sache qu'il persiste et qu'il est
 * sauvegardé.
 *
 * `public/medias/` est donc un dossier DÉRIVÉ, reconstruit à chaque build. Il
 * n'a pas à être versionné : c'est la base qui fait foi.
 */

const DOSSIER = process.env.DOSSIER_MEDIAS ?? "public/medias";

/**
 * Marque du dossier dérivé.
 *
 * Le script efface des fichiers : sans cette marque, il pourrait un jour vider
 * un dossier rempli à la main. Le fichier est écrit à la première exécution et
 * relu ensuite ; s'il manque alors que le dossier contient déjà des fichiers,
 * on ne supprime rien.
 */
const MARQUE = ".genere-depuis-la-base";

/*
 * SANS BASE, LA SOURCE EST `content/medias/`.
 *
 * En mode local, les images envoyées depuis le panel sont écrites là — un
 * dossier versionné, qui suit le dépôt. Elles doivent quand même arriver dans
 * `public/medias/` pour être servies par le site construit.
 *
 * Sans ce chemin, une image ajoutée avant la mise en service de la base
 * s'affichait en développement puis disparaissait du site livré : le dossier
 * dérivé était simplement vide.
 */
if (!process.env.DATABASE_URL) {
  const SOURCE_LOCALE = "content/medias";
  mkdirSync(DOSSIER, { recursive: true });

  let images = [];
  try {
    /* Les vidéos envoyées depuis le panel atterrissent dans le même dossier,
       sans conversion — `ffmpeg` n'est pas garanti sur l'hébergement. Les
       oublier ici les ferait disparaître du site construit, exactement comme
       les images avant la correction ci-dessus. */
    images = readdirSync(SOURCE_LOCALE).filter((f) => /\.(webp|mp4|webm)$/.test(f));
  } catch {
    console.log("· Médias : aucun fichier local.");
    process.exit(0);
  }

  let copies = 0;
  for (const nom of images) {
    const source = join(SOURCE_LOCALE, nom);
    const cible = join(DOSSIER, nom);
    // Même taille = même fichier : les noms sont des identifiants uniques, le
    // contenu d'un identifiant ne change jamais.
    if (existsSync(cible) && statSync(cible).size === statSync(source).size) continue;
    copyFileSync(source, cible);
    copies += 1;
  }

  writeFileSync(
    join(DOSSIER, MARQUE),
    "Dossier derive : reconstruit a chaque build depuis content/medias/.\n"
  );

  // Ce qui n'existe plus dans la source disparaît du site.
  let retires = 0;
  for (const nom of readdirSync(DOSSIER)) {
    if (nom === MARQUE || images.includes(nom)) continue;
    unlinkSync(join(DOSSIER, nom));
    retires += 1;
  }

  console.log(
    `· Médias : ${images.length} fichier(s) local(aux), ${copies} recopié(s)` +
      (retires ? `, ${retires} retiré(s)` : "")
  );
  process.exit(0);
}

const { default: pg } = await import("pg");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.PGSSLMODE ?? "require") === "disable" ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

console.log("· Médias : lecture depuis PostgreSQL…");

try {
  await client.connect();
} catch (e) {
  console.error(
    `\n✖ Base injoignable : ${e.message}\n` +
      "  Le build est interrompu : reconstruire le site sans ses images\n" +
      "  publierait des pages trouées sans que personne ne s'en aperçoive.\n"
  );
  process.exit(1);
}

/*
 * DEUX STOCKAGES, DONC DEUX REQUÊTES.
 *
 *  · les IMAGES sont dans la colonne `contenu` — quelques dizaines de kilo-
 *    octets chacune, lues d'un seul aller-retour ;
 *  · les VIDÉOS sont sur le DISQUE du serveur, et `chemin` dit où.
 *
 * Ce script ne transportait que les premières. Une vidéo envoyée depuis le
 * panel s'affichait donc dans l'aperçu, puis renvoyait un 404 sur le site
 * construit -- le pont n'existait pas.
 */
const { rows } = await client.query(
  `SELECT id::text, contenu, taille FROM medias WHERE contenu IS NOT NULL`
);

const { rows: surDisque } = await client.query(
  `SELECT id::text, chemin, taille FROM medias
    WHERE contenu IS NULL AND chemin IS NOT NULL`
);
await client.end();

/*
 * Où le serveur range ses fichiers. Même variable que `serveur/.env`.
 *
 * Absente alors que la base annonce des fichiers sur disque, le build
 * S'ARRÊTE : continuer publierait des pages dont les vidéos manquent, et
 * personne ne s'en apercevrait avant un visiteur.
 */
const RACINE_DISQUE = process.env.CHEMIN_MEDIAS;

if (surDisque.length > 0 && !RACINE_DISQUE) {
  console.error(
    `\n✖ ${surDisque.length} fichier(s) (vidéos, PDF) sont stockés sur le disque\n` +
      "  du serveur, mais CHEMIN_MEDIAS n'est pas défini pour la construction.\n" +
      "  Déclarez-la avec la même valeur que dans serveur/.env.\n"
  );
  process.exit(1);
}

mkdirSync(DOSSIER, { recursive: true });

const marqueur = join(DOSSIER, MARQUE);
const dejaDerive = existsSync(marqueur);
const contenuExistant = readdirSync(DOSSIER).filter((f) => f !== MARQUE);

if (!dejaDerive && contenuExistant.length > 0) {
  console.warn(
    `\n⚠ ${DOSSIER} contient déjà des fichiers sans marque de génération.\n` +
      "  Ils sont laissés intacts et aucun n'est supprimé. Si ce dossier doit\n" +
      "  être piloté par la base, videz-le d'abord à la main.\n"
  );
}

/* ------------------------------------------------------------- écriture */

const attendus = new Set([MARQUE]);
let ecrits = 0;
let octets = 0;

for (const m of rows) {
  const nom = `${m.id}.webp`;
  attendus.add(nom);
  octets += m.contenu.length;

  // Le contenu d'un identifiant ne change jamais : un nouvel envoi crée un
  // nouvel identifiant. Une taille identique suffit donc à savoir que le
  // fichier est déjà à jour, sans le relire entièrement.
  const chemin = join(DOSSIER, nom);
  if (existsSync(chemin) && statSync(chemin).size === m.contenu.length) continue;

  writeFileSync(chemin, m.contenu);
  ecrits += 1;
}

/* ------------------------------------------------- fichiers sur le disque */

let recopies = 0;

for (const m of surDisque) {
  /* L'adresse publique est PLATE : le sous-dossier de deux caractères est un
     détail de rangement du serveur (`ab/<id>.mp4`), pas une partie de l'URL.
     Voir `adressePublique` dans serveur/src/routes/medias.ts. */
  const nom = `${m.id}${extname(m.chemin)}`;
  attendus.add(nom);

  const source = join(RACINE_DISQUE, m.chemin);
  const cible = join(DOSSIER, nom);

  if (!existsSync(source)) {
    console.error(
      `\n✖ Fichier introuvable sur le disque : ${source}\n` +
        "  La base le référence, mais il n'y est plus. Le build s'arrête plutôt\n" +
        "  que de publier une page qui pointe vers un fichier absent.\n"
    );
    process.exit(1);
  }

  octets += Number(m.taille);
  if (existsSync(cible) && statSync(cible).size === statSync(source).size) continue;

  copyFileSync(source, cible);
  recopies += 1;
}

if (surDisque.length) {
  console.log(`  ${surDisque.length} fichier(s) sur disque, ${recopies} recopié(s)`);
}

writeFileSync(
  marqueur,
  "Dossier derive : reconstruit a chaque build depuis la table `medias`.\n" +
    "Ne rien y deposer a la main -- tout fichier inconnu de la base est efface.\n"
);

console.log(
  `  ${rows.length} image(s) en base, ${ecrits} recopiée(s), ` +
    `${(octets / 1024 / 1024).toFixed(1)} Mo au total`
);

/* ----------------------------------------------------------- suppression */

let supprimes = 0;

if (dejaDerive || contenuExistant.length === 0) {
  for (const nom of readdirSync(DOSSIER)) {
    if (attendus.has(nom)) continue;
    unlinkSync(join(DOSSIER, nom));
    supprimes += 1;
  }
  if (supprimes) console.log(`  ${supprimes} fichier(s) obsolète(s) retiré(s)`);
}
