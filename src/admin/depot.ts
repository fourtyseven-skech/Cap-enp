import { tousLesArticles, type Post } from "@/lib/blog";
import type { Brouillon } from "./brouillon";

/**
 * ---------------------------------------------------------------------------
 * DÉPÔT — couche de persistance
 * ---------------------------------------------------------------------------
 *
 * Toutes les écritures du panel passent par ici : articles, versions, journal,
 * utilisateurs. Aucun composant n'accède directement au stockage.
 *
 * L'implémentation actuelle écrit dans le navigateur. C'est une SIMULATION
 * destinée à valider l'ergonomie et le modèle de données avant de brancher le
 * serveur. Elle en a les limites, qu'il faut connaître :
 *
 *   · les données vivent sur un seul poste et un seul navigateur ;
 *   · le journal y est modifiable — sur un vrai serveur il sera en ajout seul,
 *     non effaçable même par un administrateur ;
 *   · les rôles ne sont ici qu'un filtre d'affichage ; côté serveur ils devront
 *     être revérifiés à chaque requête.
 *
 * Le jour du branchement, seul ce fichier change : les vues appellent des
 * fonctions, pas un stockage.
 */

/* ========================================================================= */
/* Stockage bas niveau                                                       */
/* ========================================================================= */

const lire = <T,>(cle: string, defaut: T): T => {
  try {
    const b = localStorage.getItem(cle);
    return b ? (JSON.parse(b) as T) : defaut;
  } catch {
    return defaut;
  }
};

const ecrire = (cle: string, v: unknown) => {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* quota atteint — l'action reste effective en mémoire pour la session */
  }
};

// Le mecanisme d'abonnement vit dans `abonnes.ts` : l'adaptateur serveur en a
// besoin lui aussi, et le garder ici creerait un cycle d'imports.
export { surChangement } from "./abonnes";
import { notifier } from "./abonnes";
import { serveurConfigure } from "./serveur/client";
import * as serveur from "./serveur/adaptateur";

const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ========================================================================= */
/* Journal d'activité                                                        */
/* ========================================================================= */

export type Action =
  | "connexion"
  | "connexion-refusee"
  | "deconnexion"
  | "creation"
  | "modification"
  | "publication"
  | "depublication"
  | "archivage"
  | "restauration"
  | "suppression"
  | "media-ajout"
  | "media-suppression"
  | "role-modifie"
  | "remplacement-global"
  | "redirection"
  | "export";

export type Entree = {
  id: string;
  date: string;
  acteur: string;
  action: Action;
  cible: string;
  detail?: string;
};

const CLE_JOURNAL = "ms-admin-journal";
/** Au-delà, on tronque : un journal navigateur n'a pas vocation à tout garder. */
const PLAFOND_JOURNAL = 400;

const journalLocal = {
  lister: (): Entree[] => lire<Entree[]>(CLE_JOURNAL, []),

  /**
   * Écrit une entrée. Sur le serveur, cette opération sera en AJOUT SEUL :
   * aucune route ne devra permettre de modifier ou d'effacer une ligne, y
   * compris à un administrateur — sans quoi le journal ne prouve rien.
   */
  ecrire: (acteur: string, action: Action, cible: string, detail?: string) => {
    const e: Entree = { id: id(), date: new Date().toISOString(), acteur, action, cible, detail };
    ecrire(CLE_JOURNAL, [e, ...journal.lister()].slice(0, PLAFOND_JOURNAL));
    notifier();
  },

  vider: () => {
    ecrire(CLE_JOURNAL, []);
    notifier();
  },
};

export const LIBELLES: Record<Action, string> = {
  connexion: "Connexion",
  "connexion-refusee": "Connexion refusée",
  deconnexion: "Déconnexion",
  creation: "Création",
  modification: "Modification",
  publication: "Publication",
  depublication: "Dépublication",
  archivage: "Archivage",
  restauration: "Restauration",
  suppression: "Suppression",
  "media-ajout": "Média ajouté",
  "media-suppression": "Média supprimé",
  "role-modifie": "Rôle modifié",
  "remplacement-global": "Remplacement global",
  redirection: "Redirection",
  export: "Export",
};

/** Actions à surveiller de près dans le journal. */
export const SENSIBLES: Action[] = ["connexion-refusee", "suppression", "role-modifie", "remplacement-global"];

/* ========================================================================= */
/* Articles                                                                  */
/* ========================================================================= */

