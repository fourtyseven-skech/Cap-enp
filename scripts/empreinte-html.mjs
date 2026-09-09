import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ---------------------------------------------------------------------------
 * LA GARANTIE DU LOT 2 : LE SITE NE DOIT PAS CHANGER
 * ---------------------------------------------------------------------------
 *
 *     node scripts/empreinte-html.mjs poser      # avant de toucher au code
 *     node scripts/empreinte-html.mjs comparer   # après chaque section extraite
 *
 * POURQUOI CE SCRIPT EXISTE
 * -------------------------
 * Sortir le contenu des composants est l'opération la plus risquée du chantier.
 * Une virgule mal reprise, une phrase coupée au mauvais endroit, un espace
 * insécable perdu : rien ne casse, rien ne lève d'erreur, et la page part en
 * ligne légèrement fausse. Personne ne relit douze sections mot à mot.
 *
 * On compare donc les pages CONSTRUITES, avant et après. Toute différence est
 * signalée. C'est mécanique, et ça ne dépend pas de l'attention de qui que ce
 * soit un vendredi soir.
 *
 * CE QUI EST IGNORÉ, ET POURQUOI
 * ------------------------------
 * Trois écarts sont sans conséquence et apparaîtraient à chaque build :
 *
 *   · les EMPREINTES des fichiers produits (`main-DUTQksYN.js`) changent dès
 *     qu'une ligne de code bouge, ce qui est justement le but de l'exercice ;
 *   · les ESPACES entre balises varient selon la façon dont React assemble les
 *     fragments, sans rien changer à l'affichage ;
 *   · les DATES du jour, présentes dans le sitemap.
 *
 * Tout le reste compte : le texte, l'ordre, les attributs, les données
 * structurées, les liens.
 */

const DIST = "dist";
const EMPREINTES = "C:/Users/Mecho/AppData/Local/Temp/claude/empreintes-megasoft";

/* ------------------------------------------------------------ normalisation */

/**
 * Retire ce qui change légitimement d'un build à l'autre.
 *
 * L'ordre compte : on neutralise les empreintes AVANT de réduire les espaces,
 * sinon un nom de fichier collé à une balise échapperait au motif.
 */
const normaliser = (html) =>
  html
    // `main-DUTQksYN.js` → `main-EMPREINTE.js`
    .replace(/-[A-Za-z0-9_-]{8,10}\.(js|css|webp|png|jpg|jpeg|woff2|mp4|svg|avif)/g, "-EMPREINTE.$1")
    // Les dates du jour, dans le sitemap et les données structurées.
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "DATE")
    // Espaces entre balises, et fins de ligne.
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();

/** Le texte lisible, sans balises — ce que voit réellement un lecteur. */
const texteLisible = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ------------------------------------------------------------- parcours */

const fichiers = (dossier, base = dossier) => {
  const sortie = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...fichiers(chemin, base));
    else if (/\.(html|xml|txt)$/.test(e.name)) sortie.push(relative(base, chemin).replace(/\\/g, "/"));
  }
  return sortie.sort();
};

const releve = () => {
  if (!existsSync(DIST)) {
    console.error("\n✖ `dist/` n'existe pas. Lancez `npm run build` d'abord.\n");
    process.exit(1);
  }

  const pages = {};
  for (const f of fichiers(DIST)) {
    const brut = readFileSync(join(DIST, f), "utf8");
    pages[f] = {
      structure: createHash("sha256").update(normaliser(brut)).digest("hex").slice(0, 16),
      texte: texteLisible(brut),
      octets: statSync(join(DIST, f)).size,
    };
  }
  return pages;
};

/* ---------------------------------------------------------------- actions */

const action = process.argv[2];

if (action === "poser") {
  const pages = releve();
  mkdirSync(EMPREINTES, { recursive: true });
  writeFileSync(join(EMPREINTES, "avant.json"), JSON.stringify(pages, null, 1), "utf8");

  const caracteres = Object.values(pages).reduce((t, p) => t + p.texte.length, 0);
  console.log(
    `\n✓ Repère posé sur ${Object.keys(pages).length} page(s), ` +
      `${caracteres.toLocaleString("fr-FR")} caractères de texte lisible.\n` +
      `  ${join(EMPREINTES, "avant.json")}\n`
  );
  process.exit(0);
}

if (action !== "comparer") {
  console.error("\nUsage : node scripts/empreinte-html.mjs poser|comparer\n");
  process.exit(1);
}

const chemin = join(EMPREINTES, "avant.json");
if (!existsSync(chemin)) {
  console.error(`\n✖ Aucun repère posé. Lancez d'abord :\n    node scripts/empreinte-html.mjs poser\n`);
  process.exit(1);
}

const avant = JSON.parse(readFileSync(chemin, "utf8"));
const apres = releve();

const ecarts = [];

for (const f of Object.keys(avant)) {
  if (!apres[f]) {
    ecarts.push({ page: f, quoi: "page disparue" });
    continue;
  }
  if (avant[f].texte !== apres[f].texte) {
    /*
     * On montre le PREMIER endroit où les deux textes divergent, avec ce qui
     * l'entoure. Annoncer « le texte a changé » sur une page de 9 000
     * caractères n'aide personne à trouver quoi.
     */
    const a = avant[f].texte;
    const b = apres[f].texte;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    const debut = Math.max(0, i - 60);
    ecarts.push({
      page: f,
      quoi: "texte modifié",
      avant: a.slice(debut, i + 60),
      apres: b.slice(debut, i + 60),
      position: i,
    });
    continue;
  }
  if (avant[f].structure !== apres[f].structure) {
    ecarts.push({
      page: f,
      quoi: "structure modifiée à texte identique",
      detail: `${avant[f].octets} → ${apres[f].octets} octets`,
    });
  }
}

for (const f of Object.keys(apres)) {
  if (!avant[f]) ecarts.push({ page: f, quoi: "page nouvelle" });
}

/* ------------------------------------------------------------------ sortie */

const total = Object.keys(avant).length;

if (!ecarts.length) {
  console.log(`\n✓ ${total} page(s) identiques au repère — texte et structure.\n`);
  process.exit(0);
}

console.error(`\n✖ ${ecarts.length} écart(s) sur ${total} page(s)\n`);
for (const e of ecarts) {
  console.error(`  ${e.page} — ${e.quoi}`);
  if (e.detail) console.error(`      ${e.detail}`);
  if (e.avant !== undefined) {
    console.error(`      position ${e.position}`);
    console.error(`      avant : …${e.avant}…`);
    console.error(`      après : …${e.apres}…`);
  }
  console.error("");
}
console.error(
  "  Si un écart est VOULU, reposez le repère :\n" +
    "      node scripts/empreinte-html.mjs poser\n"
);
process.exit(1);
