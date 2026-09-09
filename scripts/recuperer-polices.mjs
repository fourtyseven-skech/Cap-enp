/**
 * Récupération des polices de la charte, pour les héberger avec le site.
 *
 * Pourquoi ne pas simplement pointer vers Google Fonts, comme avant ?
 *
 * Parce que la balise <link> vers fonts.googleapis.com bloque le premier rendu
 * et déclenche DEUX allers-retours réseau successifs avant qu'une seule lettre
 * ne s'affiche dans la bonne police : d'abord la feuille de style, ensuite
 * seulement — une fois lue — les fichiers .woff2 sur un TROISIÈME domaine
 * (fonts.gstatic.com). Sur une connexion mobile algérienne, chaque connexion
 * neuve coûte une résolution DNS, une poignée de main TLS et un aller-retour :
 * le texte reste en police de repli d'autant plus longtemps.
 *
 * Servis depuis le site lui-même, les fichiers arrivent sur la connexion déjà
 * ouverte, et peuvent être préchargés dès la première ligne du document.
 *
 * Ce script ne tourne pas au build : on le lance à la main quand la liste des
 * graisses change (`node scripts/recuperer-polices.mjs`), et le résultat est
 * versionné. Un build ne doit pas dépendre d'un service extérieur.
 *
 * Les deux familles sont sous licence SIL Open Font License 1.1, qui autorise
 * explicitement la redistribution avec un site.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dossier = path.join(racine, "public", "fonts");
const sortieCss = path.join(racine, "src", "polices.css");

/** Même liste que celle demandée jusqu'ici à Google Fonts. */
const REQUETE =
  "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Poppins:wght@500;600;700;800;900&display=swap";

/**
 * Alphabets conservés. Le site est en français : le latin de base et son
 * extension (œ, ligatures, caractères d'Europe centrale) suffisent. Emporter le
 * cyrillique, le grec et le vietnamien pour neuf graisses ferait une trentaine
 * de fichiers dont aucun ne serait jamais demandé.
 */
const SOUS_ENSEMBLES = new Set(["latin", "latin-ext"]);

/* Sans cet en-tête, Google renvoie du .ttf pour un client qu'il ne reconnaît
   pas — trois à quatre fois plus lourd que le .woff2. */
const NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const css = await (await fetch(REQUETE, { headers: { "User-Agent": NAVIGATEUR } })).text();

await fs.mkdir(dossier, { recursive: true });

/* La feuille de Google alterne un commentaire nommant l'alphabet et le bloc
   @font-face correspondant. On les relit par paires. */
const blocs = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)];

/* Téléchargement, puis regroupement par famille et par alphabet.
   Certaines familles — Inter Tight en fait partie — sont VARIABLES : Google
   renvoie alors le même fichier pour toutes les graisses demandées, chacune
   n'étant qu'un point sur un axe continu. Les enregistrer séparément ferait
   quatre copies du même fichier et, surtout, quatre déclarations concurrentes :
   le navigateur téléchargerait plusieurs fois le même octet pour afficher deux
   graisses de la même phrase. On les reconnaît à l'identité de leur contenu, et
   une seule déclaration couvre alors toute la plage. */
const groupes = new Map();

for (const [, sousEnsemble, bloc] of blocs) {
  if (!SOUS_ENSEMBLES.has(sousEnsemble)) continue;

  const famille = /font-family:\s*'([^']+)'/.exec(bloc)[1];
  const graisse = Number(/font-weight:\s*(\d+)/.exec(bloc)[1]);
  const plage = /unicode-range:\s*([^;]+);/.exec(bloc)[1].trim();
  const url = /url\(([^)]+)\)/.exec(bloc)[1];

  const octets = Buffer.from(await (await fetch(url, { headers: { "User-Agent": NAVIGATEUR } })).arrayBuffer());

  const cle = `${famille}|${sousEnsemble}`;
  if (!groupes.has(cle)) groupes.set(cle, { famille, sousEnsemble, plage, entrees: [] });
  groupes.get(cle).entrees.push({ graisse, octets });
}

const morceaux = [];
let gardes = 0;
const base = (f) => f.toLowerCase().replace(/\s+/g, "-");

for (const { famille, sousEnsemble, plage, entrees } of groupes.values()) {
  const empreinte = (o) => o.toString("base64");
  const variable = entrees.every((e) => empreinte(e.octets) === empreinte(entrees[0].octets));
  const graisses = entrees.map((e) => e.graisse).sort((a, b) => a - b);

  const aEcrire = variable
    ? [
        {
          nom: `${base(famille)}-${sousEnsemble}.woff2`,
          octets: entrees[0].octets,
          // Plage continue : une seule déclaration, un seul fichier.
          poids: graisses.length > 1 ? `${graisses[0]} ${graisses.at(-1)}` : `${graisses[0]}`,
        },
      ]
    : entrees.map((e) => ({
        nom: `${base(famille)}-${e.graisse}-${sousEnsemble}.woff2`,
        octets: e.octets,
        poids: `${e.graisse}`,
      }));

  for (const { nom, octets, poids } of aEcrire) {
    await fs.writeFile(path.join(dossier, nom), octets);
    gardes++;
    morceaux.push(
      `@font-face {\n` +
        `  font-family: '${famille}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${poids};\n` +
        /* `swap` : le texte s'affiche immédiatement dans la police de repli puis
           bascule. Jamais de page blanche en attendant la police. */
        `  font-display: swap;\n` +
        `  src: url('/fonts/${nom}') format('woff2');\n` +
        `  unicode-range: ${plage};\n` +
        `}`
    );
  }
}

const entete = `/* ---------------------------------------------------------------------------
 * Polices de la charte, hébergées avec le site.
 *
 * FICHIER GÉNÉRÉ — ne pas modifier à la main.
 * Régénérer avec : node scripts/recuperer-polices.mjs
 *
 * Inter Tight (texte courant) et Poppins (titres et lettrages) sont sous
 * licence SIL Open Font License 1.1.
 *
 * ⚠️ Poppins est la seule des deux chargée en graisse 900 : tout lettrage en
 * \`font-black\` doit porter \`font-titrage\`, sinon le navigateur fabrique
 * lui-même la graisse manquante à partir d'Inter Tight 700 — un faux gras dont
 * le dessin et les chasses varient d'un moteur à l'autre.
 * --------------------------------------------------------------------------- */\n\n`;

await fs.writeFile(sortieCss, entete + morceaux.join("\n\n") + "\n", "utf8");

console.log(`✓ ${gardes} fichier(s) de police dans public/fonts/`);
console.log(`✓ déclarations écrites dans src/polices.css`);
