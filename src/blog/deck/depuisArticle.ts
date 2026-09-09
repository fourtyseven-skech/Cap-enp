import { marked } from "marked";
import { slugify } from "@/lib/formats";
import {
  NUIT,
  PAPIER,
  STYLE_TABLEAU,
  THEME_MEGASOFT,
  cellule,
  diapositiveVide,
  forme,
  graphique,
  avecIdentifiantsStables,
  identifiant,
  tableau,
  texte,
  type Diapositive,
  type Document,
  type Element,
  type Theme,
} from "./modele";
import { LARGEUR_UTILE, MARGE as M, MARGE_HAUT as HAUT, signature } from "./gabarits";

/**
 * ---------------------------------------------------------------------------
 * ARTICLE → PRÉSENTATION
 * ---------------------------------------------------------------------------
 *
 * Projette un article Markdown en document de présentation. C'est ce qui
 * alimente le mode diaporama du blog, et c'est aussi le bouton « partir d'un
 * article » de l'éditeur.
 *
 * RIEN N'EST STOCKÉ. La source d'un article est et reste son fichier Markdown ;
 * le document produit ici est recalculé à chaque build. Conséquences voulues :
 * aucun champ nouveau dans le front-matter, les articles déjà écrits deviennent
 * des présentations sans retouche, et le texte indexé par les moteurs est
 * inchangé — le mode diapo est une surcouche cliente.
 *
 * DIFFÉRENCE AVEC L'ÉDITEUR. Ce module produit des ÉLÉMENTS ordinaires, comme
 * s'ils avaient été posés à la main. Une présentation importée dans le panel
 * est donc immédiatement modifiable : on déplace un titre, on supprime un bloc,
 * on ajoute une image. Elle n'est pas prisonnière du gabarit qui l'a produite.
 */

/* Seuils de découpe. Une présentation ne se lit pas, elle se regarde : au-delà,
   on coupe. Ils sont volontairement bas. */
const SEUIL_TEXTE = 300;
const MAX_POINTS = 5;
const BUDGET_LISTE = 420;

type Jeton = { type: string; [cle: string]: unknown };

const enLigne = (s: string) => marked.parseInline(s.trim(), { async: false }) as string;

const brut = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Coupe un paragraphe trop long sur des frontières de phrase. On ne coupe
 * jamais au milieu d'une phrase : une diapositive qui se termine par une
 * subordonnée orpheline se lit comme un bug.
 */
const couperEnPhrases = (t: string): string[] => {
  if (t.length <= SEUIL_TEXTE) return [t];
  const phrases = t.match(/[^.!?…]+[.!?…]*\s*/g) ?? [t];
  const morceaux: string[] = [];
  let courant = "";
  for (const p of phrases) {
    if (courant && (courant + p).length > SEUIL_TEXTE) {
      morceaux.push(courant.trim());
      courant = p;
    } else courant += p;
  }
  if (courant.trim()) morceaux.push(courant.trim());
  return morceaux;
};

/** Découpe une liste selon deux plafonds : le nombre d'items et leur volume. */
const paquets = <T,>(liste: T[], taille: number, budget: number, poids: (x: T) => number): T[][] => {
  const out: T[][] = [];
  let lot: T[] = [];
  let charge = 0;
  for (const x of liste) {
    const p = poids(x);
    // Un lot vide accepte toujours son premier élément, même hors budget :
    // le refuser produirait une diapositive vide et une boucle sans fin.
    if (lot.length && (lot.length >= taille || charge + p > budget)) {
      out.push(lot);
      lot = [];
      charge = 0;
    }
    lot.push(x);
    charge += p;
  }
  if (lot.length) out.push(lot);
  return out.length ? out : [liste];
};

/**
 * `- **300+** — Clients accompagnés` → paire.
 *
 * C'est exactement ce que produit le bloc « Chiffres clés » du constructeur
 * d'articles. La reconnaissance n'est pas une devinette : c'est la lecture
 * inverse d'une écriture que nous maîtrisons.
 */
