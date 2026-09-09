import { articles } from "./depot";
import { serveurConfigure } from "./serveur/client";
import { publications } from "./serveur/depotHttp";
import { ErreurApi } from "./serveur/contrat";
import { controler, type Brouillon } from "./brouillon";

/**
 * ---------------------------------------------------------------------------
 * PUBLIER UN ARTICLE — LE SEUL CHEMIN
 * ---------------------------------------------------------------------------
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * Un article peut naître de TROIS écrans, et c'est voulu :
 *
 *   · l'Éditeur          — Markdown, le cas courant ;
 *   · le Constructeur    — blocs assemblés à la souris ;
 *   · les Présentations  — un jeu de diapositives converti en article.
 *
 * Les trois écrivaient chacun leur publication, chacun à leur façon :
 *
 *     articles.enregistrer({ ...projet, statut: "publie" }, acteur);
 *     setMessage("Publié");
 *
 * Trois défauts, présents aux trois endroits :
 *
 *   1. la promesse n'était ni attendue ni capturée : le message de succès
 *      s'affichait AVANT la réponse du serveur, et restait affiché même après
 *      un refus ;
 *   2. seul l'Éditeur vérifiait les contrôles bloquants. Publier depuis la
 *      liste des articles ou depuis une présentation les contournait ;
 *   3. la date de parution n'était vérifiée nulle part, alors que le serveur
 *      la refuse — « Un article publié ou programmé doit avoir une date de
 *      parution. » Le refus arrivait en 400, sans que l'écran change.
 *
 * Le constat vient d'un test réel : cinq enregistrements dans le journal,
 * aucune publication, un article resté brouillon, et un bouton qui affichait
 * « Publié ».
 *
 * CE QUE CE MODULE GARANTIT
 * -------------------------
 * Un seul point de passage, qui rend un RÉSULTAT plutôt que de laisser
 * l'appelant supposer. Tant qu'il renvoie `ok: false`, rien n'a été publié —
 * et le message dit pourquoi, dans les mots de la personne qui a cliqué.
 */

export type Resultat =
  /*
   * POURQUOI LE SUCCÈS DÉCLARE DES CHAMPS QU'IL N'A PAS
   *
   * `message?: undefined` n'ajoute rien à l'exécution : un succès ne porte
   * jamais ces champs. C'est une concession au réglage du projet — le site est
   * compilé avec `strict: false`, et TypeScript n'y restreint pas une union sur
   * un discriminant BOOLÉEN. Un `if (!r.ok) { … r.message }` parfaitement
   * correct était donc signalé en erreur, quatorze fois.
   *
   * Deux issues : passer le projet en `strict` — des centaines d'erreurs à
   * traiter, à trois jours d'une mise en ligne — ou déclarer ces deux champs
   * absents. La seconde ne change pas une ligne de comportement.
   */
  | {
      ok: true;
      statut: Brouillon["statut"];
      message?: undefined;
      bloquants?: undefined;
      conflit?: undefined;
    }
  /**
   * `bloquants` est renseigné quand l'article lui-même n'est pas prêt — la
   * vue peut alors les énumérer. `message` seul signale un refus du serveur.
   */
  | {
      ok: false;
      message: string;
      bloquants?: string[];
      /**
       * La version que le SERVEUR détient, quand l'écriture a été refusée pour
       * cause de modification concurrente (409).
       *
       * Sans elle, le message « quelqu'un a modifié entre-temps » laisse la
       * personne devant un mur : elle ne sait ni ce qui a changé, ni comment
       * s'en sortir sans perdre son travail. Avec elle, le panel peut montrer
       * les deux versions et laisser choisir — voir `Conflit.tsx`.
       */
      conflit?: unknown;
    };

/**
 * Ce que le serveur exige en plus des contrôles rédactionnels.
 *
 * Volontairement limité à ce qui provoquerait un refus : dupliquer ici toute
 * la validation du serveur créerait deux vérités à maintenir, et c'est
 * exactement ce qui a produit le défaut de la section « sections libres »,
 * publiée par le panel puis refusée par la construction.
 */
const manquesTechniques = (b: Brouillon): string[] => {
  const manques: string[] = [];
  if (!b.publie_le) {
    manques.push("Date de parution — un article publié ou programmé doit être daté.");
  }
  return manques;
};

/**
 * La version distante jointe à un refus 409, s'il y en a une.
 *
 * Le serveur la renvoie dans le corps de l'erreur : c'est ce qui permet de
 * montrer les deux versions au lieu d'annoncer un échec sans issue.
 */
