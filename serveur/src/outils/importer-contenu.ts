import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pool, requete, uneLigne } from "../bd.js";
import { verifierConfig } from "../config.js";

/**
 * ---------------------------------------------------------------------------
 * LE PONT DU CONTENU, DANS L'AUTRE SENS : DES FICHIERS VERS LA BASE
 * ---------------------------------------------------------------------------
 *
 *     npm run importer-contenu
 *
 * Opération de MIGRATION, à lancer une fois, le jour de la mise en service.
 * Elle lit `content/accueil/*.json` et remplit les lignes de `contenu_pages`.
 *
 * POURQUOI ELLE EST INDISPENSABLE
 * -------------------------------
 * Le schéma crée les douze sections avec des données vides. Sans cette
 * migration, l'éditeur de page d'accueil s'ouvrirait sur douze formulaires
 * blancs, alors que le site affiche du contenu — et la première publication
 * remplacerait ce contenu par du vide.
 *
 * PRUDENCE VOLONTAIRE
 * -------------------
 * Une section dont les données sont DÉJÀ remplies en base n'est pas écrasée.
 * On peut donc relancer la commande sans risque, y compris après avoir modifié
 * du contenu depuis le panel. Pour forcer, il faut le demander explicitement :
 *
 *     npm run importer-contenu -- --ecraser
 */

verifierConfig();

const DOSSIER = resolve(process.cwd(), "..", "content", "accueil");
const ECRASER = process.argv.includes("--ecraser");

/** Le manifeste laissé par l'export : ce n'est pas une section. */
const MANIFESTE = ".genere-depuis-la-base.json";

const principal = async () => {
  console.log(`\n— Import du contenu depuis ${DOSSIER} —\n`);

  let fichiers: string[];
  try {
    fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".json") && f !== MANIFESTE);
  } catch {
    console.error(`✖ Dossier introuvable : ${DOSSIER}\n`);
    process.exit(1);
  }

  let importes = 0;
  let ignores = 0;
  let inconnus = 0;

  for (const nom of fichiers) {
    const cle = nom.replace(/\.json$/, "");

    const ligne = await uneLigne<{ vide: boolean; libelle: string }>(
      `SELECT (donnees = '{}'::jsonb) AS vide, libelle FROM contenu_pages WHERE cle = $1`,
      [cle]
    );

    if (!ligne) {
      /*
       * Un fichier sans ligne en base.
       *
       * On ne crée PAS la ligne : les douze sections sont posées par le schéma,
       * avec leur libellé destiné au panel. En inventer une ici lui donnerait
       * un libellé technique que l'éditeur verrait à l'écran.
       */
      console.warn(`  ⚠ ${cle} — aucune section de ce nom en base, ignoré.`);
      inconnus += 1;
      continue;
    }

    if (!ligne.vide && !ECRASER) {
      console.log(`  · ${cle} — déjà rempli en base, laissé tel quel`);
      ignores += 1;
      continue;
    }

    const donnees = JSON.parse(readFileSync(join(DOSSIER, nom), "utf8"));

    await requete(
      `UPDATE contenu_pages SET donnees = $2, brouillon = NULL, maj_le = now() WHERE cle = $1`,
      [cle, JSON.stringify(donnees)]
    );

    console.log(`  ✓ ${cle} (${ligne.libelle})`);
    importes += 1;
  }

  const manquantes = await requete<{ cle: string }>(
    `SELECT cle FROM contenu_pages WHERE donnees = '{}'::jsonb ORDER BY cle`
  );

  console.log(
    `\n${importes} section(s) importée(s), ${ignores} déjà remplie(s)` +
      (inconnus ? `, ${inconnus} fichier(s) sans section` : "") +
      ".\n"
  );

  if (manquantes.length) {
    console.warn(
      `⚠ ${manquantes.length} section(s) restent vides en base : ` +
        manquantes.map((m) => m.cle).join(", ") +
        "\n  Le site continuera d'afficher les fichiers du dépôt pour celles-là.\n"
    );
  }

  if (ignores && !ECRASER) {
    console.log("  Pour remplacer le contenu déjà en base : npm run importer-contenu -- --ecraser\n");
  }

  await pool.end();
};

principal().catch(async (e) => {
  console.error("\n✖", e instanceof Error ? e.message : e, "\n");
  await pool.end().catch(() => undefined);
  process.exit(1);
});
