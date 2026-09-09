import type { Brouillon } from "../brouillon";
import type { Session } from "../auth";
import { lire, requete } from "./client";
import type {
  ArticleDistant,
  ContenuPage,
  EntreeJournal,
  FiltreArticles,
  Marque,
  MediaDistant,
  Publication,
  UtilisateurDistant,
  VersionArticle,
} from "./contrat";

/**
 * ---------------------------------------------------------------------------
 * LE DÉPÔT SERVEUR
 * ---------------------------------------------------------------------------
 *
 * Les opérations du panel, exprimées une fois, contre `serveur/CONTRAT.md`.
 * Aucune vue n'appelle `fetch` : elles appellent ces fonctions, qui existeront
 * à l'identique le jour où le stockage passera du navigateur au serveur.
 *
 * CE QUE CE FICHIER N'EST PAS
 * ---------------------------
 * Ce n'est pas une sécurité. Le rôle affiché ici sert au confort de
 * l'interface — masquer un bouton inutile. Le serveur revérifie chaque droit à
 * chaque requête, parce qu'un bouton masqué reste appelable en écrivant la
 * requête à la main.
 */

/* ========================================================================= */
/* Session                                                                   */
/* ========================================================================= */

export const session = {
  /** L'utilisateur connecté, ou `null`. Appelé au chargement du panel. */
  courante: async (): Promise<Session | null> => {
    try {
      return await lire<Session>("/api/session");
    } catch {
      // Une session absente ou expirée n'est pas une anomalie : c'est le cas
      // normal d'une première visite. On renvoie `null` plutôt que de faire
      // remonter une erreur que l'appelant devrait aussitôt rattraper.
      return null;
    }
  },

  connexion: async (email: string, motDePasse: string): Promise<Session> =>
    (await requete<Session>("/api/connexion", { methode: "POST", corps: { email, motDePasse } }))
      .valeur,

  /** Détruit la session en base, pas seulement le cookie. */
  deconnexion: async (): Promise<void> => {
    await requete<void>("/api/deconnexion", { methode: "POST" });
  },

  /**
   * Change son propre mot de passe. L'actuel est redemandé par le serveur.
   *
   * Toutes les sessions du compte sont fermées, y compris celles ouvertes
   * ailleurs — la session courante est rouverte dans la même réponse, il n'y a
   * donc rien à faire ici pour rester connecté.
   */
  changerMotDePasse: async (actuel: string, nouveau: string): Promise<void> => {
    await requete<void>("/api/mot-de-passe", { methode: "POST", corps: { actuel, nouveau } });
  },

};

/* ========================================================================= */
/* Articles                                                                  */
/* ========================================================================= */

const parametres = (f: FiltreArticles = {}): string => {
  const p = new URLSearchParams();
  if (f.statut) p.set("statut", f.statut);
  if (f.categorie) p.set("categorie", f.categorie);
  if (f.corbeille) p.set("corbeille", "1");
  const q = p.toString();
  return q ? `?${q}` : "";
};

