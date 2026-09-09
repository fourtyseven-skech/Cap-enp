import type { CompteCree } from "../depot";
import { notifier } from "../abonnes";
import type { Brouillon } from "../brouillon";
import type {
  Action,
  ArticleLocal,
  Entree,
  Redirection,
  Role,
  Utilisateur,
  Version,
} from "../depot";
import { ErreurApi } from "./contrat";
import type { ArticleDistant } from "./contrat";
import * as api from "./depotHttp";

/**
 * ---------------------------------------------------------------------------
 * L'ADAPTATEUR SERVEUR
 * ---------------------------------------------------------------------------
 *
 * Expose EXACTEMENT la même forme que les dépôts locaux de `depot.ts`, mais
 * adossée au serveur. C'est ce qui permet à `depot.ts` de choisir l'un ou
 * l'autre à l'export, sans qu'aucune vue ne change d'une ligne.
 *
 * LE PROBLÈME QUE CE FICHIER RÉSOUT
 * ---------------------------------
 * Les vues lisent de façon SYNCHRONE : `articles.lister()` renvoie un tableau,
 * qui part directement dans le rendu. Un serveur, lui, répond de façon
 * asynchrone. Rendre les vues asynchrones aurait voulu dire réécrire
 * `Articles.tsx`, `Medias.tsx`, `Outils.tsx` et `Journal.tsx` — près de deux
 * mille lignes, pour un gain nul côté utilisateur.
 *
 * On garde donc la lecture synchrone, servie par un CACHE en mémoire :
 *
 *   · `demarrer()` remplit le cache au chargement du panel ;
 *   · les lectures répondent depuis le cache, instantanément ;
 *   · les écritures partent au serveur, puis mettent le cache à jour et
 *     appellent `notifier()`, ce qui redessine les vues abonnées.
 *
 * C'est le fonctionnement habituel d'une interface d'administration : on
 * n'attend pas le réseau pour afficher une liste déjà connue.
 *
 * CE QUI EN DÉCOULE, ET QU'IL FAUT ASSUMER
 * ----------------------------------------
 * Une écriture peut échouer APRÈS que la vue a rendu la main. Les erreurs
 * partent donc dans le canal `surErreur` ci-dessous, que le panel affiche en
 * bandeau.
 *
 * ⚠️ CE CANAL NE SUFFIT PAS, et une session de test l'a prouvé.
 *
 * `ecrire` se contentait autrefois de signaler l'échec : la promesse rendue à
 * l'appelant se résolvait quand même. Une vue qui écrivait
 *
 *     articles.enregistrer({ ...article, statut: "publie" }, acteur);
 *     setEnregistre("publie");            // « Publié »
 *
 * affichait donc « Publié » alors que le serveur venait de refuser. L'article
 * restait brouillon, le journal n'enregistrait aucune publication, et personne
 * ne pouvait le deviner depuis l'écran.
 *
 * `ecrire` RELANCE désormais l'erreur après l'avoir signalée. Le bandeau reste
 * — il rattrape les écritures d'arrière-plan — mais toute vue qui annonce un
 * résultat doit maintenant attendre la promesse et traiter son échec.
 */

/* ========================================================================= */
/* Canal d'erreurs                                                           */
/* ========================================================================= */

const ecouteursErreur = new Set<(e: ErreurApi) => void>();

/** S'abonner aux échecs d'écriture. Renvoie la fonction de désabonnement. */
export const surErreur = (f: (e: ErreurApi) => void) => {
  ecouteursErreur.add(f);
  return () => {
    ecouteursErreur.delete(f);
  };
};

const signaler = (e: unknown) => {
  const erreur =
    e instanceof ErreurApi
      ? e
      : new ErreurApi("erreur_serveur", "Une erreur inattendue est survenue.");
  // Trace systématique : le canal n'a pas forcément d'abonné au moment de
  // l'échec (panel en cours de montage, onglet changé), et une erreur perdue
  // est une modification perdue sans témoin.
  console.error("[panel] écriture refusée :", erreur.code, erreur.message);
  ecouteursErreur.forEach((f) => f(erreur));
};