export type ArticleLocal = Brouillon & {
  /** Article issu d'un fichier du dépôt, ou créé dans le panel ? */
  origine: "fichier" | "panel";
  maj_le: string;
  archive?: boolean;
  supprime?: boolean;
  /** Article de démonstration, non validé par la Direction. */
  maquette?: boolean;
};

const CLE_ARTICLES = "ms-admin-articles";

const depuisFichier = (p: Post): ArticleLocal => ({
  titre: p.titre ?? "",
  slug: p.slug,
  chapeau: p.chapeau ?? "",
  corps: p.corps ?? "",
  categorie: p.categorie ?? "",
  format: p.format,
  accent: p.accent ?? p.spec.accent,
  motif: p.motif ?? p.spec.motif,
  titre_fantome: p.titre_fantome ?? "",
  reponse: p.reponse ?? "",
  version: p.version ?? "",
  exergue: p.exergue ?? "",
  meta_description: p.meta_description ?? "",
  etiquettes: (p.etiquettes ?? []).join(", "),
  auteur: p.auteur ?? "Équipe Megasoft",
  faq: p.faq ?? [],
  publie_le: p.publie_le,
  statut: (p.statut === "archive" ? "brouillon" : p.statut) as Brouillon["statut"],
  origine: "fichier",
  maj_le: p.maj_le ?? p.publie_le,
  archive: p.statut === "archive",
  maquette: p.maquette,
  image: p.image ?? "",
});

/*
 * POURQUOI CES ÉCRITURES SONT `async` ALORS QU'ELLES N'ATTENDENT RIEN
 *
 * Le mode local écrit dans le navigateur : c'est immédiat. Le mode serveur
 * écrit par le réseau : c'est une promesse. Or `articles` est typé d'après CE
 * dépôt-ci (`typeof articlesLocaux`, plus bas) — donc si les fonctions locales
 * sont déclarées immédiates, le panel entier croit que toute écriture l'est.
 *
 * Ce n'était pas qu'une question de type : « Restaurer », dans la corbeille,
 * appelait `.catch()` sur le résultat. En mode serveur, une promesse : rien à
 * signaler. En mode local, `undefined` — et le bouton plantait sur un
 * TypeError. Le compilateur le disait ; personne ne lançait le compilateur.
 *
 * `async` ne retarde rien : le corps s'exécute jusqu'au bout sans interruption,
 * puisqu'il n'attend rien. Seule la valeur de retour devient une promesse — ce
 * qu'elle est déjà dans le mode qui compte pour le client.
 */
const articlesLocaux = {
  /** Fichiers du dépôt + modifications locales. Le local l'emporte. */
  lister: (): ArticleLocal[] => {
    const locaux = lire<ArticleLocal[]>(CLE_ARTICLES, []);
    const parSlug = new Map(locaux.map((a) => [a.slug, a]));
    const base = tousLesArticles.map(depuisFichier).map((a) => parSlug.get(a.slug) ?? a);
    const nouveaux = locaux.filter((a) => !tousLesArticles.some((p) => p.slug === a.slug));
    return [...nouveaux, ...base].filter((a) => !a.supprime);
  },

  corbeille: (): ArticleLocal[] => lire<ArticleLocal[]>(CLE_ARTICLES, []).filter((a) => a.supprime),

  obtenir: (slug: string) => articlesLocaux.lister().find((a) => a.slug === slug),

  enregistrer: async (b: Brouillon, acteur: string) => {
    const locaux = lire<ArticleLocal[]>(CLE_ARTICLES, []);
    const existant = articlesLocaux.obtenir(b.slug);
    const a: ArticleLocal = {
      ...b,
      origine: existant?.origine ?? "panel",
      maj_le: new Date().toISOString().slice(0, 10),
      archive: false,
    };
    ecrire(CLE_ARTICLES, [a, ...locaux.filter((x) => x.slug !== b.slug)]);

    versionsLocales.ajouter(b.slug, b, acteur);
    journalLocal.ecrire(acteur, existant ? "modification" : "creation", b.slug, b.titre);
    if (b.statut === "publie" && existant?.statut !== "publie") {
      journalLocal.ecrire(acteur, "publication", b.slug, b.titre);
    }
    if (existant?.statut === "publie" && b.statut !== "publie") {
      journalLocal.ecrire(acteur, "depublication", b.slug, b.titre);
    }
    notifier();
  },

  /**
   * Archivage plutôt que suppression : une page déjà indexée qui disparaît
   * fait perdre le référencement acquis et laisse des liens morts sur le web.
   */
  archiver: async (slug: string, acteur: string) => {
    const a = articlesLocaux.obtenir(slug);
    if (!a) return;
    const locaux = lire<ArticleLocal[]>(CLE_ARTICLES, []);
    ecrire(CLE_ARTICLES, [
      { ...a, archive: true, statut: "brouillon" as const },
      ...locaux.filter((x) => x.slug !== slug),
    ]);
    journalLocal.ecrire(acteur, "archivage", slug, a.titre);
    notifier();
  },

  /** Corbeille : réversible, contrairement à la suppression du fichier. */
  jeter: async (slug: string, acteur: string) => {
    const a = articlesLocaux.obtenir(slug);
    if (!a) return;
    const locaux = lire<ArticleLocal[]>(CLE_ARTICLES, []);
    ecrire(CLE_ARTICLES, [{ ...a, supprime: true }, ...locaux.filter((x) => x.slug !== slug)]);
    journalLocal.ecrire(acteur, "suppression", slug, a.titre);
    notifier();
  },

  restaurer: async (slug: string, acteur: string) => {
    const locaux = lire<ArticleLocal[]>(CLE_ARTICLES, []);
    const a = locaux.find((x) => x.slug === slug);
    if (!a) return;
    ecrire(CLE_ARTICLES, [{ ...a, supprime: false, archive: false }, ...locaux.filter((x) => x.slug !== slug)]);
    journalLocal.ecrire(acteur, "restauration", slug, a.titre);
    notifier();
  },
};