export const articles = {
  lister: (f?: FiltreArticles): Promise<ArticleDistant[]> =>
    lire<ArticleDistant[]>(`/api/articles${parametres(f)}`),

  /**
   * Un article, avec son étiquette de version.
   *
   * L'étiquette n'est pas un détail d'implémentation qu'on pourrait masquer :
   * l'appelant doit la conserver et la rendre à l'enregistrement, sans quoi
   * l'écriture est refusée. C'est ce qui empêche deux rédacteurs d'écraser
   * mutuellement leur travail.
   */
  obtenir: (slug: string): Promise<Marque<ArticleDistant>> =>
    requete<ArticleDistant>(`/api/articles/${encodeURIComponent(slug)}`),

  creer: async (b: Brouillon): Promise<ArticleDistant> =>
    (await requete<ArticleDistant>("/api/articles", { methode: "POST", corps: b })).valeur,

  enregistrer: (b: Brouillon, etiquette: string): Promise<Marque<ArticleDistant>> =>
    requete<ArticleDistant>(`/api/articles/${encodeURIComponent(b.slug)}`, {
      methode: "PUT",
      corps: b,
      etiquette,
    }),

  /**
   * Publier déclenche la reconstruction du site : la réponse est la
   * publication en cours, que le panel suit ensuite via `publications`.
   */
  publier: async (slug: string): Promise<Publication> =>
    (await requete<Publication>(`/api/articles/${encodeURIComponent(slug)}/publier`, {
      methode: "POST",
    })).valeur,

  depublier: async (slug: string): Promise<Publication> =>
    (await requete<Publication>(`/api/articles/${encodeURIComponent(slug)}/depublier`, {
      methode: "POST",
    })).valeur,

  /**
   * Archivage plutôt que suppression : une page déjà indexée qui disparaît
   * fait perdre le référencement acquis et laisse des liens morts sur le web.
   */
  archiver: async (slug: string): Promise<void> => {
    await requete<void>(`/api/articles/${encodeURIComponent(slug)}/archiver`, { methode: "POST" });
  },

  /** Corbeille — réversible. Le serveur ne détruit jamais réellement. */
  jeter: async (slug: string): Promise<void> => {
    await requete<void>(`/api/articles/${encodeURIComponent(slug)}`, { methode: "DELETE" });
  },

  restaurer: async (slug: string): Promise<void> => {
    await requete<void>(`/api/articles/${encodeURIComponent(slug)}/restaurer`, { methode: "POST" });
  },

  versions: (slug: string): Promise<VersionArticle[]> =>
    lire<VersionArticle[]>(`/api/articles/${encodeURIComponent(slug)}/versions`),

  restaurerVersion: async (slug: string, id: string): Promise<ArticleDistant> =>
    (await requete<ArticleDistant>(
      `/api/articles/${encodeURIComponent(slug)}/versions/${encodeURIComponent(id)}/restaurer`,
      { methode: "POST" }
    )).valeur,
};

/* ========================================================================= */
/* Contenu des pages                                                         */
/* ========================================================================= */

export const contenu = {
  lister: (): Promise<ContenuPage[]> => lire<ContenuPage[]>("/api/contenu"),

  obtenir: (cle: string): Promise<Marque<ContenuPage>> =>
    requete<ContenuPage>(`/api/contenu/${encodeURIComponent(cle)}`),

  /**
   * Écrit le BROUILLON, jamais la version publiée.
   *
   * Séparation voulue : l'éditeur doit pouvoir travailler une section sur
   * plusieurs jours sans que le site public s'en aperçoive. Publier est un
   * geste distinct, réservé à l'administrateur.
   */
  enregistrerBrouillon: (
    cle: string,
    donnees: Record<string, unknown>,
    etiquette: string
  ): Promise<Marque<ContenuPage>> =>
    requete<ContenuPage>(`/api/contenu/${encodeURIComponent(cle)}`, {
      methode: "PUT",
      corps: donnees,
      etiquette,
    }),

  publier: async (cle: string): Promise<Publication> =>
    (await requete<Publication>(`/api/contenu/${encodeURIComponent(cle)}/publier`, {
      methode: "POST",
    })).valeur,

  abandonner: async (cle: string): Promise<void> => {
    await requete<void>(`/api/contenu/${encodeURIComponent(cle)}/abandonner`, { methode: "POST" });
  },
};

/* ========================================================================= */
/* Médias                                                                    */
/* ========================================================================= */

export const medias = {
  lister: (): Promise<MediaDistant[]> => lire<MediaDistant[]>("/api/medias"),

  /**
   * Envoi d'un fichier.
   *
   * `FormData` et non JSON : encoder une vidéo en base64 pour la faire tenir
   * dans du JSON l'alourdit d'un tiers et oblige à la charger entièrement en
   * mémoire, des deux côtés.
   *
   * Le serveur détermine le type par le CONTENU du fichier, pas par son
   * extension ni par le type annoncé ici : les deux viennent du navigateur,
   * donc d'un endroit qu'on ne contrôle pas.
   */
  envoyer: async (fichier: File, alt?: string, poidsAssume?: string): Promise<MediaDistant> => {
    const f = new FormData();
    f.append("fichier", fichier);
    if (alt) f.append("alt", alt);
    /* La phrase cochée pour un fichier au-delà du seuil rouge. Le serveur pèse
       lui-même le fichier et décide si elle était requise : l'envoyer sans
       nécessité ne donne aucun droit supplémentaire. */
    if (poidsAssume) f.append("poids_assume", poidsAssume);
    return (await requete<MediaDistant>("/api/medias", { methode: "POST", fichier: f })).valeur;
  },

  /** Le texte alternatif se corrige sans réenvoyer le fichier. */
  decrire: async (id: string, alt: string): Promise<MediaDistant> =>
    (await requete<MediaDistant>(`/api/medias/${encodeURIComponent(id)}`, {
      methode: "PATCH",
      corps: { alt },
    })).valeur,

  /** Refusé en `409` par le serveur si le média est encore référencé. */
  supprimer: async (id: string): Promise<void> => {
    await requete<void>(`/api/medias/${encodeURIComponent(id)}`, { methode: "DELETE" });
  },
};

