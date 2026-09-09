import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import BlogIndexPage from "./blog/BlogIndexPage";
import BlogPostPage from "./blog/BlogPostPage";
import BlogCategoryPage from "./blog/BlogCategoryPage";
import { categories, posts, slugify, type Post } from "./lib/blog";
import { SITE_URL } from "./lib/seo";

/**
 * Point d'entrée de la génération statique du blog — lot 2, option A.
 *
 * Ce module est exécuté par `scripts/build-blog.mjs` dans Node, jamais dans le
 * navigateur. Il produit, pour chaque URL du blog, le HTML complet de la page
 * ainsi que ses métadonnées et ses données structurées.
 *
 * `renderToStaticMarkup` et non `renderToString` : les pages du blog ne sont
 * jamais réhydratées côté client, on n'a donc pas besoin des marqueurs React.
 * Le HTML produit est autonome et se lit sans une ligne de JavaScript.
 */

export type RenderedRoute = {
  /** URL publique, ex. "/blog/mon-article". */
  path: string;
  html: string;
  title: string;
  description: string;
  /** Blocs JSON-LD à insérer dans l'en-tête. */
  jsonLd: unknown[];
  /** Date ISO pour le plan de site. */
  lastmod: string;
  /**
   * Vignette de partage, chemin absolu depuis la racine du site.
   *
   * Absente, la page retombe sur le favicon — et un partage n'affiche alors
   * aucune image. C'est le cas de toutes les pages jusqu'ici, et la raison pour
   * laquelle les articles peuvent désormais porter une image.
   */
  image?: string;
};

const ORG = { "@id": `${SITE_URL}/#organization` };

const breadcrumb = (items: { nom: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.nom,
    item: `${SITE_URL}${it.url}`,
  })),
});

const articleJsonLd = (post: Post) => {
  const url = `${SITE_URL}/blog/${post.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.titre,
    description: post.meta_description ?? post.chapeau,
    datePublished: post.publie_le,
    dateModified: post.maj_le ?? post.publie_le,
    author: { "@type": "Organization", name: post.auteur, ...ORG },
    publisher: { "@type": "Organization", name: "Megasoft Office", ...ORG },
    articleSection: post.categorie,
    keywords: post.etiquettes.join(", "),
    inLanguage: "fr",
  };
};

const faqJsonLd = (post: Post) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: post.faq!.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.r },
  })),
});

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Le header du site lit `useLocation` : même rendu hors navigateur, il lui faut
 * un routeur. StaticRouter le fournit sans émettre le moindre élément DOM.
 */
const rendre = (chemin: string, element: React.ReactElement) =>
  renderToStaticMarkup(<StaticRouter location={chemin}>{element}</StaticRouter>);

/** Produit toutes les pages du blog. */
export function renderAll(): RenderedRoute[] {
  const routes: RenderedRoute[] = [];

  // ---- Index ----
  routes.push({
    path: "/blog/",
    html: rendre("/blog/", <BlogIndexPage />),
    title: "Blog — Gestion, production et terrain algérien | Megasoft",
    description:
      "Ce que trente-cinq ans d'accompagnement d'entreprises algériennes nous ont appris sur la gestion, la comptabilité SCF, la production et la logistique.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": `${SITE_URL}/blog/`,
        name: "Blog Megasoft",
        publisher: { "@type": "Organization", name: "Megasoft Office", ...ORG },
        inLanguage: "fr",
      },
      breadcrumb([
        { nom: "Accueil", url: "/" },
        { nom: "Blog", url: "/blog/" },
      ]),
    ],
    lastmod: posts[0]?.maj_le ?? posts[0]?.publie_le ?? today(),
  });

  // ---- Articles ----
  for (const post of posts) {
    const jsonLd: unknown[] = [
      articleJsonLd(post),
      breadcrumb([
        { nom: "Accueil", url: "/" },
        { nom: "Blog", url: "/blog/" },
        { nom: post.categorie, url: `/blog/categorie/${slugify(post.categorie)}/` },
        { nom: post.titre, url: `/blog/${post.slug}/` },
      ]),
    ];
    if (post.faq?.length) jsonLd.push(faqJsonLd(post));

    routes.push({
      path: `/blog/${post.slug}/`,
      html: rendre(`/blog/${post.slug}/`, <BlogPostPage post={post} />),
      title: `${post.titre} | Megasoft`,
      description: post.meta_description ?? post.chapeau,
      jsonLd,
      lastmod: post.maj_le ?? post.publie_le,
      image: post.image,
    });
  }

  // ---- Catégories ----
  for (const categorie of categories) {
    const liste = posts.filter((p) => p.categorie === categorie);
    routes.push({
      path: `/blog/categorie/${slugify(categorie)}/`,
      html: rendre(`/blog/categorie/${slugify(categorie)}/`, <BlogCategoryPage categorie={categorie} />),
      title: `${categorie} — Blog | Megasoft`,
      description: `Tous les articles Megasoft de la catégorie ${categorie}.`,
      jsonLd: [
        breadcrumb([
          { nom: "Accueil", url: "/" },
          { nom: "Blog", url: "/blog/" },
          { nom: categorie, url: `/blog/categorie/${slugify(categorie)}/` },
        ]),
      ],
      lastmod: liste[0]?.maj_le ?? liste[0]?.publie_le ?? today(),
    });
  }

  return routes;
}

/** Données nécessaires au flux RSS, exposées pour le script de build. */
export function feedData() {
  return posts.map((p) => ({
    slug: p.slug,
    titre: p.titre,
    chapeau: p.chapeau,
    publie_le: p.publie_le,
    categorie: p.categorie,
  }));
}