/* ========================================================================= */
/* Versions                                                                  */
/* ========================================================================= */

export type Version = { id: string; slug: string; date: string; acteur: string; contenu: Brouillon };

const CLE_VERSIONS = "ms-admin-versions";
/** Vingt versions par article suffisent à réparer une bêtise récente. */
const PLAFOND_VERSIONS = 20;

const versionsLocales = {
  lister: (slug: string): Version[] =>
    lire<Version[]>(CLE_VERSIONS, []).filter((v) => v.slug === slug),

  ajouter: (slug: string, contenu: Brouillon, acteur: string) => {
    const toutes = lire<Version[]>(CLE_VERSIONS, []);
    const v: Version = { id: id(), slug, date: new Date().toISOString(), acteur, contenu };
    const pourCet = [v, ...toutes.filter((x) => x.slug === slug)].slice(0, PLAFOND_VERSIONS);
    ecrire(CLE_VERSIONS, [...pourCet, ...toutes.filter((x) => x.slug !== slug)]);
  },
};

/* ========================================================================= */
/* Présentations                                                             */
/* ========================================================================= */

/*
 * Les présentations ont leur propre dépôt : `src/admin/deck/depot.ts`.
 *
 * Elles y vivent parce que leur contrat est ASYNCHRONE, en prévision du serveur
 * annoncé — alors que tout ce fichier-ci est synchrone. Les mélanger aurait
 * obligé soit à rendre les articles asynchrones sans raison actuelle, soit à
 * donner aux présentations une interface qu'il faudrait réécrire le jour de la
 * bascule.
 *
 * La sauvegarde générale les emporte quand même : perdre ses présentations
 * parce qu'elles sont rangées ailleurs serait absurde. Elle les traite en
 * données opaques — elle n'a pas besoin d'en comprendre la structure pour les
 * recopier, et n'aura donc jamais à suivre ses évolutions.
 */
const CLE_PRESENTATIONS = "ms-admin-decks";

type PresentationOpaque = { id?: string };

/* ========================================================================= */
/* Utilisateurs et rôles                                                     */
/* ========================================================================= */

export type Role = "administrateur" | "redacteur" | "relecteur";
export type Utilisateur = { id: string; nom: string; email: string; role: Role; actif: boolean };

const CLE_UTILISATEURS = "ms-admin-utilisateurs";

/** Ce que rend la création d'un compte — voir `ajouter` ci-dessous. */
export type CompteCree = {
  utilisateur: Utilisateur;
  /** Affiché UNE SEULE FOIS. `null` en mode local, où rien n'est vérifié. */
  motDePasseProvisoire: string | null;
  /** L'invitation est-elle partie par courriel ? */
  courrielEnvoye: boolean;
  /** Pourquoi elle n'est pas partie, le cas échéant. */
  courrielRaison?: string;
};