const MOTIF_PAIRE = /^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/;
const ressembleAUnNombre = (s: string) => s.length <= 12 && /\d/.test(s);

/* =========================================================================
 * COMPOSITION DES DIAPOSITIVES
 * ======================================================================= */

/** Le bandeau commun : libellé de section en haut, porté par le morphing. */
const bandeau = (section: string, theme: Theme, morphId: string): Element[] =>
  section
    ? [
        {
          ...texte({
            x: M,
            y: HAUT,
            l: LARGEUR_UTILE,
            h: 26,
            html: section,
            taille: 15,
            graisse: 800,
            couleur: theme.accents[0],
            majuscules: true,
            interlettre: 0.3,
          }),
          // Identifiant STABLE d'une diapositive à l'autre au sein d'une même
          // section : c'est lui qui fait glisser le libellé au lieu de le faire
          // clignoter. Le mécanisme de morphing de bento, obtenu sans rien
          // déclarer de plus.
          id: `sect_${morphId}`,
        },
      ]
    : [];

const titreDiapo = (contenu: string, theme: Theme, y = HAUT + 52, taille = 42) =>
  texte({
    x: M,
    y,
    l: LARGEUR_UTILE,
    h: Math.round(taille * 2.4),
    html: contenu,
    taille,
    graisse: 800,
    couleur: theme.encre,
    police: "titrage",
    interligne: 1.12,
  });

/**
 * Taille de corps choisie d'après le volume de texte.
 *
 * Sur un canevas de dimensions fixes, une ligne de trop ne rogne pas la mise en
 * page — elle sort du cadre, et on ne s'en aperçoit qu'une fois projeté.
 */
const calibre = (volume: number, paliers: [number, number][]) => {
  for (const [seuil, px] of paliers) if (volume <= seuil) return px;
  return paliers[paliers.length - 1][1];
};

const sansBalises = (html: string) => html.replace(/<[^>]*>/g, "").length;

/* =========================================================================
 * SECTIONS
 * ======================================================================= */

type Section = { titre: string; ancre: string; jetons: Jeton[] };

const decouperEnSections = (jetons: Jeton[]): Section[] => {
  const sections: Section[] = [{ titre: "", ancre: "", jetons: [] }];
  for (const j of jetons) {
    if (j.type === "heading" && (j.depth as number) <= 2) {
      const t = brut(String(j.text ?? ""));
      sections.push({ titre: t, ancre: slugify(t), jetons: [] });
      continue;
    }
    if (j.type === "hr") {
      // Le séparateur ouvre une section sans titre : elle hérite du libellé de
      // la précédente, la respiration n'est pas un changement de sujet.
      const p = sections[sections.length - 1];
      sections.push({ titre: p.titre, ancre: p.ancre, jetons: [] });
      continue;
    }
    if (j.type === "space") continue;
    sections[sections.length - 1].jetons.push(j);
  }
  return sections.filter((s) => s.jetons.length > 0 || s.titre);
};

/* =========================================================================
 * PROJECTION
 * ======================================================================= */

