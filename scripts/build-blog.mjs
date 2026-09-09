/**
 * Génération statique du blog — lot 2 du cadrage MEGA-WEB-003, option A.
 *
 * Exécuté après `vite build`. Pour chaque article Markdown de content/blog/, il
 * écrit une vraie page HTML dans dist/, contenant le texte complet, ses
 * métadonnées et ses données structurées — lisible sans exécuter une seule
 * ligne de JavaScript, donc par GPTBot, ClaudeBot et PerplexityBot.
 *
 * Le rendu passe par `vite.ssrLoadModule`, ce qui permet de réutiliser
 * directement les composants React du site (TypeScript, alias @/, import.meta.glob)
 * sans configuration de build supplémentaire ni duplication de gabarit.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { BALISES_COMMUNES, verifierTete } from "./tete-commune.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE_URL = "https://megasoft-office.com";

/**
 * Les pages du site hors blog, telles qu'elles entrent au plan du site.
 *
 * Les articles, eux, sont ajoutés automatiquement : aucun ne peut être oublié.
 * Cette liste-ci est manuelle — toute page pré-générée par
 * `scripts/build-accueil.mjs` doit y figurer, sans quoi elle resterait
 * inconnue des moteurs.
 */
const PAGES_STATIQUES = [
  { path: "/", priority: "1.0", changefreq: "monthly" },
  { path: "/faq", priority: "0.8", changefreq: "monthly" },
];

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Retrouve, dans le manifeste de Vite, la feuille de style et le module des
 * îlots interactifs — leurs noms sont hachés et changent à chaque build.
 */
async function lireAssets() {
  const manifest = JSON.parse(await fs.readFile(path.join(dist, ".vite", "manifest.json"), "utf8"));
  const entree = manifest["src/entry-blog-client.tsx"];
  if (!entree) throw new Error("Îlots du blog absents du manifeste — lancer `vite build` d'abord.");

  // La feuille de style du site est rattachée à l'entrée principale. On la
  // cherche nommément : parcourir tout le manifeste tombait sur la première
  // feuille venue — celle du panel admin, chargée en lazy — et les pages du
  // blog se retrouvaient sans aucun style en production.
  const css = manifest["index.html"]?.css?.[0];
  if (!css) throw new Error("Feuille de style introuvable dans le manifeste (entrée index.html).");

  return {
    css: `/${css}`,
    js: `/${entree.file}`,
    // Modules dont dépend l'entrée : préchargés pour éviter une cascade.
    preload: (entree.imports ?? []).map((k) => `/${manifest[k].file}`),
  };
}

/*
 * Les polices du premier écran, l'encodage, le favicon et l'auteur vivent
 * maintenant dans `tete-commune.mjs` : ils sont identiques sur toutes les
 * pages du site, et les tenir à jour en trois exemplaires ne pouvait que
 * finir par diverger — c'est ce qui s'est produit avec le favicon.
 *
 * `crossorigin` sur les polices est obligatoire même en même origine : une
 * police est toujours demandée en mode anonyme, et sans cet attribut le
 * fichier préchargé ne serait pas réutilisé — il partirait deux fois.
 */

