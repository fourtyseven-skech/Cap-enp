import { readFileSync, writeFileSync } from "node:fs";

/**
 * ---------------------------------------------------------------------------
 * LE PONT DES REDIRECTIONS : DE LA BASE VERS LE SERVEUR WEB
 * ---------------------------------------------------------------------------
 *
 * Exécuté avant chaque build, avec les deux autres exports.
 *
 * LE TROU QU'IL COMBLE
 * --------------------
 * Renommer un article déjà publié écrit une redirection 301 dans la table
 * `redirections` — le serveur le fait tout seul, sans le demander, parce que
 * personne ne penserait à cocher une case pour ça.
 *
 * Mais rien n'appliquait ces lignes. Elles s'accumulaient en base pendant que
 * les anciennes adresses continuaient de répondre 404 : les liens déjà
 * partagés restaient cassés, et le référencement acquis se perdait quand même.
 * C'est exactement le défaut que la redirection automatique devait éviter.
 *
 * Ce script écrit donc les règles dans `public/.htaccess`, entre deux marques,
 * d'où Apache et LiteSpeed les lisent au moment où la requête arrive.
 */

const FICHIER = process.env.FICHIER_HTACCESS ?? "public/.htaccess";

const DEBUT = "# >>> REDIRECTIONS GENEREES — DEBUT";
const FIN = "# <<< REDIRECTIONS GENEREES — FIN";

/**
 * Réécrit le bloc entre les deux marques, sans toucher au reste.
 *
 * Le fichier contient aussi des règles écrites à la main — en-têtes de
 * sécurité, cache, routage — qu'il ne faut évidemment pas perdre. Un script
 * qui réécrirait le fichier entier les effacerait au premier build.
 */
const remplacerBloc = (contenu, lignes) => {
  const i = contenu.indexOf(DEBUT);
  const j = contenu.indexOf(FIN);

  if (i === -1 || j === -1 || j < i) {
    console.error(
      `\n✖ Marques introuvables dans ${FICHIER}.\n` +
        `  Le fichier doit contenir, dans cet ordre :\n` +
        `      ${DEBUT}\n      ${FIN}\n`
    );
    process.exit(1);
  }

  const avant = contenu.slice(0, i + DEBUT.length);
  const apres = contenu.slice(j);
  return `${avant}\n${lignes}${apres}`;
};

if (!process.env.DATABASE_URL) {
  console.log("· Redirections : base non configurée, aucune règle à écrire.");
  process.exit(0);
}

const { default: pg } = await import("pg");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.PGSSLMODE ?? "require") === "disable" ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

console.log("· Redirections : lecture depuis PostgreSQL…");

try {
  await client.connect();
} catch (e) {
  console.error(
    `\n✖ Base injoignable : ${e.message}\n` +
      "  Le build est interrompu : sans les redirections, les anciennes adresses\n" +
      "  des articles renommés répondraient 404 en silence.\n"
  );
  process.exit(1);
}

const { rows } = await client.query(
  `SELECT depuis, vers, code FROM redirections ORDER BY cree_le`
);
await client.end();

/**
 * Une adresse valide pour une règle Apache.
 *
 * Les valeurs viennent de la base, donc d'un slug déjà contraint par la
 * validation — mais elles finissent dans un fichier de CONFIGURATION du
 * serveur. Une ligne mal formée n'y produit pas une erreur isolée : elle peut
 * empêcher le serveur entier de démarrer. On refuse donc tout ce qui n'est pas
 * un chemin simple, plutôt que de faire confiance en amont.
 */
const chemin = /^\/[A-Za-z0-9\-._~/]*$/;

const valides = [];
const rejetes = [];

for (const r of rows) {
  if (chemin.test(r.depuis) && chemin.test(r.vers) && [301, 302, 308].includes(r.code)) {
    valides.push(r);
  } else {
    rejetes.push(r);
  }
}

if (rejetes.length) {
  console.warn(
    `  ⚠ ${rejetes.length} redirection(s) écartée(s), adresse ou code inattendu :\n` +
      rejetes.map((r) => `      ${r.depuis} → ${r.vers} (${r.code})`).join("\n")
  );
}

const lignes = valides.length
  ? valides.map((r) => `Redirect ${r.code} ${r.depuis} ${r.vers}`).join("\n") + "\n"
  : "# (aucune redirection enregistrée)\n";

const contenu = readFileSync(FICHIER, "utf8");
const nouveau = remplacerBloc(contenu, lignes);

// On n'écrit que si quelque chose a changé : un fichier réécrit à l'identique
// change sa date de modification et apparaît comme modifié dans le dépôt.
if (nouveau !== contenu) {
  writeFileSync(FICHIER, nouveau, "utf8");
  console.log(`  ${valides.length} redirection(s) écrite(s) dans ${FICHIER}`);
} else {
  console.log(`  ${valides.length} redirection(s), fichier déjà à jour`);
}