const versionDistante = (e: unknown): unknown =>
  e instanceof ErreurApi && e.code === "conflit" ? e.distant : undefined;

/**
 * DEMANDE LA RECONSTRUCTION DU SITE, et ne la laisse jamais silencieuse.
 *
 * Le défaut le plus visible du 6 septembre 2026 : publier écrivait bien
 * « publié » en base, mais personne ne demandait au serveur de reconstruire.
 * L'article apparaissait dans le panel avec le bon statut, et le blog restait
 * figé sur ses cinq articles — sans erreur, sans message, sans rien.
 *
 * Un échec ici n'annule PAS la publication : l'article est publié, c'est acquis.
 * Mais il doit se voir, sinon on retombe exactement dans le défaut qu'on répare.
 *
 * Sans serveur (mode local), il n'y a pas de reconstruction à demander : les
 * fichiers du dépôt sont la source, et le site se reconstruit à la main.
 */
const reconstruire = async (): Promise<string | null> => {
  if (!serveurConfigure) return null;
  try {
    await publications.demander();
    return null;
  } catch (e) {
    return e instanceof Error
      ? `L'article est publié, mais la reconstruction du site n'a pas pu être lancée : ${e.message}`
      : "L'article est publié, mais la reconstruction du site n'a pas pu être lancée.";
  }
};

/** Traduit un échec quelconque en une phrase affichable. */
const enMessage = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) {
    const m = String((e as { message: unknown }).message);
    if (m.trim()) return m;
  }
  return "Le serveur n'a pas accepté l'enregistrement. Réessayez dans un instant.";
};

/**
 * Met l'article de côté. Toujours permis, même incomplet : c'est précisément à
 * quoi sert un brouillon.
 */
export const enregistrerBrouillon = async (
  b: Brouillon,
  acteur: string
): Promise<Resultat> => {
  if (!b.titre.trim() || !b.slug.trim()) {
    return {
      ok: false,
      message: "Un titre et une adresse suffisent, mais ils sont obligatoires.",
      bloquants: [
        ...(b.titre.trim() ? [] : ["Titre"]),
        ...(b.slug.trim() ? [] : ["Adresse de page"]),
      ],
    };
  }

  try {
    await articles.enregistrer({ ...b, statut: "brouillon" }, acteur);
    return { ok: true, statut: "brouillon" };
  } catch (e) {
    return { ok: false, message: enMessage(e), conflit: versionDistante(e) };
  }
};

/**
 * Publie — ou refuse, en disant quoi corriger.
 *
 * `statut` accepte aussi « programme » : un article daté dans le futur suit
 * exactement le même chemin, seule la date change.
 */
export const publierArticle = async (
  b: Brouillon,
  acteur: string,
  statut: "publie" | "programme" = "publie"
): Promise<Resultat> => {
  const bloquants = [
    ...controler(b)
      .filter((c) => c.bloquant && !c.ok)
      .map((c) => c.libelle),
    ...manquesTechniques(b),
  ];

  if (bloquants.length > 0) {
    return {
      ok: false,
      bloquants,
      message:
        bloquants.length === 1
          ? "Un point reste à corriger avant de publier."
          : `${bloquants.length} points restent à corriger avant de publier.`,
    };
  }

  try {
    await articles.enregistrer({ ...b, statut }, acteur);

    /*
     * Un article PROGRAMMÉ ne change rien pour le visiteur aujourd'hui : sa
     * date n'est pas venue. C'est la tâche `parutions` qui reconstruira le jour
     * dit. Reconstruire maintenant coûterait une construction pour rien.
     */
    if (statut === "publie") {
      const souci = await reconstruire();
      if (souci) return { ok: false, message: souci };
    }

    return { ok: true, statut };
  } catch (e) {
    return { ok: false, message: enMessage(e), conflit: versionDistante(e) };
  }
};

/** Retire l'article du site. Aucun contrôle : dépublier doit toujours marcher. */
export const depublierArticle = async (
  b: Brouillon,
  acteur: string
): Promise<Resultat> => {
  try {
    await articles.enregistrer({ ...b, statut: "brouillon" }, acteur);

    /* Retirer un article du site le change autant que l'y mettre : sans
       reconstruction, la page reste en ligne alors que le panel affiche
       « brouillon ». */
    const souci = await reconstruire();
    if (souci) {
      return {
        ok: false,
        message: souci.replace("L'article est publié", "L'article est retiré"),
      };
    }

    return { ok: true, statut: "brouillon" };
  } catch (e) {
    return { ok: false, message: enMessage(e), conflit: versionDistante(e) };
  }
};
