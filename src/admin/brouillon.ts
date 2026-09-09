import { FORMATS, slugify, type Format } from "@/lib/formats";
import type { Accent, Motif } from "@/blog/covers";
import { resoudre, type Media } from "./sourceMedias";

/** L'article en cours de rédaction, tel que manipulé par le panel. */
export type Brouillon = {
  titre: string;
  slug: string;
  chapeau: string;
  corps: string;
  categorie: string;
  format: Format;
  accent: Accent;
  motif: Motif;
  titre_fantome: string;
  reponse: string;
  version: string;
  exergue: string;
  meta_description: string;
  etiquettes: string;
  auteur: string;
  faq: { q: string; r: string }[];
  publie_le: string;
  statut: "brouillon" | "relecture" | "programme" | "publie";
  /**
   * La vignette de l'article — l'adresse publique d'une image envoyée depuis le
   * panel, ou une chaîne vide.
   *
   * Vide, l'article garde sa couverture VECTORIELLE, construite à partir du
   * motif et de l'accent. Ce n'est pas un repli au rabais : ces couvertures
   * pèsent quelques kilo-octets, ne demandent aucune requête et sont nettes à
   * toute taille. Cinq articles en vivent.
   *
   * Remplie, l'image prend leur place : dans la liste du blog, en tête de
   * l'article, et comme image de partage.
   */
  image: string;
};

export const brouillonVide = (): Brouillon => {
  const spec = FORMATS.info;
  return {
    titre: "",
    slug: "",
    chapeau: "",
    corps: "",
    categorie: "",
    format: "info",
    accent: spec.accent,
    motif: spec.motif,
    titre_fantome: "",
    reponse: "",
    version: "",
    exergue: "",
    meta_description: "",
    etiquettes: "",
    auteur: "Équipe Megasoft",
    faq: [],
    publie_le: new Date().toISOString().slice(0, 10),
    statut: "brouillon",
    image: "",
  };
};

const CLE = "ms-admin-brouillon";

export const sauver = (b: Brouillon) => {
  try {
    localStorage.setItem(CLE, JSON.stringify(b));
  } catch {
    /* stockage plein ou indisponible — la saisie continue en mémoire */
  }
};

export const relire = (): Brouillon | null => {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? { ...brouillonVide(), ...JSON.parse(brut) } : null;
  } catch {
    return null;
  }
};

/** Nombre de mots du corps, pour estimer le temps de lecture. */
export const minutes = (corps: string) =>
  Math.max(1, Math.round(corps.trim().split(/\s+/).filter(Boolean).length / 200));

/* ---------------------------------------------------------------------------
 * CONTRÔLES DE PUBLICATION
 * ------------------------------------------------------------------------- */

export type Controle = {
  libelle: string;
  ok: boolean;
  /** Bloquant : empêche la publication. Sinon simple avertissement. */
  bloquant: boolean;
  detail?: string;
};

