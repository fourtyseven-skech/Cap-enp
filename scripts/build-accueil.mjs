/**
 * Pré-génération de la page d'accueil.
 *
 * Exécuté après `vite build` (et avant la génération du blog, qui lit le même
 * manifeste). Il rend les sections de l'accueil en HTML avec les VRAIS
 * composants React du site, puis écrit ce HTML dans `dist/index.html`, à
 * l'intérieur du `<div id="root">` que Vite y laisse vide.
 *
 * Avant ce script, le texte lisible sans exécuter JavaScript sur l'accueil
 * tenait en 272 caractères — des fragments de commentaires HTML. GPTBot,
 * ClaudeBot et PerplexityBot n'y voyaient rien de l'offre Megasoft.
 *
 * Le HTML injecté est remplacé par React au montage (`createRoot().render()`
 * vide son conteneur) : le visiteur ne le voit jamais, le squelette d'attente
 * le recouvrant jusqu'à la première peinture. Voir src/entry-accueil.tsx pour
 * le détail du raisonnement.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { verifierTete } from "./tete-commune.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const fichier = path.join(dist, "index.html");
const SITE_URL = "https://megasoft-office.com";

/** Marqueur du conteneur laissé vide par Vite dans index.html. */
const ROOT_VIDE = '<div id="root"></div>';

/**
 * Rétablit les URL des images.
 *
 * Le rendu passe par `ssrLoadModule`, qui résout `import logo from "…webp"` en
 * chemin de DÉVELOPPEMENT — `/src/assets/clients/ups.webp`. Ce fichier n'existe
 * pas dans `dist/` : chaque logo client partait donc en 404, et comme l'hôte
 * réécrit les URL inconnues vers l'application, le navigateur recevait à la
 * place les 200 Ko de index.html… trente fois. Mesuré : le LCP passait de 2,6 s
 * à 6,6 s sur mobile.
 *
 * Le manifeste de Vite donne la correspondance vers le fichier haché réellement
 * livré. On la rejoue ici.
 */
async function resoudreAssets(html, manifest) {
  const table = new Map();
  for (const [source, entree] of Object.entries(manifest)) {
    if (entree.file && !entree.isEntry && !source.endsWith(".html")) {
      table.set(source, `/${entree.file}`);
    }
  }

  const MOTIF = /["'](\/?src\/[^"']+?\.(?:webp|png|jpe?g|svg|gif|avif))["']/gi;

  /*
   * Les fichiers de moins de 4 Ko (`assetsInlineLimit`) ne sont pas émis : Vite
   * les inline en data URI dans le JavaScript. Ils n'ont donc ni entrée au
   * manifeste ni fichier dans dist/ — c'est le cas d'une trentaine de logos
   * clients. Les recopier en base64 dans le HTML pré-généré l'alourdirait de
   * plus de 100 Ko pour un contenu que React jette aussitôt ; on émet donc une
   * copie du fichier d'origine, vers laquelle l'attribut `src` pointe. Le
   * visiteur ne la télécharge jamais (React remplace ce HTML), un robot y
   * trouve une vraie image indexable.
   */
  const copies = new Map();
  for (const [, chemin] of html.matchAll(MOTIF)) {
    const cle = chemin.replace(/^\//, "");
    if (table.has(cle) || copies.has(cle)) continue;
    const source = path.join(root, cle);
    try {
      await fs.access(source);
    } catch {
      continue; // Signalé plus bas par le contrôle des chemins restants.
    }
    const nom = `pregen-${path.basename(cle)}`;
    await fs.copyFile(source, path.join(dist, "assets", nom));
    copies.set(cle, `/assets/${nom}`);
  }

  const resolu = html.replace(MOTIF, (tel, chemin) => {
    const cle = chemin.replace(/^\//, "");
    const cible = table.get(cle) ?? copies.get(cle);
    return cible ? `"${cible}"` : tel;
  });

  // Un chemin de développement encore présent partirait en 404 chez chaque
  // robot — et, l'hôte réécrivant les URL inconnues vers l'application, en
  // renvoyant les 200 Ko de index.html. On interrompt plutôt que de publier
  // des liens morts.
  const restants = [...resolu.matchAll(MOTIF)];
  if (restants.length) {
    throw new Error(
      `${restants.length} image(s) non résolue(s) dans le HTML pré-généré, ex. ${restants[0][1]} — ` +
        "introuvable(s) au manifeste comme sur le disque."
    );
  }

  if (copies.size) {
    console.log(`  ${copies.size} image(s) inlinée(s) par Vite recopiée(s) pour la pré-génération`);
  }

  return resolu;
}

/**
 * Toutes les images du HTML pré-généré passent en chargement paresseux.
 *
 * Ce HTML est remplacé par React dès le montage : aucune de ces images n'a
 * besoin d'être téléchargée pour le visiteur, qui verra celles rendues par
 * l'application. Les laisser en chargement normal ferait partir des dizaines de
 * requêtes en concurrence avec les ressources critiques, pour des fichiers
 * jetés aussitôt. Un robot, lui, lit l'attribut `src` et le texte `alt` sans se
 * soucier du chargement : le référencement des images est préservé.
 */
function imagesParesseuses(html) {
  return html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
}

/**
 * Remplace les métadonnées du gabarit par celles d'une page secondaire.
 *
 * Le gabarit est `dist/index.html`, donc porteur des métadonnées de l'accueil.
 * Servi tel quel pour /faq, il annoncerait aux moteurs deux URL au titre, à la
 * description et au canonique identiques — le meilleur moyen de n'en faire
 * classer aucune. On les réécrit donc, en visant chaque balise nommément.
 */
function metadonnees(html, meta) {
  const url = `${SITE_URL}${meta.path}`;
  const echapper = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const titre = echapper(meta.title);
  const description = echapper(meta.description);

  const avant = html;
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${titre}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${description}" />`
    )
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`)
    .replace(
      /<meta property="og:title" content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${titre}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${description}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${url}" />`
    );

  if (html === avant) {
    throw new Error(
      `Aucune métadonnée remplacée pour ${meta.path} — les balises de index.html ont changé de ` +
        "forme. Corriger `metadonnees()` plutôt que publier une page au titre de l'accueil."
    );
  }
  return html;
}