const utilisateursLocaux = {
  lister: (): Utilisateur[] =>
    lire<Utilisateur[]>(CLE_UTILISATEURS, [
      { id: "u1", nom: "Direction", email: "direction@megasoft-office.com", role: "administrateur", actif: true },
    ]),

  /**
   * Crée un compte et REND CE QU'IL FAUT POUR S'EN SERVIR.
   *
   * Le serveur génère un mot de passe provisoire et le renvoie une seule fois,
   * puisqu'il n'en garde que l'empreinte. Cette fonction rendait `void` : le
   * panel appelait, affichait la ligne du nouveau compte… et le mot de passe
   * était perdu à l'instant même. L'administrateur créait donc un compte dont
   * personne ne pouvait se servir.
   *
   * En mode local, aucun mot de passe n'existe — le mode atelier ne vérifie
   * rien : on renvoie `null`, et l'écran l'explique plutôt que d'inventer une
   * valeur.
   */
  ajouter: async (nom: string, email: string, role: Role, acteur: string): Promise<CompteCree> => {
    const u: Utilisateur = { id: id(), nom, email, role, actif: true };
    ecrire(CLE_UTILISATEURS, [...utilisateurs.lister(), u]);
    journalLocal.ecrire(acteur, "role-modifie", email, `Compte créé — ${role}`);
    notifier();
    return { utilisateur: u, motDePasseProvisoire: null, courrielEnvoye: false };
  },

  majRole: (uid: string, role: Role, acteur: string) => {
    const l = utilisateursLocaux.lister();
    const u = l.find((x) => x.id === uid);
    ecrire(CLE_UTILISATEURS, l.map((x) => (x.id === uid ? { ...x, role } : x)));
    journalLocal.ecrire(acteur, "role-modifie", u?.email ?? uid, `Nouveau rôle : ${role}`);
    notifier();
  },

  basculerActif: (uid: string, acteur: string) => {
    const l = utilisateursLocaux.lister();
    const u = l.find((x) => x.id === uid);
    ecrire(CLE_UTILISATEURS, l.map((x) => (x.id === uid ? { ...x, actif: !x.actif } : x)));
    journalLocal.ecrire(acteur, "role-modifie", u?.email ?? uid, u?.actif ? "Compte désactivé" : "Compte réactivé");
    notifier();
  },
};

/* ========================================================================= */
/* Redirections                                                              */
/* ========================================================================= */

/**
 * Une adresse de page ne doit jamais changer — mais elle change quand même :
 * une faute de frappe repérée après publication, un article renommé, une
 * rubrique réorganisée. Sans redirection, chaque changement laisse une page 404
 * là où pointaient les liens, les partages et les résultats de recherche.
 *
 * Le panel ne peut pas rediriger lui-même : c'est le serveur web qui le fait.
 * Il tient donc la liste et produit des règles pour le `.htaccess` d'Apache et
 * de LiteSpeed — ce que fait tourner PlanetHoster.
 *
 * Le format était auparavant celui de Netlify (`de<TAB>vers<TAB>code`). Il n'a
 * jamais été lu : le site n'est pas hébergé là, et ce fichier y était inerte.
 */
export type Redirection = { id: string; de: string; vers: string; code: 301 | 302; cree_le: string };

const CLE_REDIRECTIONS = "ms-admin-redirections";

export const redirections = {
  lister: (): Redirection[] => lire<Redirection[]>(CLE_REDIRECTIONS, []),

  ajouter: (de: string, vers: string, code: 301 | 302, acteur: string) => {
    const r: Redirection = { id: id(), de, vers, code, cree_le: new Date().toISOString() };
    ecrire(CLE_REDIRECTIONS, [r, ...redirections.lister().filter((x) => x.de !== de)]);
    journalLocal.ecrire(acteur, "redirection", de, `→ ${vers} (${code})`);
    notifier();
  },

  retirer: (rid: string, acteur: string) => {
    const r = redirections.lister().find((x) => x.id === rid);
    ecrire(CLE_REDIRECTIONS, redirections.lister().filter((x) => x.id !== rid));
    if (r) journalLocal.ecrire(acteur, "redirection", r.de, "Redirection retirée");
    notifier();
  },

  /** Règles `.htaccess`, à coller entre les marques de `public/.htaccess`. */
  versFichier: (): string =>
    redirections
      .lister()
      .map((r) => `Redirect ${r.code} ${r.de} ${r.vers}`)
      .join("\n"),
};