/**
 * Exécute une écriture, rafraîchit le cache, signale l'échec — puis le RELANCE.
 *
 * Les trois gestes comptent, et dans cet ordre :
 *   · signaler alimente le bandeau du panel, y compris quand l'appelant a déjà
 *     rendu la main ;
 *   · resynchroniser efface du cache la valeur que le serveur a refusée —
 *     laisser l'écran afficher une modification inexistante serait pire que de
 *     la voir revenir en arrière ;
 *   · relancer rend l'échec visible à l'appelant, qui seul sait quoi en dire à
 *     l'endroit où l'on a cliqué.
 */
const ecrire = async (action: () => Promise<unknown>, apres: () => Promise<void>) => {
  try {
    await action();
    await apres();
    notifier();
  } catch (e) {
    signaler(e);
    await apres().catch(() => undefined);
    notifier();
    throw e instanceof ErreurApi
      ? e
      : new ErreurApi("erreur_serveur", "Une erreur inattendue est survenue.");
  }
};

/* ========================================================================= */
/* Cache                                                                     */
/* ========================================================================= */

type Cache = {
  articles: ArticleLocal[];
  corbeille: ArticleLocal[];
  journal: Entree[];
  utilisateurs: Utilisateur[];
  redirections: Redirection[];
  versions: Record<string, Version[]>;
  /** Le cache a-t-il été rempli au moins une fois ? */
  pret: boolean;
};

const cache: Cache = {
  articles: [],
  corbeille: [],
  journal: [],
  utilisateurs: [],
  redirections: [],
  versions: {},
  pret: false,
};

/** Le panel a-t-il fini de charger les données du serveur ? */
export const cachePret = () => cache.pret;

/* ------------------------------------------------------------ conversions */

/**
 * Article du serveur → article du panel.
 *
 * `origine: "panel"` : côté serveur, la distinction fichier/panel n'a plus de
 * sens — tous les articles vivent en base. Le champ reste pour ne pas rompre
 * les vues qui l'affichent, avec la seule valeur qui soit vraie.
 */
const versLocal = (a: ArticleDistant): ArticleLocal => ({
  titre: a.titre,
  slug: a.slug,
  chapeau: a.chapeau,
  corps: a.corps,
  categorie: a.categorie,
  format: a.format,
  accent: a.accent,
  motif: a.motif,
  titre_fantome: a.titre_fantome,
  reponse: a.reponse,
  version: a.version,
  exergue: a.exergue,
  meta_description: a.meta_description,
  etiquettes: a.etiquettes,
  auteur: a.auteur,
  faq: a.faq,
  publie_le: a.publie_le,
  statut: a.statut,
  origine: "panel",
  maj_le: a.maj_le,
  archive: a.archive,
  supprime: a.supprime,
  maquette: a.maquette,
  image: a.image ?? "",
});

/**
 * L'étiquette de version d'un article.
 *
 * Le contrat (§ 6) fixe l'`ETag` à la valeur de `maj_le`. On la dérive donc du
 * cache plutôt que de la conserver à part : deux sources pour la même donnée
 * finissent toujours par diverger.
 */
const etiquette = (slug: string): string =>
  cache.articles.find((a) => a.slug === slug)?.maj_le ??
  cache.corbeille.find((a) => a.slug === slug)?.maj_le ??
  "";

/* ---------------------------------------------------------- rafraîchissement */

/**
 * Relit les articles depuis le serveur.
 *
 * Exporté pour un cas précis : après un refus pour modification concurrente
 * (409), l'étiquette de version que ce cache détient est périmée. La relire
 * est ce qui permet de réenregistrer PAR-DESSUS, quand la personne a
 * explicitement choisi de garder sa version — voir `Conflit.tsx`.
 *
 * Ce n'est donc pas un contournement du contrôle de concurrence : le contrôle
 * a joué, la question a été posée, et la réponse est assumée.
 */