/** Le texte réellement lisible sans exécuter JavaScript. */
function texteSansJs(html) {
  return html
    .slice(html.indexOf("<body"))
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const vite = await createServer({
    root,
    logLevel: "warn",
    server: { middlewareMode: true },
    appType: "custom",
  });

  try {
    const mod = await vite.ssrLoadModule("/src/entry-accueil.tsx");
    const { seoByPath } = await vite.ssrLoadModule("/src/lib/seo.ts");

    /*
     * React avertit qu'un `useLayoutEffect` ne s'exécute pas côté serveur et
     * que l'interface rendue risque de différer de l'interface hydratée. Ici
     * l'avertissement ne s'applique pas : ce HTML n'est JAMAIS hydraté, React
     * vide le conteneur et rend l'application normalement (voir
     * src/entry-accueil.tsx). Le laisser passer noierait les vrais problèmes
     * dans le bruit à chaque build, on le filtre donc — lui seul.
     */
    const warn = console.error;
    console.error = (...args) => {
      const premier = typeof args[0] === "string" ? args[0] : "";
      if (premier.includes("useLayoutEffect does nothing on the server")) return;
      warn(...args);
    };

    let brutAccueil;
    let brutFaq;
    try {
      brutAccueil = mod.renderAccueil();
      brutFaq = mod.renderPageFaq();
    } finally {
      console.error = warn;
    }

    const manifest = JSON.parse(
      await fs.readFile(path.join(dist, ".vite", "manifest.json"), "utf8")
    );
    const preparer = async (html) => imagesParesseuses(await resoudreAssets(html, manifest));

    /*
     * Le gabarit est lu UNE FOIS, avant toute injection : les deux pages en
     * partent. Le relire après avoir écrit l'accueil produirait une page /faq
     * contenant, en plus, tout le contenu de l'accueil.
     */
    /*
     * LE GABARIT VIERGE EST CONSERVÉ À PART.
     *
     * `vite build` écrit un `index.html` qui contient encore le conteneur vide.
     * Ce script le remplit — et le fichier ne le contient donc plus. Rejouer la
     * pré-génération sans reconstruire échouait alors sur « conteneur
     * introuvable », alors que rien n'était cassé.
     *
     * C'est exactement ce qu'il fallait pouvoir faire : publier un article ne
     * change aucun JavaScript, donc n'a aucune raison de relancer Vite. On
     * garde donc une copie du gabarit vierge à chaque construction complète, et
     * on repart de cette copie ensuite.
     */
    /* HORS de `dist/` : ce fichier est un outil de construction, pas une page.
       Dans `dist/`, il partirait chez le client et compterait comme une page de
       plus pour l'empreinte HTML. `dist/` est vidé à chaque construction
       complète ; ce dossier-ci, non — c'est précisément ce qu'on veut. */
    const cache = path.join(path.dirname(dist), ".cache-build");
    await fs.mkdir(cache, { recursive: true });
    const copieGabarit = path.join(cache, "gabarit-vierge.html");
    let gabarit = await fs.readFile(fichier, "utf8");

    if (gabarit.includes(ROOT_VIDE)) {
      // Sortie fraîche de Vite : c'est la référence, on la met de côté.
      await fs.writeFile(copieGabarit, gabarit, "utf8");
    } else {
      try {
        gabarit = await fs.readFile(copieGabarit, "utf8");
      } catch {
        throw new Error(
          `Conteneur ${ROOT_VIDE} introuvable dans dist/index.html, et aucune copie du gabarit ` +
            "vierge à côté. Relancez une construction complète (`npm run build`) : les pages " +
            "repartiraient sinon sans contenu pré-généré."
        );
      }
    }

    const pages = [];

    /* --- L'accueil --- */
    const accueil = await preparer(brutAccueil);
    pages.push({
      nom: "Accueil",
      chemin: fichier,
      html: gabarit.replace(ROOT_VIDE, `<div id="root">${accueil}</div>`),
      taille: accueil.length,
    });

    /* --- La page « Questions fréquentes » --- */
    const faq = mod.faqJsonLd();
    const contenuFaq = await preparer(brutFaq);
    let htmlFaq = gabarit.replace(ROOT_VIDE, `<div id="root">${contenuFaq}</div>`);
    htmlFaq = metadonnees(htmlFaq, seoByPath["/faq"]);
    /*
     * Le balisage FAQPage vit ICI et nulle part ailleurs : Google exige que les
     * questions-réponses qu'il déclare soient visibles sur la page qui le porte.
     * Sur l'accueil, où la FAQ ne figure plus, il constituerait exactement le
     * décalage que les moteurs traitent comme une manipulation.
     */
    htmlFaq = htmlFaq.replace(
      "</head>",
      `<script type="application/ld+json">${JSON.stringify(faq)}</script>\n  </head>`
    );
    await fs.mkdir(path.join(dist, "faq"), { recursive: true });
    pages.push({
      nom: "FAQ",
      chemin: path.join(dist, "faq", "index.html"),
      html: htmlFaq,
      taille: contenuFaq.length,
      questions: faq.mainEntity.length,
    });

    for (const page of pages) {
      // index.html est écrit à la main : ce contrôle est le seul garde-fou
      // contre la suppression accidentelle d'une balise commune.
      verifierTete(page.html, page.nom);
      await fs.writeFile(page.chemin, page.html, "utf8");

      // Contrôle : un chiffre qui s'effondre signale une régression silencieuse
      // (un composant qui ne rend plus rien côté serveur) que rien d'autre ne
      // rattraperait.
      const texte = texteSansJs(page.html);
      console.log(
        `✓ ${page.nom} pré-générée : ${Math.round(page.taille / 1024)} Ko injectés, ` +
          `${texte.length} caractères lisibles sans JavaScript` +
          (page.questions ? ` (${page.questions} questions en données structurées)` : "")
      );

      if (texte.length < 1500) {
        throw new Error(
          `${page.nom} : seulement ${texte.length} caractères lisibles sans JavaScript — la ` +
            "pré-génération n'a manifestement pas produit le contenu attendu. Build interrompu."
        );
      }
    }
  } finally {
    await vite.close();
  }
}

main().catch((err) => {
  console.error("✗ Pré-génération de l'accueil échouée :", err);
  process.exit(1);
});