/* ========================================================================= */
/* Sauvegarde et restauration                                                */
/* ========================================================================= */

/**
 * Tant qu'il n'y a pas de serveur, ce navigateur est le SEUL endroit où vivent
 * les modifications. Un profil effacé, un poste changé, un nettoyage de cache
 * un peu zélé, et tout est perdu — sans avertissement et sans recours.
 *
 * L'export texte existant sert à déposer les fichiers dans le dépôt ; il ne
 * permet pas de revenir en arrière. Celui-ci est une vraie sauvegarde : il
 * emporte l'état complet et sait le réinstaller.
 */
export type Sauvegarde = {
  version: 1;
  date: string;
  articles: ArticleLocal[];
  versions: Version[];
  journal: Entree[];
  utilisateurs: Utilisateur[];
  redirections: Redirection[];
  /** Ajouté après coup : une sauvegarde d'avant les présentations n'en a pas. */
  presentations?: PresentationOpaque[];
};

export const sauvegarde = {
  exporter: (): Sauvegarde => ({
    version: 1,
    date: new Date().toISOString(),
    articles: lire<ArticleLocal[]>(CLE_ARTICLES, []),
    versions: lire<Version[]>(CLE_VERSIONS, []),
    journal: lire<Entree[]>(CLE_JOURNAL, []),
    utilisateurs: utilisateursLocaux.lister(),
    redirections: redirections.lister(),
    presentations: lire<PresentationOpaque[]>(CLE_PRESENTATIONS, []),
  }),

  /**
   * Restaure une sauvegarde. `fusion` conserve ce qui existe et n'ajoute que
   * l'absent — c'est le mode sûr, celui qui ne peut pas faire perdre un article
   * écrit depuis la sauvegarde. Le remplacement complet est explicite.
   */
  importer: (brut: unknown, mode: "fusion" | "remplacement", acteur: string): { ok: boolean; message: string } => {
    const s = brut as Partial<Sauvegarde>;
    if (!s || s.version !== 1 || !Array.isArray(s.articles)) {
      return { ok: false, message: "Fichier non reconnu : ce n'est pas une sauvegarde du panel." };
    }

    if (mode === "remplacement") {
      ecrire(CLE_ARTICLES, s.articles);
      ecrire(CLE_VERSIONS, s.versions ?? []);
      ecrire(CLE_UTILISATEURS, s.utilisateurs ?? []);
      ecrire(CLE_REDIRECTIONS, s.redirections ?? []);
      ecrire(CLE_PRESENTATIONS, s.presentations ?? []);
    } else {
      const existants = lire<ArticleLocal[]>(CLE_ARTICLES, []);
      const connus = new Set(existants.map((a) => a.slug));
      ecrire(CLE_ARTICLES, [...existants, ...s.articles.filter((a) => !connus.has(a.slug))]);

      const vExistantes = lire<Version[]>(CLE_VERSIONS, []);
      const vConnues = new Set(vExistantes.map((v) => v.id));
      ecrire(CLE_VERSIONS, [...vExistantes, ...(s.versions ?? []).filter((v) => !vConnues.has(v.id))]);

      const uExistants = utilisateursLocaux.lister();
      const uConnus = new Set(uExistants.map((u) => u.email));
      ecrire(CLE_UTILISATEURS, [...uExistants, ...(s.utilisateurs ?? []).filter((u) => !uConnus.has(u.email))]);

      const rExistantes = redirections.lister();
      const rConnues = new Set(rExistantes.map((r) => r.de));
      ecrire(CLE_REDIRECTIONS, [...rExistantes, ...(s.redirections ?? []).filter((r) => !rConnues.has(r.de))]);

      const pExistantes = lire<PresentationOpaque[]>(CLE_PRESENTATIONS, []);
      const pConnues = new Set(pExistantes.map((p) => p.id));
      ecrire(CLE_PRESENTATIONS, [
        ...pExistantes,
        ...(s.presentations ?? []).filter((p) => !pConnues.has(p.id)),
      ]);
    }

    journalLocal.ecrire(acteur, "restauration", "sauvegarde", `${s.articles.length} article(s) — mode ${mode}`);
    notifier();
    return {
      ok: true,
      message: `${s.articles.length} article(s) restauré(s) en mode ${mode === "fusion" ? "fusion" : "remplacement"}.`,
    };
  },

  /** Efface les données locales du panel. Les fichiers du dépôt sont intacts. */
  reinitialiser: (acteur: string) => {
    journalLocal.ecrire(acteur, "suppression", "panel", "Données locales effacées");
    const garde = lire<Entree[]>(CLE_JOURNAL, []);
    [CLE_ARTICLES, CLE_VERSIONS, CLE_UTILISATEURS, CLE_REDIRECTIONS, CLE_PRESENTATIONS].forEach((c) =>
      ecrire(c, [])
    );
    // Le journal survit : c'est la seule trace de ce qui vient d'être fait.
    ecrire(CLE_JOURNAL, garde);
    notifier();
  },

  /** Octets occupés par le panel dans localStorage. */
  poids: (): number =>
    [CLE_ARTICLES, CLE_VERSIONS, CLE_JOURNAL, CLE_UTILISATEURS, CLE_REDIRECTIONS, CLE_PRESENTATIONS].reduce(
      (s, c) => s + (localStorage.getItem(c)?.length ?? 0),
      0
    ),
};

