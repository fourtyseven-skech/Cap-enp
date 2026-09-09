/**
 * ---------------------------------------------------------------------------
 * LES DEUX TABLES DE SEUILS DISENT-ELLES LA MÊME CHOSE ?
 * ---------------------------------------------------------------------------
 *
 *     node scripts/verifier-seuils.mjs
 *
 * `src/contenu/poids.ts` (panel, mode local) et `serveur/src/poids.ts` (API)
 * portent les mêmes seuils, parce que la compilation de l'API interdit
 * d'importer hors de son propre `src/`.
 *
 * Deux fichiers à tenir d'accord, c'est exactement le genre d'oubli qui ne se
 * voit pas : le panel annoncerait « 3 Mo » et l'API refuserait à 1 Mo, sans
 * que rien ne signale la contradiction. Ce script lit les deux et compare.
 *
 * Il lit du TEXTE plutôt que d'importer les modules : l'un est du TypeScript
 * destiné au navigateur, l'autre au serveur, et aucun runtime ne charge les
 * deux. Le texte, lui, se lit de partout.
 */

import { readFileSync } from "node:fs";

/** Les seuils écrits dans un fichier, en octets. */
const lire = (chemin) => {
  const source = readFileSync(chemin, "utf8");
  const bloc = source.match(/SEUILS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!bloc) throw new Error(`Table SEUILS introuvable dans ${chemin}`);

  const trouve = {};
  for (const [, genre, corps] of bloc[1].matchAll(/(\w+):\s*\{([^}]*)\}/g)) {
    for (const [, palier, nombre, unite] of corps.matchAll(/(\w+):\s*([\d.]+)\s*\*\s*(Ko|Mo)/g)) {
      trouve[`${genre}.${palier}`] = Number(nombre) * (unite === "Mo" ? 1024 * 1024 : 1024);
    }
  }
  if (!Object.keys(trouve).length) throw new Error(`Aucun seuil lisible dans ${chemin}`);
  return trouve;
};

const panel = lire("src/contenu/poids.ts");
const api = lire("serveur/src/poids.ts");

const cles = [...new Set([...Object.keys(panel), ...Object.keys(api)])].sort();
const ecarts = cles.filter((c) => panel[c] !== api[c]);

for (const c of cles) {
  const meme = panel[c] === api[c];
  console.log(`  ${meme ? "✓" : "✗"} ${c.padEnd(14)} panel ${panel[c] ?? "—"} · api ${api[c] ?? "—"}`);
}

if (ecarts.length) {
  console.error(
    `\n✖ ${ecarts.length} seuil(s) divergent entre src/contenu/poids.ts et serveur/src/poids.ts : ` +
      `${ecarts.join(", ")}\n`
  );
  process.exit(1);
}

console.log(`\n✓ ${cles.length} seuils identiques des deux côtés\n`);
