import type { Brouillon } from "../brouillon";
import type { Session } from "../auth";
import type { Action, Entree } from "../depot";

/**
 * ---------------------------------------------------------------------------
 * LE CONTRAT, CÔTÉ PANEL
 * ---------------------------------------------------------------------------
 *
 * Traduction en TypeScript de `serveur/CONTRAT.md`. Ce fichier et ce document
 * décrivent la même chose ; si l'un change, l'autre doit changer.
 *
 * POURQUOI L'ÉCRIRE AVANT D'AVOIR LE SERVEUR
 * ------------------------------------------
 * Un contrat qu'on n'a jamais essayé d'honorer n'est qu'une intention. C'est
 * en écrivant le client qu'on découvre ce qui manque — et ça a déjà servi :
 * le schéma SQL déclarait deux statuts d'article (`brouillon`, `publie`) alors
 * que le panel en manipule quatre. L'écart serait apparu au premier
 * enregistrement en production, sur un article perdu.
 *
 * Le même principe est déjà appliqué dans `deck/depot.ts` pour les
 * présentations. On le généralise.
 */

/* ========================================================================= */
/* Erreurs                                                                   */
/* ========================================================================= */

/** Les codes que le serveur peut renvoyer. Voir CONTRAT.md § 2. */
export type CodeErreur =
  | "donnees_invalides"
  | "non_connecte"
  | "droit_insuffisant"
  | "introuvable"
  | "conflit"
  | "fichier_trop_lourd"
  | "trop_de_tentatives"
  | "erreur_serveur"
  /** Ajouté côté client : le serveur n'a pas répondu du tout. */
  | "reseau_indisponible";

/**
 * Une erreur de l'API, avec son message déjà rédigé en français.
 *
 * Le message vient du serveur et est destiné à être AFFICHÉ tel quel. On ne le
 * reformule pas ici : le serveur est le seul à savoir ce qui s'est réellement
 * passé, et une reformulation côté client finirait par mentir.
 */
export class ErreurApi extends Error {
  constructor(
    readonly code: CodeErreur,
    message: string,
    /** Sur un conflit (409), la version que le serveur détient. */
    readonly distant?: unknown
  ) {
    super(message);
    this.name = "ErreurApi";
  }
}

/* ========================================================================= */
/* Concurrence                                                               */
/* ========================================================================= */

/**
 * Une valeur accompagnée de son `ETag`.
 *
 * Toute écriture doit renvoyer l'étiquette reçue à la lecture. Si elle ne
 * correspond plus, quelqu'un d'autre a modifié la ressource entre-temps et le
 * serveur refuse en `409` plutôt que d'écraser en silence.
 */
export type Marque<T> = {
  valeur: T;
  /** À repasser dans `If-Match` lors de l'écriture. */
  etiquette: string;
};

/* ========================================================================= */
/* Articles                                                                  */
/* ========================================================================= */

/**
 * Un article tel que le serveur le renvoie.
 *
 * Volontairement construit sur `Brouillon` : les champs rédactionnels sont
 * exactement les mêmes des deux côtés. Sans cette dérivation, l'ajout d'un
 * champ dans l'éditeur passerait inaperçu ici jusqu'à l'exécution.
 */
export type ArticleDistant = Brouillon & {
  /** Identifiant interne. Le slug reste la clé publique. */
  id: string;
  maj_le: string;
  archive: boolean;
  supprime: boolean;
  maquette: boolean;
  cree_le: string;
};

export type VersionArticle = {
  id: string;
  contenu: Brouillon;
  acteur: string;
  cree_le: string;
};

export type FiltreArticles = {
  statut?: Brouillon["statut"];
  categorie?: string;
  /** `true` pour lister la corbeille au lieu des articles actifs. */
  corbeille?: boolean;
};

/* ========================================================================= */
/* Contenu des pages                                                         */
/* ========================================================================= */

/**
 * Une section éditable du site — « accueil.hero », « commun.pied »…
 *
 * `donnees` est ce que le site lit à la reconstruction ; `brouillon` est ce
 * que l'éditeur est en train de préparer. Les deux coexistent pour que le
 * panel puisse montrer l'écart avant publication.
 */
export type ContenuPage = {
  cle: string;
  libelle: string;
  donnees: Record<string, unknown>;
  /** `null` quand aucune modification n'est en attente. */
  brouillon: Record<string, unknown> | null;
  /** Version du schéma Zod ayant produit ces données. */
  schema_version: number;
  maj_le: string;
  maj_par: string | null;
};

/* ========================================================================= */
/* Médias                                                                    */
/* ========================================================================= */

export type Declinaison = {
  /** « webp », « 480 », « 720 »… */
  profil: string;
  chemin: string;
  taille: number;
};

export type MediaDistant = {
  id: string;
  nom: string;
  /** Ce qui est RÉELLEMENT stocké — « image/webp » pour toute image. */
  type_mime: string;
  /** Ce qui a été envoyé, avant conversion. Sert à justifier le gain de poids. */
  type_origine: string | null;
  taille: number;
  largeur: number | null;
  hauteur: number | null;
  duree: number | null;
  /**
   * Les images sont dans la base (`en_base`), les vidéos sur le disque
   * (`chemin`). La contrainte `contenu_ou_chemin` du schéma impose l'un ou
   * l'autre, jamais les deux.
   */
  en_base: boolean;
  /** Chemin relatif au stockage, jamais une URL absolue. `null` pour une image. */
  chemin: string | null;
  /** Adresse publique sur le site construit, calculée par le serveur. */
  url: string;
  alt: string | null;
  declinaisons: Declinaison[];
  ajoute_le: string;
};

/* ========================================================================= */
/* Publications                                                              */
/* ========================================================================= */

/**
 * Une reconstruction du site.
 *
 * Le panel interroge cet état pour afficher l'avancement, au lieu de laisser
 * l'éditeur devant un écran muet pendant que le site se reconstruit.
 */
export type Publication = {
  id: string;
  etat: "demandee" | "en_cours" | "reussie" | "echouee";
  demandee_le: string;
  terminee_le: string | null;
  reference: string | null;
  message: string | null;
};

/* ========================================================================= */
/* Journal et comptes                                                        */
/* ========================================================================= */

/** Le journal reprend la forme déjà utilisée par le panel. */
export type EntreeJournal = Entree;
export type ActionJournal = Action;

export type UtilisateurDistant = {
  id: string;
  email: string;
  nom: string;
  role: Session["role"];
  actif: boolean;
  cree_le: string;
  derniere_connexion: string | null;

  /*
   * Présents UNIQUEMENT dans la réponse à la création (201), jamais dans une
   * lecture : le serveur ne conserve que l'empreinte du mot de passe. Si cette
   * valeur n'est pas montrée à l'écran sur-le-champ, elle est perdue et le
   * compte devient inutilisable sans réinitialisation.
   */
  motDePasseProvisoire?: string;
  courrielEnvoye?: boolean;
  courrielRaison?: string;
};