const diapositivesDeSection = (section: Section, numero: number, theme: Theme): Diapositive[] => {
  const sorties: Diapositive[] = [];
  const morphId = section.ancre || `s${numero}`;

  const poser = (elements: Element[], fond = theme.fond, notes = "") =>
    sorties.push({
      ...diapositiveVide(fond),
      elements,
      notes,
      ancre: section.ancre || undefined,
    });

  // Séparateur de partie, sur fond sombre : sans lui, on enchaîne les arguments
  // sans jamais dire de quoi on parle.
  if (section.titre) {
    poser(
      [
        {
          ...texte({
            x: 880,
            y: 130,
            l: 320,
            h: 300,
            html: String(numero).padStart(2, "0"),
            taille: 260,
            graisse: 900,
            couleur: "#FFFFFF",
            aligne: "droite",
            opacite: 0.06,
            police: "titrage",
            interligne: 1,
            verrouille: true,
          }),
        },
        ...signature(M, 300, 40),
        {
          ...titreDiapo(section.titre, { ...theme, encre: "#FFFFFF" }, 340, 60),
          id: `sect_${morphId}`,
        },
      ],
      NUIT
    );
  }

  let coiffe = "";
  const prendreCoiffe = () => {
    const t = coiffe;
    coiffe = "";
    return t;
  };

  for (const j of section.jetons) {
    const source = String(j.raw ?? "");
    const entete = bandeau(section.titre, theme, morphId);

    switch (j.type) {
      case "heading":
        coiffe = brut(String(j.text ?? ""));
        break;

      case "paragraph": {
        const t = String(j.text ?? "").trim();

        // Un paragraphe réduit à un lien est un appel à l'action.
        const seulLien = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (seulLien) {
          poser(
            [
              ...signature(M, 250, 44),
              titreDiapo(brut(seulLien[1]), { ...theme, encre: "#FFFFFF" }, 300, 50),
              forme({ x: M, y: 440, l: 300, h: 62, remplissage: "#FFFFFF", rayon: 999 }),
              texte({
                x: M,
                y: 458,
                l: 300,
                h: 30,
                html: brut(seulLien[1]),
                taille: 19,
                graisse: 800,
                couleur: NUIT,
                aligne: "centre",
              }),
            ],
            NUIT,
            source
          );
          break;
        }

        const coiffeCourante = prendreCoiffe();
        couperEnPhrases(t).forEach((morceau, i) => {
          const html = enLigne(morceau);
          const taille = calibre(sansBalises(html), [
            [110, 40],
            [200, 34],
            [300, 29],
            [Infinity, 25],
          ]);
          poser(
            [
              ...entete.map((e) => ({ ...e, id: e.id })),
              // Le titre ne coiffe que le premier morceau : le répéter donnerait
              // l'impression que la présentation piétine.
              ...(i === 0 && coiffeCourante ? [titreDiapo(coiffeCourante, theme)] : []),
              texte({
                x: M,
                y: coiffeCourante && i === 0 ? 260 : 200,
                l: Math.min(LARGEUR_UTILE, 880),
                h: 300,
                html,
                taille,
                graisse: 400,
                couleur: theme.encre,
                interligne: 1.45,
                opacite: 0.88,
                vertical: "milieu",
              }),
            ],
            theme.fond,
            source
          );
        });
        break;
      }

      case "blockquote": {
        const lignes = brut(String(j.text ?? ""))
          .split(/\s*—\s*/)
          .map((l) => l.trim())
          .filter(Boolean);
        const qui = lignes.length > 1 ? lignes.pop()! : "";
        poser(
          [
            texte({
              x: 60,
              y: 90,
              l: 200,
              h: 220,
              html: "«",
              taille: 220,
              graisse: 900,
              couleur: theme.accents[0],
              opacite: 0.16,
              police: "titrage",
              interligne: 1,
              verrouille: true,
            }),
            texte({
              x: M + 40,
              y: 200,
              l: LARGEUR_UTILE - 80,
              h: 240,
              html: lignes.join(" — "),
              taille: 40,
              graisse: 800,
              couleur: theme.encre,
              police: "titrage",
              interligne: 1.2,
              vertical: "milieu",
            }),
            ...(qui
              ? [
                  forme({ x: M + 40, y: 480, l: 48, h: 3, remplissage: theme.accents[0], rayon: 0 }),
                  texte({
                    x: M + 104,
                    y: 468,
                    l: 500,
                    h: 30,
                    html: qui,
                    taille: 18,
                    graisse: 700,
                    couleur: theme.attenue,
                  }),
                ]
              : []),
          ],
          PAPIER,
          source
        );
        break;
      }

      case "list": {
        const items = ((j.items as Jeton[]) ?? []).map((it) => String(it.text ?? "").trim());
        if (!items.length) break;
        const paires = items.map((t) => t.match(MOTIF_PAIRE));
        const toutesPaires = paires.every(Boolean);
        const coiffeCourante = prendreCoiffe();

        // Chiffres clés : `- **300+** — Clients`.
        if (toutesPaires && !j.ordered && paires.every((m) => ressembleAUnNombre(m![1]))) {
          const valeurs = paires.map((m) => ({ n: brut(m![1]), l: brut(m![2]) }));
          paquets(valeurs, 3, 999, () => 1).forEach((lot, k) => {
            const l = (LARGEUR_UTILE - (lot.length - 1) * 28) / lot.length;
            const tuiles: Element[] = [];
            lot.forEach((v, i) => {
              const x = M + i * (l + 28);
              tuiles.push(
                forme({ x, y: 250, l, h: 220, remplissage: PAPIER, rayon: 24, etape: i }),
                texte({
                  x: x + 26,
                  y: 288,
                  l: l - 52,
                  h: 84,
                  html: v.n,
                  taille: 62,
                  graisse: 900,
                  couleur: theme.accents[i % 3],
                  police: "titrage",
                  interligne: 1,
                  etape: i,
                }),
                texte({
                  x: x + 26,
                  y: 382,
                  l: l - 52,
                  h: 66,
                  html: v.l,
                  taille: 15,
                  graisse: 700,
                  couleur: theme.attenue,
                  majuscules: true,
                  interlettre: 0.1,
                  interligne: 1.4,
                  etape: i,
                })
              );
            });
            poser(
              [
                ...entete,
                ...(k === 0 && coiffeCourante ? [titreDiapo(coiffeCourante, theme)] : []),
                ...tuiles,
              ],
              theme.fond,
              source
            );
          });
          break;
        }

        // Étapes numérotées : `1. **Auditer** — On part du terrain.`
        if (toutesPaires && j.ordered) {
          const etapes = paires.map((m) => ({ a: brut(m![1]), b: brut(m![2]) }));
          paquets(etapes, 4, BUDGET_LISTE, (e) => e.a.length + e.b.length).forEach((lot, k) => {
            const els: Element[] = [];
            lot.forEach((e, i) => {
              const y = 230 + i * 92;
              els.push(
                forme({
                  x: M,
                  y,
                  l: 54,
                  h: 54,
                  forme: "ellipse",
                  remplissage: theme.accents[0],
                  etape: i,
                }),
                texte({
                  x: M,
                  y: y + 14,
                  l: 54,
                  h: 28,
                  html: String(k * 4 + i + 1),
                  taille: 22,
                  graisse: 900,
                  couleur: "#FFFFFF",
                  aligne: "centre",
                  etape: i,
                }),
                texte({
                  x: M + 78,
                  y: y + 2,
                  l: LARGEUR_UTILE - 78,
                  h: 34,
                  html: e.a,
                  taille: 25,
                  graisse: 800,
                  couleur: theme.encre,
                  etape: i,
                }),
                texte({
                  x: M + 78,
                  y: y + 38,
                  l: LARGEUR_UTILE - 78,
                  h: 44,
                  html: e.b,
                  taille: 19,
                  couleur: theme.attenue,
                  interligne: 1.35,
                  etape: i,
                })
              );
            });
            poser(
              [...entete, ...(k === 0 && coiffeCourante ? [titreDiapo(coiffeCourante, theme)] : []), ...els],
              theme.fond,
              source
            );
          });
          break;
        }

        // Liste ordinaire, dévoilée point par point.
        paquets(items, MAX_POINTS, BUDGET_LISTE, (x) => x.length).forEach((lot, k) => {
          const els: Element[] = [];
          const taille = calibre(
            lot.reduce((n, x) => n + x.length, 0),
            [
              [150, 30],
              [280, 26],
              [400, 23],
              [Infinity, 20],
            ]
          );
          lot.forEach((p, i) => {
            els.push(
              // Un seul élément par point : la puce est une propriété du texte,
              // pas un cercle posé à côté. On déplace le point, il emmène sa
              // puce — et la conversion en article sait qu'il s'agit d'une
              // liste.
              texte({
                x: M,
                y: 236 + i * Math.round(taille * 2.3),
                l: LARGEUR_UTILE,
                h: Math.round(taille * 2.2),
                html: enLigne(p),
                taille,
                couleur: theme.encre,
                interligne: 1.35,
                opacite: 0.88,
                puce: true,
                etape: i,
              })
            );
          });
          poser(
            [
              ...entete,
              ...(coiffeCourante
                ? [titreDiapo(k === 0 ? coiffeCourante : `${coiffeCourante} (suite)`, theme)]
                : []),
              ...els,
            ],
            theme.fond,
            source
          );
        });
        break;
      }

      case "table": {
        const entetes = ((j.header as Jeton[]) ?? []).map((c) => brut(String(c.text ?? "")));
        const lignes = ((j.rows as Jeton[][]) ?? []).map((r) => r.map((c) => brut(String(c.text ?? ""))));
        if (!entetes.length) break;
        const coiffeCourante = prendreCoiffe();

        // Un tableau de deux colonnes dont la seconde est numérique se lit mieux
        // en graphique. Au-delà, on garde le tableau : transformer six colonnes
        // en courbe perdrait l'information au lieu de l'éclairer.
        const numerique =
          entetes.length === 2 && lignes.length >= 2 && lignes.every((l) => /^-?[\d\s.,]+$/.test(l[1] ?? ""));

        poser(
          [
            ...entete,
            ...(coiffeCourante ? [titreDiapo(coiffeCourante, theme)] : []),
            numerique
              ? graphique({
                  x: M,
                  y: 230,
                  l: LARGEUR_UTILE,
                  h: 340,
                  couleur: theme.accents[0],
                  serie: lignes.map((l) => ({
                    etiquette: l[0] ?? "",
                    valeur: Number((l[1] ?? "0").replace(",", ".").replace(/\s/g, "")) || 0,
                  })),
                })
              : tableau({
                  x: M,
                  y: 230,
                  l: LARGEUR_UTILE,
                  h: Math.min(360, 60 + lignes.length * 54),
                  colonnes: entetes.map(() => ({ p: 1 })),
                  lignes: [entetes, ...lignes].map((r) => r.map((c) => cellule(c))),
                  style: { ...STYLE_TABLEAU, couleurEntete: theme.accents[0] },
                }),
          ],
          theme.fond,
          source
        );
        break;
      }

      default:
        break;
    }
  }

  if (coiffe) {
    poser([...bandeau(section.titre, theme, morphId), titreDiapo(coiffe, theme, HAUT + 120, 46)]);
  }

  return sorties;
};