/* ========================================================================= */
/* Présence                                                                  */
/* ========================================================================= */

/**
 * Qui travaille sur quoi.
 *
 * Éphémère : le serveur la garde en mémoire quatre-vingt-dix secondes. Le
 * panel bat toutes les trente secondes tant qu'un écran reste ouvert.
 */
export const presence = {
  battre: async (
    ressource: string
  ): Promise<{ utilisateur: string; nom: string; depuisMs: number }[]> =>
    (await requete<{ autres: { utilisateur: string; nom: string; depuisMs: number }[] }>(
      "/api/presence",
      { methode: "PUT", corps: { ressource } }
    )).valeur.autres,

  quitter: async (ressource: string): Promise<void> => {
    await requete<void>("/api/presence", { methode: "DELETE", corps: { ressource } });
  },
};

/* ========================================================================= */
/* Publications                                                              */
/* ========================================================================= */

export const publications = {
  /**
   * Demande la reconstruction du site.
   *
   * À appeler après toute écriture qui change ce qu'un visiteur voit. Sans
   * elle, le panel enregistre et le site ne bouge pas — c'est exactement ce
   * qui rendait le blog figé sur ses cinq articles.
   */
  demander: async (): Promise<Publication> =>
    (await requete<Publication>("/api/publications", { methode: "POST" })).valeur,

  lister: (): Promise<Publication[]> => lire<Publication[]>("/api/publications"),

  obtenir: (id: string): Promise<Publication> =>
    lire<Publication>(`/api/publications/${encodeURIComponent(id)}`),

  /**
   * Suit une reconstruction jusqu'à son issue.
   *
   * Le serveur ne peut pas prévenir le panel de lui-même : il faut demander.
   * On interroge à intervalle fixe, et on s'arrête sur un état terminal ou
   * après le délai imparti — sans quoi une reconstruction bloquée ferait
   * interroger le serveur indéfiniment, onglet ouvert.
   */
  suivre: async (
    id: string,
    surAvancement?: (p: Publication) => void,
    { intervalleMs = 3000, limiteMs = 10 * 60 * 1000 } = {}
  ): Promise<Publication> => {
    const debut = Date.now();
    for (;;) {
      const p = await publications.obtenir(id);
      surAvancement?.(p);
      if (p.etat === "reussie" || p.etat === "echouee") return p;
      if (Date.now() - debut > limiteMs) {
        return { ...p, etat: "echouee", message: "Délai dépassé sans réponse du serveur." };
      }
      await new Promise((r) => setTimeout(r, intervalleMs));
    }
  },
};

/* ========================================================================= */
/* Journal et comptes                                                        */
/* ========================================================================= */

/**
 * Le journal n'a aucune fonction d'écriture, et c'est volontaire : les entrées
 * sont créées par le serveur lui-même, et la base refuse toute modification.
 * Un journal qu'on peut alimenter depuis le navigateur ne prouve rien.
 */
export const journal = {
  lister: (): Promise<EntreeJournal[]> => lire<EntreeJournal[]>("/api/journal"),
};

export const utilisateurs = {
  lister: (): Promise<UtilisateurDistant[]> => lire<UtilisateurDistant[]>("/api/utilisateurs"),

  ajouter: async (
    nom: string,
    email: string,
    role: Session["role"]
  ): Promise<UtilisateurDistant> =>
    (await requete<UtilisateurDistant>("/api/utilisateurs", {
      methode: "POST",
      corps: { nom, email, role },
    })).valeur,

  modifier: async (
    id: string,
    champs: Partial<Pick<UtilisateurDistant, "nom" | "role" | "actif">>
  ): Promise<UtilisateurDistant> =>
    (await requete<UtilisateurDistant>(`/api/utilisateurs/${encodeURIComponent(id)}`, {
      methode: "PATCH",
      corps: champs,
    })).valeur,

  supprimer: async (id: string): Promise<void> => {
    await requete<void>(`/api/utilisateurs/${encodeURIComponent(id)}`, { methode: "DELETE" });
  },
};
