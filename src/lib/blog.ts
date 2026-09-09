import { load } from "js-yaml";
import { marked } from "marked";

/**
 * Chargement des articles — lot 2 du cadrage MEGA-WEB-003, option A.
 *
 * Les articles sont de simples fichiers Markdown versionnés dans
 * `content/blog/`. Ce module est la source unique : il sert à l'aperçu en
 * développement comme à la génération des pages HTML statiques au build, afin
 * qu'un article ne puisse jamais s'afficher différemment selon le contexte.
 *
 * `import.meta.glob` est résolu par Vite à la compilation : les fichiers sont
 * lus au build, jamais à l'exécution. Aucun serveur, aucune base de données.
 *
 * ⚠️ Ce module tourne dans DEUX environnements : Node (génération des pages du
 * blog) et le navigateur (panel d'administration). Il ne doit donc utiliser
 * aucune API propre à Node. C'est ce qui a coûté le remplacement de
 * `gray-matter` : sa fonction `toBuffer` appelle `Buffer.from`, qui n'existe
 * pas dans un navigateur — le module levait une exception à l'évaluation, le
 * chargement du panel échouait, et la page restait blanche sans erreur
 * apparente. `js-yaml` est du JavaScript pur et fonctionne des deux côtés.
 */

/** Sépare l'en-tête de métadonnées du corps Markdown. */
const separer = (brut: string): { data: Record<string, unknown>; content: string } => {
  const texte = brut.replace(/^\uFEFF/, "");
  if (!texte.startsWith("---")) return { data: {}, content: texte };

  const fin = texte.indexOf("\n---", 3);
  if (fin === -1) return { data: {}, content: texte };

  const entete = texte.slice(texte.indexOf("\n") + 1, fin);
  // On retire le « \n--- » de fermeture, puis le reste de cette ligne.
  const content = texte.slice(fin + 4).replace(/^[^\n]*\r?\n?/, "");

  return { data: (load(entete) as Record<string, unknown>) ?? {}, content };
};

/**
 * YAML transforme `2026-08-12` en objet Date. Tout le reste du code attend une
 * chaîne « AAAA-MM-JJ » — on normalise ici plutôt que de s'en méfier partout.
 */
const normaliserDates = (d: Record<string, unknown>) => {
  for (const cle of ["publie_le", "maj_le"]) {
    const v = d[cle];
    if (v instanceof Date) d[cle] = v.toISOString().slice(0, 10);
  }
  return d;
};

import type { Accent, Motif } from "@/blog/covers";
import { FORMATS, slugify, type Format, type FormatSpec } from "@/lib/formats";

// Réexportés pour que les consommateurs existants ne changent pas d'import.
export { FORMATS, slugify };
export type { Format, FormatSpec };

export type FaqEntry = { q: string; r: string };

export type PostMeta = {
  slug: string;
  titre: string;
  chapeau: string;
  categorie: string;
  etiquettes: string[];
  auteur: string;
  publie_le: string;
  maj_le?: string;
  statut: "brouillon" | "relecture" | "programme" | "publie" | "archive";
  meta_description?: string;
  faq?: FaqEntry[];

  /** Format éditorial. Détermine la mise en page et le gabarit de filigrane. */
  format?: Format;
  /** Info rapide / Offre : la réponse en une phrase, mise en exergue en tête. */
  reponse?: string;
  /** Nouveauté : le numéro de version annoncé. */
  version?: string;

  /** Couverture vectorielle : motif du sujet, couleur du pôle, mot en filigrane.
   *  Laissés vides, ils héritent des valeurs du format. */
  motif?: Motif;
  accent?: Accent;
  titre_fantome?: string;
  /** Phrase saillante mise en exergue au milieu de l'article. */
  exergue?: string;
  /** Marque l'article comme maquette de présentation, non destiné à la publication. */
  maquette?: boolean;
  /**
   * Vignette de l'article : `/medias/<identifiant>.webp`.
   *
   * Absente, la couverture vectorielle est utilisée — voir `blog/covers.tsx`.
   */
  image?: string;
};

export type Post = PostMeta & {
  /** Format effectif et son gabarit, toujours résolus. */
  format: Format;
  spec: FormatSpec;
  /** Markdown d'origine, conservé pour que le panel puisse rouvrir l'article. */
  corps: string;
  /** Chemin du fichier source, affiché dans le panel. */
  fichier: string;
  /** Corps de l'article converti en HTML. */
  html: string;
  /** Temps de lecture estimé, en minutes. */
  minutes: number;
  /** Intertitres de niveau 2, pour le sommaire ancré. */
  sommaire: { id: string; texte: string }[];
};

const files = import.meta.glob("/content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const parse = (raw: string, path: string): Post => {
  const { data, content } = separer(raw);
  const meta = normaliserDates(data) as unknown as PostMeta;

  // Le nom de fichier fait foi si le front-matter ne déclare pas de slug :
  // une URL ne doit jamais dépendre d'un champ qu'on peut oublier.
  const slug = meta.slug ?? path.split("/").pop()!.replace(/\.md$/, "");

  // Les intertitres reçoivent un identifiant stable, réutilisé par le sommaire
  // ancré et par les liens profonds que les moteurs génératifs citent.
  const sommaire: { id: string; texte: string }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const texte = tokens.map((t) => ("raw" in t ? t.raw : "")).join("");
    const id = slugify(texte);
    if (depth === 2) sommaire.push({ id, texte });
    return `<h${depth} id="${id}">${texte}</h${depth}>`;
  };

  const html = marked.parse(content, { renderer, async: false }) as string;

  // ~200 mots/minute, arrondi au supérieur, jamais moins d'une minute.
  const mots = content.trim().split(/\s+/).length;

  // Le format fournit les valeurs par défaut ; le front-matter peut toujours
  // les surcharger au cas par cas.
  const format: Format = meta.format ?? "fond";
  const spec = FORMATS[format];

  return {
    ...meta,
    slug,
    format,
    spec,
    corps: content,
    fichier: path.replace(/^\//, ""),
    motif: meta.motif ?? spec.motif,
    accent: meta.accent ?? spec.accent,
    etiquettes: meta.etiquettes ?? [],
    html,
    sommaire,
    minutes: Math.max(1, Math.round(mots / 200)),
  };
};

const all = Object.entries(files)
  .map(([path, raw]) => parse(raw, path))
  // Antéchronologique : le plus récent en tête.
  .sort((a, b) => (a.publie_le < b.publie_le ? 1 : -1));

/** Articles réellement publiés. Les brouillons ne sortent jamais du build. */
export const posts = all.filter((p) => p.statut === "publie");

/** TOUS les articles, brouillons compris — réservé au panel d'administration. */
export const tousLesArticles = all;

export const getPost = (slug: string) => posts.find((p) => p.slug === slug);

export const categories = [...new Set(posts.map((p) => p.categorie))].sort();

export const postsByCategory = (categorie: string) =>
  posts.filter((p) => p.categorie === categorie);

/** Trois articles proches, même catégorie d'abord, pour le maillage interne. */
export const related = (post: Post, n = 3) =>
  [...posts.filter((p) => p.slug !== post.slug)]
    .sort((a, b) => Number(b.categorie === post.categorie) - Number(a.categorie === post.categorie))
    .slice(0, n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