function page({ route, assets }) {
  const url = `${SITE_URL}${route.path}`;
  const ld = route.jsonLd
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join("\n    ");
  const css = assets.css;
  const preload = assets.preload
    .map((f) => `<link rel="modulepreload" href="${f}">`)
    .join("\n    ");

  /*

   * « summary_large_image » sans image réelle donne une carte VIDE sur LinkedIn

   * et X : la plateforme réserve une grande zone et n'a rien à y mettre. Sans

   * vignette d'article, on annonce donc une carte simple, qui se contente du

   * favicon sans promettre davantage.

   *

   * L'explication est ici et non dans le gabarit : un commentaire HTML part

   * chez tous les visiteurs. Celui-ci pesait 219 octets sur chacune des onze

   * pages du blog.

   */

  const carte = route.image ? "summary_large_image" : "summary";


  return `<!doctype html>
<html lang="fr">
  <head>
    ${BALISES_COMMUNES}
    <title>${escapeXml(route.title)}</title>
    <meta name="description" content="${escapeXml(route.description)}">
    <link rel="canonical" href="${url}">
    <link rel="alternate" type="application/rss+xml" title="Blog Megasoft" href="${SITE_URL}/blog/rss.xml">

    <meta property="og:type" content="${route.path === "/blog/" ? "website" : "article"}">
    <meta property="og:title" content="${escapeXml(route.title)}">
    <meta property="og:description" content="${escapeXml(route.description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITE_URL}${route.image || "/megasoft-favicon.png"}">
    <meta name="twitter:card" content="${carte}">
    <meta name="twitter:title" content="${escapeXml(route.title)}">
    <meta name="twitter:description" content="${escapeXml(route.description)}">
    <meta name="twitter:image" content="${SITE_URL}${route.image || "/megasoft-favicon.png"}">

    <link rel="stylesheet" href="${css}">

    <!--
      Pré-chargement spéculatif : au survol d'un lien vers un autre article, le
      navigateur prépare la page en arrière-plan. Combiné aux transitions CSS,
      le passage d'un article à l'autre devient quasi instantané.

      C'est une déclaration JSON, pas du code exécuté : la page reste lisible
      sans JavaScript, et les navigateurs qui ignorent cette fonctionnalité
      chargent simplement la page au clic, comme d'habitude.
    -->
    <script type="speculationrules">
      {"prerender":[{"where":{"href_matches":"/blog/*"},"eagerness":"moderate"}]}
    </script>
    ${ld}
  </head>
  <body>
    ${route.html}

    <!--
      Le visiteur qui arrive sur un article a, de fait, déjà découvert le site :
      s'il rejoint ensuite l'accueil, l'animation d'introduction n'a plus lieu
      d'être. On pose le drapeau ici pour que la page d'accueil le sache.
    -->
    <script>try{sessionStorage.setItem("hasSeenIntro","true");sessionStorage.setItem("msIntroSkip","1")}catch(e){}</script>

    <!-- Îlots interactifs : en-tête et pied de page du site. Le texte de
         l'article est déjà dans le HTML ci-dessus et ne dépend pas de ce
         module. -->
    ${preload}
    <script type="module" src="${assets.js}"></script>
  </body>
</html>
`;
}

function rss(items) {
  const entries = items
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.titre)}</title>
      <link>${SITE_URL}/blog/${p.slug}/</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}/</guid>
      <pubDate>${new Date(p.publie_le).toUTCString()}</pubDate>
      <category>${escapeXml(p.categorie)}</category>
      <description>${escapeXml(p.chapeau)}</description>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Megasoft</title>
    <link>${SITE_URL}/blog/</link>
    <description>Gestion, production et terrain algérien — le blog de Megasoft Office.</description>
    <language>fr</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`;
}

function sitemap(routes) {
  // Les pages du site (hors blog) sont déclarées ici ; les pages du blog sont
  // ajoutées automatiquement, pour qu'un article ne puisse jamais être oublié.
  // La page ERP dédiée a été retirée : son contenu vit dans la section « En
  // images » de l'accueil. La laisser au plan du site enverrait les moteurs sur
  // une adresse qui n'existe plus.

  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    ...PAGES_STATIQUES.map((s) => ({ ...s, lastmod: today })),
    ...routes.map((r) => ({
      path: r.path,
      lastmod: r.lastmod,
      priority: r.path === "/blog/" ? "0.9" : "0.7",
      changefreq: r.path === "/blog/" ? "weekly" : "monthly",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré automatiquement par scripts/build-blog.mjs — ne pas éditer à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.path}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

async function main() {
  const assets = await lireAssets();

  const vite = await createServer({
    root,
    logLevel: "warn",
    server: { middlewareMode: true },
    appType: "custom",
  });

  try {
    const mod = await vite.ssrLoadModule("/src/entry-blog.tsx");
    const routes = mod.renderAll();
    const feed = mod.feedData();

    for (const route of routes) {
      // Chaque URL devient un dossier contenant index.html : l'adresse reste
      // propre (/blog/mon-article) sans configuration serveur particulière.
      const dir = path.join(dist, route.path);
      await fs.mkdir(dir, { recursive: true });
      const html = page({ route, assets });
      verifierTete(html, `blog ${route.path}`);
      await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
    }

    await fs.writeFile(path.join(dist, "blog", "rss.xml"), rss(feed), "utf8");
    await fs.writeFile(path.join(dist, "sitemap.xml"), sitemap(routes), "utf8");

    console.log(`✓ Blog généré : ${routes.length} page(s)`);
    for (const r of routes) console.log(`  ${r.path}`);
    console.log(`  /blog/rss.xml`);
    console.log(`  /sitemap.xml (${routes.length + PAGES_STATIQUES.length} URL)`);
  } finally {
    await vite.close();
  }
}

main().catch((err) => {
  console.error("✗ Génération du blog échouée :", err);
  process.exit(1);
});
