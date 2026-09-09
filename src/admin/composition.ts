import { type Bloc } from "@/blocs/types";
import { slugDepuisTitre, type Brouillon } from "./brouillon";

/**
 * ---------------------------------------------------------------------------
 * COMPOSITION → ARTICLE
 * ---------------------------------------------------------------------------
 *
 * Le constructeur assemble des blocs ; le blog, lui, ne connaît que des
 * fichiers Markdown. Sans cette traduction, une composition ne pouvait aller
 * nulle part : on la voyait à l'écran, et c'était tout.
 *
 * Le sens de la conversion n'est pas neutre. On ne sérialise PAS les blocs tels
 * quels dans un format maison : le corps produit est du Markdown ordinaire, que
 * l'on peut relire, corriger à la main dans l'éditeur, comparer d'une version à
 * l'autre, et qui survivrait au constructeur lui-même s'il disparaissait. Un
 * article ne doit jamais dépendre de l'outil qui l'a écrit.
 *
 * En contrepartie, la conversion est à SENS UNIQUE : reprendre un article dans
 * le constructeur ne reconstitue pas les blocs d'origine. C'est assumé — le
 * texte est ce qui compte et se retravaille dans l'éditeur Markdown, la
 * composition n'est qu'une manière commode de le produire.
 */

/**
 * Emplacement de la composition en cours. Déclaré ici, et non dans le
 * constructeur, pour que la liste des articles puisse la remettre à zéro sans
 * avoir à charger tout l'éditeur visuel — plusieurs centaines de kilooctets
 * qu'on ne veut pas tirer dans l'écran d'accueil.
 */
export const CLE_COMPOSITION = "ms-admin-composition";

/** Repart d'une page vierge à la prochaine ouverture du constructeur. */
export const reinitialiserComposition = () => {
  try {
    localStorage.removeItem(CLE_COMPOSITION);
  } catch {
    /* stockage indisponible — le constructeur repartira de son état par défaut */
  }
};

const t = (b: Bloc, cle: string, defaut = "") => ((b.donnees[cle] as string) ?? defaut).trim();
const l = (b: Bloc, cle: string) => ((b.donnees[cle] as string[]) ?? []).filter(Boolean);
const paires = (b: Bloc, cle: string) => (b.donnees[cle] as { a: string; b: string }[]) ?? [];

/** Traduit un bloc en Markdown. Retourne une chaîne vide si le bloc est muet. */
const bloc = (b: Bloc): string => {
  switch (b.type) {
    case "accroche":
      // Une accroche au fil du texte devient un intertitre : la première est
      // consommée comme titre de l'article, en amont.
      return [t(b, "titre") && `## ${t(b, "titre")}`, t(b, "chapeau")].filter(Boolean).join("\n\n");

    case "texte":
      return t(b, "texte");

    case "citation": {
      const qui = [t(b, "auteur"), t(b, "role")].filter(Boolean).join(", ");
      return [`> ${t(b, "texte")}`, qui && `>\n> — ${qui}`].filter(Boolean).join("\n");
    }

    case "chiffre":
      return l(b, "valeurs")
        .map((v) => {
          const [nombre = "", legende = ""] = v.split("|");
          return `- **${nombre.trim()}** — ${legende.trim()}`;
        })
        .join("\n");

    case "retenir": {
      const points = l(b, "points").map((p) => `- ${p}`);
      if (!points.length) return "";
      return [`### ${t(b, "titre", "À retenir")}`, points.join("\n")].join("\n\n");
    }

    case "action": {
      const lien = t(b, "lien", "/#contact");
      const libelle = t(b, "libelle", "Nous contacter");
      return [t(b, "titre") && `### ${t(b, "titre")}`, t(b, "texte"), `[${libelle}](${lien})`]
        .filter(Boolean)
        .join("\n\n");
    }

    case "etapes":
      return paires(b, "etapes")
        .filter((e) => e.a?.trim() || e.b?.trim())
        .map((e, i) => `${i + 1}. **${(e.a ?? "").trim()}** — ${(e.b ?? "").trim()}`)
        .join("\n");

    case "comparatif": {
      const a = l(b, "colonneA");
      const bb = l(b, "colonneB");
      if (!a.length && !bb.length) return "";
      // Tableau Markdown : les deux colonnes se lisent côte à côte, exactement
      // comme le bloc les montre à l'écran.
      const lignes = Array.from({ length: Math.max(a.length, bb.length) }, (_, i) => {
        return `| ${a[i] ?? ""} | ${bb[i] ?? ""} |`;
      });
      return [
        `| ${t(b, "titreA", "Sans")} | ${t(b, "titreB", "Avec")} |`,
        "| --- | --- |",
        ...lignes,
      ].join("\n");
    }

    case "liste":
      return l(b, "points")
        .map((p) => `- ${p}`)
        .join("\n");

    case "separateur":
      return "---";

    default:
      return "";
  }
};

/**
 * Corps Markdown d'une composition. Les calques masqués en sont exclus : ce
 * qui n'est pas dans la page à l'écran ne doit pas se retrouver dans l'article.
 */
export const versCorps = (blocs: Bloc[], sauterPremiereAccroche = true): string => {
  let accrocheVue = !sauterPremiereAccroche;
  return blocs
    .filter((b) => !b.masque)
    .filter((b) => {
      if (b.type !== "accroche") return true;
      if (accrocheVue) return true;
      accrocheVue = true;
      return false;
    })
    .map(bloc)
    .filter((m) => m.trim())
    .join("\n\n")
    .trim();
};

/** Ce que la composition dit d'elle-même : titre, chapeau, rubrique, couleur. */
export const enTete = (blocs: Bloc[]) => {
  const a = blocs.find((b) => !b.masque && b.type === "accroche");
  return {
    titre: a ? t(a, "titre") : "",
    chapeau: a ? t(a, "chapeau") : "",
    categorie: a ? t(a, "surtitre") : "",
    accent: a?.style.accent,
  };
};

/**
 * Fabrique le brouillon correspondant à la composition, en conservant ce que
 * l'article portait déjà (référencement, questions fréquentes, auteur) : on
 * enregistre une nouvelle version d'un article, pas un article neuf amputé de
 * ses métadonnées.
 */
export const versBrouillon = (blocs: Bloc[], base: Brouillon): Brouillon => {
  const e = enTete(blocs);
  const titre = e.titre || base.titre;
  return {
    ...base,
    titre,
    slug: base.slug || slugDepuisTitre(titre),
    chapeau: e.chapeau || base.chapeau,
    categorie: e.categorie || base.categorie,
    accent: e.accent ?? base.accent,
    corps: versCorps(blocs),
  };
};
