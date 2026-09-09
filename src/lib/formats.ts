import type { Accent, Motif } from "@/blog/covers";

/**
 * ---------------------------------------------------------------------------
 * LES CINQ FORMATS ÉDITORIAUX
 * ---------------------------------------------------------------------------
 * Chaque format répond à une intention marketing distincte et impose sa propre
 * mise en page, son gabarit de filigrane et sa longueur cible. Le rédacteur ne
 * choisit donc pas une apparence : il choisit une INTENTION, et l'apparence en
 * découle. C'est ce qui garantit qu'un blog alimenté par plusieurs personnes
 * reste cohérent dans le temps.
 *
 * Ce module est volontairement séparé de `blog.ts` : celui-ci charge tous les
 * articles Markdown au build (gray-matter, marked, contenu complet). Le panel
 * d'administration n'a besoin que de la taxonomie — les garder ensemble
 * l'obligeait à embarquer l'intégralité du blog dans son chunk.
 */
export type Format = "info" | "fond" | "nouveaute" | "offre" | "terrain";

export type FormatSpec = {
  nom: string;
  /** Ce que l'article cherche à obtenir. */
  intention: string;
  motif: Motif;
  accent: Accent;
  /** Sommaire ancré en marge — inutile sur un texte court. */
  sommaire: boolean;
  /** Encadré « réponse en une phrase » en tête d'article. */
  reponseRapide: boolean;
  /** Fourchette de longueur visée, en minutes de lecture. */
  minutes: [number, number];
};

export const FORMATS: Record<Format, FormatSpec> = {
  info: {
    nom: "Info rapide",
    intention:
      "Répondre à une question précise que les clients posent vraiment. Capte les recherches de longue traîne et se fait citer tel quel par les moteurs génératifs.",
    motif: "question",
    accent: "office",
    sommaire: false,
    reponseRapide: true,
    minutes: [2, 4],
  },
  fond: {
    nom: "Article de fond",
    intention:
      "Installer l'autorité de Megasoft sur un sujet métier. C'est le format qui construit la réputation et qu'on cite en référence.",
    motif: "grille",
    accent: "service",
    sommaire: true,
    reponseRapide: false,
    minutes: [6, 10],
  },
  nouveaute: {
    nom: "Nouveauté Megasoft",
    intention:
      "Annoncer une version, une fonctionnalité ou un module. Rassure les clients existants et prouve que la gamme vit.",
    motif: "jalons",
    accent: "office",
    sommaire: false,
    reponseRapide: false,
    minutes: [3, 5],
  },
  offre: {
    nom: "Offre & tarifs",
    intention:
      "Présenter une formule, un plan de paiement, une condition commerciale. Format le plus proche de la vente : il doit convertir.",
    motif: "devises",
    accent: "digital",
    sommaire: false,
    reponseRapide: true,
    minutes: [3, 6],
  },
  terrain: {
    nom: "Retour de terrain",
    intention:
      "Raconter un déploiement réel : contexte, obstacle, résultat. La preuve sociale la plus convaincante dont dispose un éditeur.",
    motif: "routes",
    accent: "service",
    sommaire: true,
    reponseRapide: false,
    minutes: [5, 8],
  },
};

/** Accentuation retirée, espaces en tirets : sert aux ancres et aux URL. */
export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