/**
 * Permissions par rôle.
 *
 * ⚠️ Ce filtre ne sert qu'à l'affichage. Sur un serveur, chaque route devra
 * revérifier le rôle en base : un contrôle effectué dans le navigateur se
 * contourne en modifiant une variable dans la console.
 */
export const PERMISSIONS: Record<Role, string[]> = {
  administrateur: ["ecrire", "publier", "supprimer", "medias", "utilisateurs", "outils", "journal"],
  redacteur: ["ecrire", "medias"],
  relecteur: [],
};

export const peut = (role: Role, quoi: string) => PERMISSIONS[role].includes(quoi);


/* ========================================================================= */
/* LA BASCULE                                                                */
/* ========================================================================= */

/**
 * Le point de branchement annoncé en tête de ce fichier.
 *
 * Tout ce qui précède est l'implémentation NAVIGATEUR, inchangée. Les quatre
 * exports ci-dessous choisissent, au chargement du module, entre elle et
 * l'adaptateur serveur — selon la seule présence de `VITE_API_URL`.
 *
 * Aucune vue ne change : elles importent `articles`, `journal`, `versions` et
 * `utilisateurs` comme avant, et ignorent tout de l'origine des données.
 *
 * POURQUOI UNE CONVERSION DE TYPE EXPLICITE
 * -----------------------------------------
 * Les deux implémentations ont la même FORME mais pas la même signature : les
 * écritures locales renvoient `void`, celles du serveur renvoient une
 * `Promise<void>`, puisqu'elles passent par le réseau. Sans conversion,
 * TypeScript exposerait aux vues une union `void | Promise<void>` — ce qui les
 * obligerait toutes à traiter le cas asynchrone, alors qu'elles n'ont
 * précisément pas à le connaître.
 *
 * On annonce donc le type local, qui est le contrat que les vues respectent
 * déjà. Un appelant qui souhaite ATTENDRE la fin d'une écriture — et savoir si
 * elle a réussi — ne passe pas par ici : il s'adresse directement à
 * `serveur/depotHttp.ts`. Les autres continuent d'écrire sans attendre, et les
 * échecs remontent par le canal `surErreur` de l'adaptateur, que le panel
 * affiche.
 */
export const journal: typeof journalLocal = serveurConfigure
  ? (serveur.journal as unknown as typeof journalLocal)
  : journalLocal;

export const articles: typeof articlesLocaux = serveurConfigure
  ? (serveur.articles as unknown as typeof articlesLocaux)
  : articlesLocaux;

export const versions: typeof versionsLocales = serveurConfigure
  ? (serveur.versions as unknown as typeof versionsLocales)
  : versionsLocales;

export const utilisateurs: typeof utilisateursLocaux = serveurConfigure
  ? (serveur.utilisateurs as unknown as typeof utilisateursLocaux)
  : utilisateursLocaux;

/**
 * Où le panel écrit réellement. Affiché dans l'onglet Diagnostic : un éditeur
 * doit pouvoir savoir si son travail quitte son navigateur ou non.
 */
export const MODE_STOCKAGE: "navigateur" | "serveur" = serveurConfigure
  ? "serveur"
  : "navigateur";