export const controler = (b: Brouillon): Controle[] => {
  const spec = FORMATS[b.format];
  const min = minutes(b.corps);
  const [minCible, maxCible] = spec.minutes;

  const liste: Controle[] = [
    { libelle: "Titre renseigné", ok: b.titre.trim().length > 0, bloquant: true },
    {
      libelle: "Adresse de page (slug)",
      ok: /^[a-z0-9-]+$/.test(b.slug),
      bloquant: true,
      detail: "Minuscules, chiffres et tirets uniquement. Elle ne doit plus changer après publication.",
    },
    { libelle: "Chapeau renseigné", ok: b.chapeau.trim().length > 0, bloquant: true },
    { libelle: "Rubrique choisie", ok: b.categorie.trim().length > 0, bloquant: true },
    { libelle: "Corps de l'article", ok: b.corps.trim().length > 200, bloquant: true },
  ];

  // L'encadré « En bref » est le levier de citation le plus direct : sur les
  // formats concernés, il conditionne la publication.
  if (spec.reponseRapide) {
    liste.push({
      libelle: "Encadré « En bref »",
      ok: b.reponse.trim().length >= 40,
      bloquant: true,
      detail: "Une à trois phrases. C'est ce passage que les moteurs génératifs citent le plus volontiers.",
    });
  }

  if (b.format === "nouveaute") {
    liste.push({ libelle: "Numéro de version", ok: b.version.trim().length > 0, bloquant: false });
  }

  liste.push(
    {
      libelle: "Titre ≤ 60 caractères",
      ok: b.titre.length > 0 && b.titre.length <= 60,
      bloquant: false,
      detail: "Au-delà, les moteurs tronquent le titre dans leurs résultats.",
    },
    {
      libelle: "Description 120–160 caractères",
      ok: b.meta_description.length >= 120 && b.meta_description.length <= 160,
      bloquant: false,
    },
    {
      libelle: `Longueur conforme au format (${minCible}–${maxCible} min)`,
      ok: min >= minCible && min <= maxCible,
      bloquant: false,
      detail: `Actuellement ${min} min. Le format « ${spec.nom} » vise ${minCible} à ${maxCible} min.`,
    },
    { libelle: "Au moins deux questions fréquentes", ok: b.faq.filter((f) => f.q && f.r).length >= 2, bloquant: false },
    {
      libelle: "Au moins un lien interne",
      ok: /\]\(\/(?!\/)/.test(b.corps),
      bloquant: false,
      detail: "Un lien vers /#megaerp, /blog ou un autre article renforce le maillage du site.",
    },
    { libelle: "Mot en filigrane (≤ 6 caractères)", ok: b.titre_fantome.length > 0 && b.titre_fantome.length <= 6, bloquant: false }
  );

  return liste;
};

/* ---------------------------------------------------------------------------
 * EXPORT
 * ------------------------------------------------------------------------- */

const echapper = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Produit le fichier Markdown exactement au format attendu par
 * `src/lib/blog.ts`. Tant que le service de publication n'est pas en place
 * (lot 3.1), c'est ce fichier que l'on dépose dans content/blog/.
 *
 * Les médias sont résolus ICI, et pas avant : le corps travaillé dans le panel
 * ne porte que des références courtes (`media:m_abc`), lisibles et comparables
 * d'une version à l'autre, tandis que le fichier exporté doit être autonome —
 * il part sur un hébergement statique qui ne connaît pas la médiathèque.
 */
export const versMarkdown = (b: Brouillon, medias: Media[] = []): string => {
  const l: string[] = ["---"];
  l.push(`titre: ${echapper(b.titre)}`);
  l.push(`slug: ${echapper(b.slug)}`);
  l.push(`chapeau: ${echapper(b.chapeau)}`);
  l.push(`categorie: ${echapper(b.categorie)}`);
  l.push(`format: ${echapper(b.format)}`);
  if (b.reponse.trim()) l.push(`reponse: ${echapper(b.reponse)}`);
  if (b.version.trim()) l.push(`version: ${echapper(b.version)}`);

  const tags = b.etiquettes
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length) l.push(`etiquettes: [${tags.map(echapper).join(", ")}]`);

  l.push(`auteur: ${echapper(b.auteur)}`);
  l.push(`publie_le: ${b.publie_le}`);
  l.push(`maj_le: ${b.publie_le}`);
  l.push(`statut: ${echapper(b.statut)}`);
  l.push(`motif: ${echapper(b.motif)}`);
  l.push(`accent: ${echapper(b.accent)}`);
  if (b.titre_fantome.trim()) l.push(`titre_fantome: ${echapper(b.titre_fantome)}`);
  if (b.exergue.trim()) l.push(`exergue: ${echapper(b.exergue)}`);
  if (b.meta_description.trim()) l.push(`meta_description: ${echapper(b.meta_description)}`);

  const faq = b.faq.filter((f) => f.q.trim() && f.r.trim());
  if (faq.length) {
    l.push("faq:");
    for (const f of faq) {
      l.push(`  - q: ${echapper(f.q)}`);
      l.push(`    r: ${echapper(f.r)}`);
    }
  }

  l.push("---", "", resoudre(b.corps.trim(), medias), "");
  return l.join("\n");
};

export const slugDepuisTitre = (titre: string) => slugify(titre).slice(0, 70);