export const resynchroniserArticles = async () => rafraichirArticles();

const rafraichirArticles = async () => {
  const [actifs, jetes] = await Promise.all([
    api.articles.lister(),
    api.articles.lister({ corbeille: true }),
  ]);
  cache.articles = actifs.map(versLocal);
  cache.corbeille = jetes.map(versLocal);
};

const rafraichirJournal = async () => {
  cache.journal = await api.journal.lister();
};

const rafraichirUtilisateurs = async () => {
  cache.utilisateurs = (await api.utilisateurs.lister()).map((u) => ({
    id: u.id,
    nom: u.nom,
    email: u.email,
    role: u.role,
    actif: u.actif,
  }));
};

/**
 * Remplit le cache. À appeler une fois, au montage du panel.
 *
 * Les trois chargements partent ensemble : ils ne dépendent pas les uns des
 * autres, et les enchaîner ferait attendre l'éditeur pour rien.
 *
 * Un échec n'interrompt pas le démarrage. Le panel s'ouvre avec des listes
 * vides et le message d'erreur affiché — préférable à un écran bloqué qui ne
 * dit pas ce qui se passe.
 */
export const demarrer = async (): Promise<void> => {
  try {
    await Promise.all([
      rafraichirArticles(),
      rafraichirJournal(),
      rafraichirUtilisateurs(),
    ]);
  } catch (e) {
    signaler(e);
  } finally {
    cache.pret = true;
    notifier();
  }
};

/* ========================================================================= */
/* Articles                                                                  */
/* ========================================================================= */

export const articles = {
  lister: (): ArticleLocal[] => cache.articles,

  corbeille: (): ArticleLocal[] => cache.corbeille,

  obtenir: (slug: string): ArticleLocal | undefined =>
    cache.articles.find((a) => a.slug === slug),

  /**
   * Le paramètre `acteur` n'est plus utilisé : côté serveur, l'auteur d'une
   * action est déduit de la session, jamais de ce que le navigateur annonce.
   * Il reste dans la signature pour que les vues n'aient pas à changer — et
   * c'est précisément le genre de valeur qu'il ne faut pas croire.
   */
  enregistrer: (b: Brouillon, _acteur: string): Promise<void> =>
    ecrire(async () => {
      const connu = cache.articles.some((a) => a.slug === b.slug);
      if (connu) await api.articles.enregistrer(b, etiquette(b.slug));
      else await api.articles.creer(b);
    }, rafraichirArticles),

  archiver: (slug: string, _acteur: string): Promise<void> =>
    ecrire(() => api.articles.archiver(slug), rafraichirArticles),

  jeter: (slug: string, _acteur: string): Promise<void> =>
    ecrire(() => api.articles.jeter(slug), rafraichirArticles),

  restaurer: (slug: string, _acteur: string): Promise<void> =>
    ecrire(() => api.articles.restaurer(slug), rafraichirArticles),
};

/* ========================================================================= */
/* Versions                                                                  */
/* ========================================================================= */

export const versions = {
  /**
   * Lecture synchrone depuis le cache, comme le reste. Un article dont
   * l'historique n'a pas encore été chargé renvoie une liste vide, et le
   * chargement est déclenché en arrière-plan : la vue se redessinera quand il
   * arrivera.
   */
  lister: (slug: string): Version[] => {
    if (!cache.versions[slug]) {
      cache.versions[slug] = [];
      api.articles
        .versions(slug)
        .then((v) => {
          cache.versions[slug] = v.map((x) => ({
            id: x.id,
            slug,
            date: x.cree_le,
            acteur: x.acteur,
            contenu: x.contenu,
          }));
          notifier();
        })
        .catch(signaler);
    }
    return cache.versions[slug];
  },

  /**
   * Sans effet côté serveur — et c'est voulu.
   *
   * En local, le panel devait créer lui-même une entrée d'historique à chaque
   * enregistrement. Le serveur le fait de son côté, à l'écriture : le faire
   * une seconde fois depuis le navigateur créerait des doublons, et surtout
   * laisserait croire qu'un client peut fabriquer de l'historique.
   */
  ajouter: (_slug: string, _contenu: Brouillon, _acteur: string): void => {
    /* le serveur s'en charge */
  },
};

