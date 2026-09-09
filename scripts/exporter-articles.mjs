import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dump, load } from "js-yaml";

/**
 * ---------------------------------------------------------------------------
 * LE PONT : DE LA BASE VERS LE SITE
 * ---------------------------------------------------------------------------
 *
 * Exécuté automatiquement avant chaque `npm run build` (script `prebuild`).
 *
 * LE TROU QU'IL COMBLE
 * --------------------
 * Le panel écrit les articles dans PostgreSQL. Le blog, lui, lit
 * `content/blog/*.md` par `import.meta.glob`, résolu à la COMPILATION. Sans ce
 * pont, un article publié depuis le panel partait bien en base, déclenchait
 * bien une reconstruction — et le site reconstruisait les mêmes fichiers
 * qu'avant. L'article n'apparaissait jamais.
 *
 * On traduit donc la base en fichiers, juste avant le build. Tout ce qui suit
 * — pages statiques, flux RSS, sitemap, llms.txt, données structurées —
 * continue de partir de ces fichiers, sans rien changer.
 *
 * INERTE SANS BASE
 * ----------------
 * Sans `DATABASE_URL`, le script ne fait rien et le build lit les fichiers
 * versionnés, exactement comme aujourd'hui. C'est la même logique que
 * `VITE_API_URL` pour le panel : une seule variable fait basculer, et son
 * absence ne casse rien.
 *
 * TROIS GARDE-FOUS
 * ----------------
 * Ce script EFFACE des fichiers. Trois règles l'encadrent, et aucune n'est
 * facultative :
 *
 *  1. il ne touche QUE les fichiers portant `origine: base` dans leur en-tête.
 *     Un article écrit à la main dans le dépôt n'est jamais supprimé ;
 *  2. si la base ne renvoie AUCUN article, il ne supprime rien et prévient.
 *     Une base vide est presque toujours une erreur de configuration, pas une
 *     décision éditoriale — et le blog entier disparaîtrait ;
 *  3. une base injoignable interrompt le build. Publier un site amputé de ses
 *     articles parce que le réseau a hoqueté serait pire qu'un build en échec.
 */

/**
 * Le dossier des articles.
 *
 * Surchargeable pour que la recette puisse exercer ce script — qui EFFACE des
 * fichiers — sans travailler sur le vrai contenu du site. En production, la
 * variable n'est jamais déclarée.
 */
const DOSSIER = process.env.DOSSIER_ARTICLES ?? "content/blog";

/** Marqueur des fichiers produits par ce script. */
const MARQUEUR = "origine";
const VALEUR_MARQUEUR = "base";

/* ------------------------------------------------------------------ sortie */

const dit = (m) => console.log(`  ${m}`);

if (!process.env.DATABASE_URL) {
  console.log(
    "\n· Articles : base non configurée, lecture des fichiers versionnés.\n" +
      "  (Déclarez DATABASE_URL pour publier depuis le panel.)"
  );
  process.exit(0);
}

/* ------------------------------------------------------- lecture de la base */

const { default: pg } = await import("pg");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.PGSSLMODE ?? "require") === "disable" ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

console.log("\n· Articles : lecture depuis PostgreSQL…");

try {
  await client.connect();
} catch (e) {
  console.error(
    `\n✖ Base injoignable : ${e.message}\n` +
      "  Le build est interrompu volontairement : reconstruire le site sans ses\n" +
      "  articles publierait un blog amputé sans que personne ne s'en aperçoive.\n"
  );
  process.exit(1);
}

/*
 * Ce qui part sur le site public.
 *
 * Les articles PROGRAMMÉS dont la date est atteinte sont inclus : c'est tout
 * l'intérêt de la programmation, et la reconstruction est le seul moment où
 * l'on peut la faire jouer sur un site statique.
 *
 * `maquette` n'exclut PAS l'article : le drapeau fait afficher un bandeau sur
 * la page, il ne l'empêche pas de paraître. Les articles actuels du site le
 * portent tous.
 */
const { rows } = await client.query(
  `SELECT slug, titre, chapeau, corps, categorie, format, accent, motif,
          titre_fantome, reponse, version, exergue, meta_description, auteur,
          etiquettes, faq, statut, maquette,
          to_char(publie_le, 'YYYY-MM-DD') AS publie_le,
          image,
          to_char(maj_le, 'YYYY-MM-DD')    AS maj_le
     FROM articles
    WHERE NOT supprime AND NOT archive
      AND (statut = 'publie' OR (statut = 'programme' AND publie_le <= CURRENT_DATE))
    ORDER BY publie_le DESC`
);

