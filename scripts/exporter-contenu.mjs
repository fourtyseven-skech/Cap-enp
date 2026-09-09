import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ---------------------------------------------------------------------------
 * LE PONT DU CONTENU : DE LA BASE VERS LE SITE
 * ---------------------------------------------------------------------------
 *
 * Exécuté avant chaque build, avec les ponts des articles, des médias et des
 * redirections.
 *
 * CE QU'IL FAIT
 * -------------
 * Chaque ligne de `contenu_pages` devient un fichier `content/accueil/<clé>.json`,
 * lu par les composants au moment de la compilation. C'est ce qui fera qu'une
 * modification saisie dans le panel apparaîtra sur le site.
 *
 * TROIS GARDE-FOUS, ET LE PREMIER EST PROPRE À CE PONT
 * ----------------------------------------------------
 *  1. une section dont les données sont VIDES est ignorée. À l'installation, le
 *     schéma crée les douze lignes avec `{}` : sans ce contrôle, la première
 *     construction remplacerait tout le contenu du site par des objets vides,
 *     et le build échouerait douze fois de suite sans qu'on comprenne pourquoi ;
 *  2. une base injoignable interrompt le build. Reconstruire le site avec un
 *     contenu figé, sans le dire, serait pire qu'un échec franc ;
 *  3. rien n'est écrit si le contenu est identique — un fichier réécrit à
 *     l'identique change sa date et apparaît comme modifié dans le dépôt.
 *
 * CE QU'IL NE FAIT PAS
 * --------------------
 * Il ne valide pas. C'est le greffon `megasoft-contenu` qui le fait, juste
 * après, avec les schémas Zod et des messages nommant le champ fautif.
 * Dupliquer la validation ici aurait voulu dire la maintenir à deux endroits.
 * Le manifeste écrit en fin de course permet au greffon de préciser, en cas
 * d'erreur, que le fichier vient de la base et non du dépôt.
 */

const DOSSIER = process.env.DOSSIER_CONTENU ?? "content/accueil";

/** Liste les sections écrites depuis la base, pour le message d'erreur du greffon. */
const MANIFESTE = ".genere-depuis-la-base.json";

if (!process.env.DATABASE_URL) {
  console.log("· Contenu : base non configurée, lecture des fichiers versionnés.");
  process.exit(0);
}

const { default: pg } = await import("pg");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.PGSSLMODE ?? "require") === "disable" ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

console.log("· Contenu : lecture depuis PostgreSQL…");

try {
  await client.connect();
} catch (e) {
  console.error(
    `\n✖ Base injoignable : ${e.message}\n` +
      "  Le build est interrompu : reconstruire le site avec un contenu figé,\n" +
      "  sans le signaler, laisserait croire qu'une modification est en ligne.\n"
  );
  process.exit(1);
}

/*
 * On lit `donnees`, la version PUBLIÉE — jamais `brouillon`.
 *
 * Un éditeur doit pouvoir retravailler une section sur plusieurs jours sans que
 * le site s'en aperçoive. Publier est un geste distinct, et c'est lui qui fait
 * passer le brouillon en `donnees`.
 */
const { rows } = await client.query(
  `SELECT cle, donnees FROM contenu_pages ORDER BY cle`
);
await client.end();

/* ------------------------------------------------------------------ tri */

const vide = (o) => !o || typeof o !== "object" || Object.keys(o).length === 0;

const remplies = rows.filter((r) => !vide(r.donnees));
const vides = rows.filter((r) => vide(r.donnees));

if (vides.length) {
  console.log(
    `  ${vides.length} section(s) encore vide(s) en base, laissée(s) telle(s) quelle(s) : ` +
      vides.map((r) => r.cle).join(", ")
  );
  if (remplies.length === 0) {
    console.log("  → lancez `npm run importer-contenu` depuis serveur/ pour les remplir.");
  }
}

/* ------------------------------------------------------------- écriture */

let ecrits = 0;
const gerees = [];

for (const r of remplies) {
  const nom = `${r.cle}.json`;
  const chemin = join(DOSSIER, nom);

  if (!existsSync(chemin)) {
    /*
     * Une clé sans fichier correspondant n'est pas écrite.
     *
     * Le site ne lit que les sections qu'il connaît : créer un fichier pour une
     * clé inventée en base ferait échouer le build sur « aucun schéma », sans
     * que personne comprenne d'où sort ce fichier.
     */
    console.warn(`  ⚠ « ${r.cle} » existe en base mais pas dans ${DOSSIER} — ignorée.`);
    continue;
  }

  gerees.push(nom);
  const contenu = JSON.stringify(r.donnees, null, 2) + "\n";
  if (readFileSync(chemin, "utf8") !== contenu) {
    writeFileSync(chemin, contenu, "utf8");
    ecrits += 1;
  }
}

writeFileSync(
  join(DOSSIER, MANIFESTE),
  JSON.stringify({ ecritLe: new Date().toISOString(), sections: gerees }, null, 2) + "\n",
  "utf8"
);

/*
 * Les fichiers du dépôt qu'aucune ligne de base ne pilote.
 *
 * On ne les supprime pas : contrairement aux articles, chaque section est
 * OBLIGATOIRE — le site ne compile pas sans elle. En retirer une casserait le
 * build au lieu de retirer une page.
 */
const orphelins = readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".json") && f !== MANIFESTE && !gerees.includes(f));

console.log(
  `  ${gerees.length} section(s) depuis la base, ${ecrits} fichier(s) réécrit(s)` +
    (orphelins.length ? `, ${orphelins.length} laissée(s) au dépôt` : "")
);