/** Ce que l'appelant doit fournir pour obtenir une présentation. */
export type SourceArticle = {
  slug?: string;
  titre?: string;
  chapeau?: string;
  categorie?: string;
  auteur?: string;
  publie_le?: string;
  corps: string;
  /** Couleur de pôle de l'article, promue en premier accent du document. */
  accent?: "office" | "digital" | "service";
};

const ACCENT_VERS_COULEUR = { office: "#3B82F6", digital: "#EC4899", service: "#22C55E" };

/**
 * La présentation dérivée d'un article.
 *
 * Enveloppée dans `avecIdentifiantsStables` : produite au build et déposée dans
 * la page, elle doit être identique d'une construction à l'autre. Sans cela,
 * chaque build modifiait les cinq pages d'articles sans qu'aucun contenu ne
 * change.
 */
export const documentDepuisArticle = (source: SourceArticle): Document =>
  avecIdentifiantsStables(() => construireDocument(source));

const construireDocument = (source: SourceArticle): Document => {
  // L'accent de l'article passe en tête de palette : la présentation porte la
  // couleur du pôle traité, comme la couverture de l'article.
  const tete = ACCENT_VERS_COULEUR[source.accent ?? "office"];
  const theme: Theme = {
    ...THEME_MEGASOFT,
    accents: [tete, ...THEME_MEGASOFT.accents.filter((c) => c !== tete)] as Theme["accents"],
  };

  const jetons = marked.lexer(source.corps ?? "") as unknown as Jeton[];
  const sections = decouperEnSections(jetons);

  const ouverture: Diapositive = {
    ...diapositiveVide(theme.fond),
    elements: [
      ...signature(M, 226, 44),
      texte({
        x: M,
        y: 268,
        l: LARGEUR_UTILE,
        h: 26,
        html: source.categorie ?? "",
        taille: 15,
        graisse: 800,
        couleur: theme.accents[0],
        majuscules: true,
        interlettre: 0.3,
      }),
      titreDiapo(source.titre ?? "", theme, 306, 58),
      texte({
        x: M,
        y: 470,
        l: 820,
        h: 90,
        html: source.chapeau ?? "",
        taille: 23,
        couleur: theme.attenue,
        interligne: 1.5,
      }),
      texte({
        x: M,
        y: 596,
        l: 820,
        h: 26,
        html: [source.auteur, source.publie_le].filter(Boolean).join(" · "),
        taille: 14,
        graisse: 700,
        couleur: theme.attenue,
        majuscules: true,
        interlettre: 0.2,
        opacite: 0.7,
      }),
    ],
    notes: "",
  };

  const diapositives = [ouverture];
  // Les sections sans titre — l'introduction, les respirations après `---` — ne
  // consomment pas de numéro : numéroter l'introduction « 01 » décalerait tout
  // le reste par rapport au sommaire de l'article.
  let numero = 0;
  for (const s of sections) {
    if (s.titre) numero += 1;
    diapositives.push(...diapositivesDeSection(s, numero, theme));
  }

  /*
   * DEUX VALEURS DÉTERMINISTES, ET C'EST VOULU.
   *
   * Cette présentation est produite AU BUILD, puis déposée dans la page de
   * l'article. Avec `identifiant("doc")` — qui tire au sort — et l'heure
   * courante, deux constructions du même article donnaient deux pages
   * différentes, alors que rien n'avait changé.
   *
   * Ce n'était pas visible : le texte et le poids restaient identiques, seuls
   * quelques caractères au milieu d'un bloc JSON changeaient. Mais un build non
   * reproductible empêche de répondre à la seule question qui compte pendant
   * une migration de contenu : « est-ce que ma modification a changé autre
   * chose que ce que je voulais ? »
   *
   * L'identifiant vient donc du slug, qui est unique et stable. Les dates
   * viennent de l'article — une présentation dérivée d'un article a d'ailleurs
   * l'âge de cet article, pas celui de la dernière construction du site.
   *
   * `identifiant("doc")` reste aléatoire pour les présentations créées à la
   * main dans le panel : elles n'ont, elles, aucune source dont hériter.
   */
  const dateArticle = source.publie_le ?? new Date().toISOString().slice(0, 10);
  const maintenant = `${dateArticle}T00:00:00.000Z`;

  return {
    version: 3,
    id: `doc_${source.slug}`,
    titre: source.titre ?? "Présentation",
    format: "16:9",
    theme,
    diapositives,
    meta: {
      auteur: source.auteur ?? "Megasoft Office",
      cree_le: maintenant,
      maj_le: maintenant,
      slug: source.slug,
      categorie: source.categorie,
      article: source.slug,
    },
  };
};

/* =========================================================================
 * TRANSPORT
 * ======================================================================= */

/** Identifiant du bloc JSON déposé dans la page d'article. */
export const ID_DECK = "ms-deck";

/**
 * Sérialise pour insertion dans un `<script type="application/json">`.
 *
 * `<` est échappé : une chaîne contenant `</script>` refermerait la balise et le
 * reste serait interprété comme du HTML. C'est la faille classique des données
 * embarquées, et elle se déclenche sur un article parfaitement légitime qui
 * parlerait de balises.
 */
export const serialiser = (doc: Document) => JSON.stringify(doc).replace(/</g, "\\u003c");

/** Relit le document déposé dans la page. `null` si la page n'en a pas. */
export const lireDepuisPage = (hote: globalThis.Document = document): Document | null => {
  const noeud = hote.getElementById(ID_DECK);
  if (!noeud?.textContent) return null;
  try {
    return JSON.parse(noeud.textContent) as Document;
  } catch {
    return null;
  }
};