await client.end();

dit(`${rows.length} article(s) publié(s) en base`);

/* --------------------------------------------------- garde-fou n° 2 : vide */

if (rows.length === 0) {
  console.warn(
    "\n⚠ Aucun article publié en base — aucun fichier n'est modifié ni supprimé.\n" +
      "  Le build continue avec les fichiers versionnés. Si la base devait en\n" +
      "  contenir, vérifiez DATABASE_URL avant de publier ce site.\n"
  );
  process.exit(0);
}

/* ------------------------------------------------------------- écriture */

/** Retire les champs vides : le chargeur leur donne déjà une valeur par défaut. */
const sansVide = (o) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => {
      if (v === null || v === undefined || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
  );

const enFichier = (a) => {
  const entete = sansVide({
    titre: a.titre,
    slug: a.slug,
    chapeau: a.chapeau,
    categorie: a.categorie,
    format: a.format,
    reponse: a.reponse,
    version: a.version,
    etiquettes: a.etiquettes,
    auteur: a.auteur,
    publie_le: a.publie_le,
    maj_le: a.maj_le,
    statut: a.statut === "programme" ? "publie" : a.statut,
    maquette: a.maquette || undefined,
    titre_fantome: a.titre_fantome,
    accent: a.accent,
    motif: a.motif,
    exergue: a.exergue,
    meta_description: a.meta_description,
    image: a.image,
    faq: a.faq,
    // Le marqueur. C'est lui qui autorise ce script à reprendre le fichier
    // plus tard — et qui protège les articles écrits à la main.
    [MARQUEUR]: VALEUR_MARQUEUR,
  });

  /*
   * `lineWidth: -1` désactive le repli automatique des lignes.
   *
   * Sans cela, js-yaml coupe les longues chaînes sur plusieurs lignes. Le
   * résultat reste du YAML valide et se relit correctement, mais chaque export
   * réécrirait les coupures différemment : le fichier changerait sans que le
   * contenu change, et l'historique deviendrait illisible.
   */
  return `---\n${dump(entete, { lineWidth: -1, quotingType: '"', forceQuotes: false })}---\n\n${a.corps.trim()}\n`;
};

let ecrits = 0;
const attendus = new Set();

for (const a of rows) {
  const nom = `${a.slug}.md`;
  attendus.add(nom);
  const contenu = enFichier(a);

  // On ne réécrit que si le contenu diffère : un fichier réécrit à l'identique
  // change sa date de modification et fait travailler les outils de suivi pour
  // rien.
  let ancien = null;
  try {
    ancien = readFileSync(join(DOSSIER, nom), "utf8");
  } catch {
    /* le fichier n'existe pas encore */
  }
  if (ancien !== contenu) {
    writeFileSync(join(DOSSIER, nom), contenu, "utf8");
    ecrits += 1;
  }
}

dit(`${ecrits} fichier(s) écrit(s), ${rows.length - ecrits} inchangé(s)`);

/* -------------------------------------- suppression, sous garde-fou n° 1 */

let supprimes = 0;
let preserves = 0;

for (const nom of readdirSync(DOSSIER).filter((f) => f.endsWith(".md"))) {
  if (attendus.has(nom)) continue;

  const brut = readFileSync(join(DOSSIER, nom), "utf8");
  const fin = brut.indexOf("\n---", 3);
  let entete = {};
  if (brut.startsWith("---") && fin !== -1) {
    try {
      entete = load(brut.slice(brut.indexOf("\n") + 1, fin)) ?? {};
    } catch {
      entete = {};
    }
  }

  if (entete[MARQUEUR] === VALEUR_MARQUEUR) {
    // Produit par un export précédent, absent de la base aujourd'hui :
    // l'article a été dépublié, archivé ou mis à la corbeille.
    unlinkSync(join(DOSSIER, nom));
    supprimes += 1;
  } else {
    // Écrit à la main dans le dépôt. On n'y touche pas.
    preserves += 1;
  }
}

if (supprimes) dit(`${supprimes} fichier(s) retiré(s) — dépubliés ou supprimés`);
if (preserves) dit(`${preserves} fichier(s) hors base conservé(s)`);

console.log("");
