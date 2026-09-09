/**
 * CONTRÔLE DU DOSSIER LIVRÉ
 * =========================
 *
 * Ce script s'exécute à la fin de `npm run build` et refuse de laisser passer
 * un site public qui contiendrait le panel d'administration.
 *
 * POURQUOI IL EXISTE
 * ------------------
 * L'audit du 5 septembre 2026 a trouvé, dans un `dist/` prêt à être publié, le
 * fichier `AdminApp-nqXajTJ9.js` contenant le mode « atelier » — c'est-à-dire
 * un formulaire de connexion qui accepte n'importe quelle adresse e-mail et
 * quatre caractères de mot de passe. La cause n'était pas une erreur de code
 * mais une ligne oubliée dans `.env`.
 *
 * Une consigne écrite n'aurait rien empêché : personne n'inspecte le contenu
 * d'un bundle avant de le publier. Un contrôle automatique, si — il casse la
 * commande, et le problème se voit avant la mise en ligne plutôt qu'après.
 *
 * CE QU'IL VÉRIFIE
 * ----------------
 *  1. aucun fichier du panel dans `dist/assets/` ;
 *  2. aucune trace du mode atelier dans le JavaScript livré ;
 *  3. le mot « /admin » n'apparaît dans aucun chunk (ni route, ni référence) ;
 *  4. les fichiers attendus du site public sont bien là.
 *
 * En mode panel (`npm run build:panel`), les contrôles 1 à 3 sont désactivés :
 * le panel est alors demandé volontairement. Le contrôle 2 reste actif, car le
 * mode atelier n'a jamais sa place dans un site construit, panel ou non.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
// Passe par un argument et non une variable d'environnement : `VAR=1 cmd` n'est
// pas une syntaxe valide dans le shell de Windows, or les scripts npm doivent
// fonctionner des deux cotes.
const avecPanel = process.argv.includes("--avec-panel");

/** Fichiers et dossiers que le site public doit toujours contenir. */
const ATTENDUS = [
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  ".htaccess",
  "megasoft-favicon.png",
  "blog",
  "faq",
];

/**
 * Noms de modules du panel. Vite préfixe chaque chunk du nom de son module
 * d'entrée : un fichier `AdminApp-a1b2c3d4.js` trahit donc l'inclusion du
 * panel, même si son contenu est minifié au point d'être illisible.
 */
const MODULES_PANEL = [
  "AdminApp",
  "Barriere",
  "Constructeur",
  "Editeur",
  "Presentations",
  "Articles",
  "Diagnostic",
  "Journal",
  "Medias",
  "Outils",
  "Inspecteur",
  "Toile",
  "ChampCouleur",
];

const erreurs = [];

/* ------------------------------------------------------------------ 0. dist */

if (!existsSync(DIST) || !statSync(DIST).isDirectory()) {
  console.error("\n✖ Le dossier `dist/` n'existe pas. Le build a-t-il échoué ?\n");
  process.exit(1);
}

/* --------------------------------------------------- 1. fichiers du panel */

const assets = existsSync(join(DIST, "assets")) ? readdirSync(join(DIST, "assets")) : [];

if (!avecPanel) {
  const intrus = assets.filter((f) =>
    MODULES_PANEL.some((m) => f.startsWith(`${m}-`) || f.startsWith(`${m}.`))
  );
  if (intrus.length) {
    erreurs.push(
      `Le panel d'administration est présent dans le site public :\n` +
        intrus.map((f) => `      dist/assets/${f}`).join("\n") +
        `\n    Cause probable : \`VITE_AVEC_PANEL\` a été laissé à "1", ou une importation` +
        `\n    du panel a été ajoutée hors du ternaire de src/App.tsx.`
    );
  }
}

/* ------------------------------------- 2 et 3. contenu du JavaScript livré */

const js = assets.filter((f) => f.endsWith(".js"));

const contient = (motif) =>
  js.filter((f) => motif.test(readFileSync(join(DIST, "assets", f), "utf8")));

/*
 * Le mode atelier n'a jamais sa place dans un site construit — même avec panel.
 *
 * ON CHERCHE UN MARQUEUR, PAS UNE PHRASE.
 *
 * La première version cherchait le texte « Mode atelier », celui de la pastille
 * affichée à l'écran. Le 6 septembre 2026, l'ajout d'un paragraphe parfaitement
 * légitime — « Mode atelier : aucun mot de passe n'est vérifié » — dans une
 * branche INACTIVE a fait échouer la construction d'un site parfaitement sain.
 *
 * Un détecteur qui se déclenche sur de la prose finit par être contourné en
 * reformulant la phrase, ce qui est exactement l'inverse du but. Le marqueur,
 * lui, est posé sur le bloc que seul le mode atelier fait exister
 * (`data-authentification` dans `src/admin/AdminApp.tsx`) : hors de ce mode, la
 * condition est constante à la construction et le bloc disparaît du bundle.
 */
const atelier = contient(/MEGASOFT_AUTH_ATELIER_ACTIF/);
if (atelier.length) {
  erreurs.push(
    `Le mode « atelier » est dans le site construit — n'importe quel visiteur\n` +
      `    peut entrer dans le panel avec un e-mail quelconque et quatre caractères :\n` +
      atelier.map((f) => `      dist/assets/${f}`).join("\n") +
      `\n    Retirez \`VITE_ADMIN_AUTH=atelier\` de .env et reconstruisez.`
  );
}

if (!avecPanel) {
  const routeAdmin = contient(/["'`]\/admin/);
  if (routeAdmin.length) {
    erreurs.push(
      `Une référence à /admin subsiste dans le JavaScript livré :\n` +
        routeAdmin.map((f) => `      dist/assets/${f}`).join("\n")
    );
  }
}

/* ------------------------------------------------ 4. le site public est là */

const manquants = ATTENDUS.filter((f) => !existsSync(join(DIST, f)));
if (manquants.length) {
  erreurs.push(`Fichiers attendus absents de dist/ : ${manquants.join(", ")}`);
}

/* ------------------------------------------------------------------ sortie */

if (erreurs.length) {
  console.error(`\n✖ dist/ N'EST PAS PUBLIABLE — ${erreurs.length} problème(s)\n`);
  erreurs.forEach((e, i) => console.error(`  ${i + 1}. ${e}\n`));
  process.exit(1);
}

const poids = (dossier) =>
  readdirSync(dossier, { withFileTypes: true }).reduce(
    (t, e) =>
      t + (e.isDirectory() ? poids(join(dossier, e.name)) : statSync(join(dossier, e.name)).size),
    0
  );

const pages = existsSync(join(DIST, "blog")) ? readdirSync(join(DIST, "blog")).length : 0;

console.log(
  `\n✓ dist/ publiable — ${avecPanel ? "AVEC panel d'administration" : "site public seul, sans panel"}\n` +
    `  ${js.length} fichiers JS · ${pages} entrées sous /blog · ${(poids(DIST) / 1024 / 1024).toFixed(1)} Mo au total\n`
);