/* ========================================================================= */
/* Journal                                                                   */
/* ========================================================================= */

export const journal = {
  lister: (): Entree[] => cache.journal,

  /**
   * Sans effet, volontairement.
   *
   * Le journal est écrit par le SERVEUR, à partir de ce qu'il constate. Un
   * journal alimenté depuis le navigateur ne prouverait rien : il suffirait
   * d'ouvrir la console pour y inscrire n'importe quoi, ou d'omettre l'appel
   * pour effacer sa trace. La base refuse d'ailleurs toute modification
   * (règles `DO INSTEAD NOTHING` de `serveur/schema.sql`).
   */
  ecrire: (_acteur: string, _action: Action, _cible: string, _detail?: string): void => {
    /* le serveur s'en charge */
  },

  /** Impossible côté serveur : le journal est en ajout seul. */
  vider: (): void => {
    signaler(
      new ErreurApi(
        "droit_insuffisant",
        "Le journal ne peut pas être vidé : il est conservé en ajout seul, pour rester une preuve."
      )
    );
  },
};

/* ========================================================================= */
/* Utilisateurs                                                              */
/* ========================================================================= */

export const utilisateurs = {
  lister: (): Utilisateur[] => cache.utilisateurs,

  /**
   * Crée le compte et REMONTE le mot de passe provisoire.
   *
   * `ecrire()` ne rend que le succès ou l'échec ; ici la valeur elle-même
   * compte, et elle ne repassera jamais : le serveur ne conserve qu'une
   * empreinte du mot de passe. On appelle donc l'API directement, puis on
   * rafraîchit le cache comme le ferait `ecrire`.
   */
  ajouter: async (nom: string, email: string, role: Role, _acteur: string): Promise<CompteCree> => {
    const cree = await api.utilisateurs.ajouter(nom, email, role);
    await rafraichirUtilisateurs();
    return {
      utilisateur: {
        id: cree.id,
        nom: cree.nom,
        email: cree.email,
        role: cree.role as Role,
        actif: cree.actif,
      },
      motDePasseProvisoire: cree.motDePasseProvisoire ?? null,
      courrielEnvoye: Boolean(cree.courrielEnvoye),
      courrielRaison: cree.courrielRaison,
    };
  },

  majRole: (uid: string, role: Role, _acteur: string): Promise<void> =>
    ecrire(() => api.utilisateurs.modifier(uid, { role }), rafraichirUtilisateurs),

  basculerActif: (uid: string, _acteur: string): Promise<void> => {
    const u = cache.utilisateurs.find((x) => x.id === uid);
    return ecrire(
      () => api.utilisateurs.modifier(uid, { actif: !(u?.actif ?? true) }),
      rafraichirUtilisateurs
    );
  },
};

/* ========================================================================= */
/* Redirections                                                              */
/* ========================================================================= */

/**
 * Les redirections restent locales pour l'instant.
 *
 * Le contrat ne leur donne pas encore de routes : elles sont créées
 * automatiquement par le serveur au changement de slug (CONTRAT.md § 5), ce
 * qui couvre le cas réel. La gestion manuelle est un cas de rattrapage, à
 * ajouter au contrat quand le besoin se confirmera — plutôt que d'inventer
 * maintenant une API dont on ne sait pas si elle servira.
 */
export const redirections = null;

/* ========================================================================= */
/* Contenu des pages                                                         */
/* ========================================================================= */

/**
 * Réexporté tel quel : le contenu des pages n'a pas d'équivalent local, il
 * n'existe que côté serveur. L'éditeur de page d'accueil (lot suivant) s'en
 * servira directement, sans passer par le cache — une section s'ouvre une à
 * la fois, l'asynchrone n'y coûte rien.
 */
export const contenu = api.contenu;
export const publications = api.publications;
