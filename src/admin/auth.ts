import { useSyncExternalStore } from "react";

/**
 * ---------------------------------------------------------------------------
 * FRONTIÈRE D'AUTHENTIFICATION DU PANEL
 * ---------------------------------------------------------------------------
 *
 * ⚠️ À LIRE AVANT TOUTE MODIFICATION ⚠️
 *
 * Il est IMPOSSIBLE de sécuriser une authentification uniquement dans le
 * navigateur. Le site est statique : le code JavaScript livré est lisible et
 * modifiable par n'importe quel visiteur. Un mot de passe comparé ici, même
 * haché, se contourne en changeant la valeur d'une variable dans la console.
 *
 * La sécurité réelle ne peut venir que d'un service extérieur qui, lui, tourne
 * sur un serveur. C'est ce que fait `serveur/` : il vérifie le mot de passe
 * avec bcrypt, ouvre une session révocable et la pose dans un cookie HttpOnly.
 * Il ne lui manque que d'être branché ici, et les accès de l'hébergement.
 *
 * Ce module pose donc la frontière et refuse par défaut. Le mode « atelier »
 * n'existe QUE pendant le développement local : il est physiquement absent du
 * site construit, car `import.meta.env.DEV` vaut false en production et le
 * code est éliminé à la compilation.
 */

/*
 * Les fournisseurs possibles.
 *
 * `netlify` et `github` ont été retirés : le site est hébergé sur le serveur du
 * client, chez PlanetHoster, et n'utilise ni l'un ni l'autre. Les laisser
 * déclarés aurait entretenu l'idée qu'une de ces pistes reste ouverte.
 *
 * `serveur` désigne NOTRE API (`serveur/`), qui vérifie le mot de passe et pose
 * un cookie de session. Son implémentation est le lot 1.
 */
export type Fournisseur = "aucun" | "atelier" | "serveur";

export type Session = {
  nom: string;
  email: string;
  role: "administrateur" | "redacteur" | "relecteur";
};

/**
 * Fournisseur actif.
 *
 *  · En développement local : "atelier" par défaut — vous entrez sans rien
 *    configurer.
 *  · En production : "aucun" par défaut — l'accès est refusé.
 *  · Sur un déploiement de recette, on peut forcer "atelier" en
 *    déclarant VITE_ADMIN_AUTH=atelier dans les variables d'environnement du
 *    site. Sans cette variable, le code du mode atelier n'est même pas inclus
 *    dans le fichier construit : Vite remplace l'expression par une constante
 *    et élimine les branches mortes.
 *
 * ⚠️ Le mode "atelier" n'est PAS une sécurité, y compris avec un code d'accès :
 * ce code part dans le JavaScript livré et se lit dans le navigateur. Il sert à
 * écarter un visiteur de passage sur une adresse de recette, rien de plus. Pour
 * protéger réellement un site de recette, utiliser la protection par mot de
 * passe de l'hébergeur, qui s'applique côté serveur avant même la livraison des
 * fichiers.
 */
const CONFIGURE = import.meta.env.VITE_ADMIN_AUTH as Fournisseur | undefined;

export const FOURNISSEUR: Fournisseur = CONFIGURE ?? (import.meta.env.DEV ? "atelier" : "aucun");

/** Code d'accès partagé du mode atelier. Vide = n'importe quel mot de passe. */
const CODE_ATELIER = (import.meta.env.VITE_ADMIN_CODE as string | undefined) ?? "";

/** Le panel peut-il seulement fonctionner dans cet environnement ? */
export const authConfiguree = FOURNISSEUR !== "aucun";

const CLE = "ms-admin-session";

/**
 * Trois états, et non deux.
 *
 *   · `undefined` — on ne sait pas encore. N'existe qu'en mode serveur, le
 *     temps de demander à l'API qui est connecté ;
 *   · `null`      — personne n'est connecté ;
 *   · `Session`   — quelqu'un l'est.
 *
 * Sans le premier, le panel afficherait l'écran de connexion pendant la
 * vérification, puis basculerait sur le tableau de bord. Une personne déjà
 * connectée verrait donc un formulaire clignoter à chaque rechargement — et
 * certaines commenceraient à y taper leur mot de passe.
 */
let session: Session | null | undefined = FOURNISSEUR === "serveur" ? undefined : null;

const abonnes = new Set<() => void>();

const notifier = () => abonnes.forEach((f) => f());

/*
 * Reprise de session au chargement, en mode local uniquement.
 *
 * Volontairement en sessionStorage et non en localStorage : la session tombe à
 * la fermeture de l'onglet, ce qui limite la fenêtre d'exposition sur un poste
 * partagé.
 *
 * En mode serveur, on ne reprend RIEN depuis le navigateur : la seule autorité
 * est le cookie, et lui seul dit si la session est encore valide. Recopier ici
 * ce que le navigateur a gardé afficherait un panel à quelqu'un dont la session
 * a expiré — jusqu'à la première requête refusée.
 */
if (FOURNISSEUR !== "serveur") {
  try {
    const brut = sessionStorage.getItem(CLE);
    if (brut && authConfiguree) session = JSON.parse(brut);
  } catch {
    session = null;
  }
}

export const useSession = () =>
  useSyncExternalStore(
    (cb) => {
      abonnes.add(cb);
      return () => {
        abonnes.delete(cb);
      };
    },
    () => session,
    () => session
  );

/**
 * Demande au serveur qui est connecté. À appeler une fois, au montage du panel.
 *
 * Sans effet hors du mode serveur : l'état y est déjà connu de façon synchrone.
 */
export const verifierSession = async (): Promise<void> => {
  if (FOURNISSEUR !== "serveur") return;
  const { session: api } = await import("./serveur/depotHttp");
  session = await api.courante();
  notifier();
};

export const deconnexion = async (): Promise<void> => {
  /*
   * L'ordre compte : on prévient d'abord le serveur, qui SUPPRIME la ligne de
   * session en base. Vider seulement l'état local laisserait le cookie valide —
   * il suffirait de recharger la page pour se retrouver connecté.
   *
   * Un échec réseau ne doit pas empêcher de fermer l'écran : on nettoie
   * localement quoi qu'il arrive.
   */
  if (FOURNISSEUR === "serveur") {
    try {
      const { session: api } = await import("./serveur/depotHttp");
      await api.deconnexion();
    } catch {
      /* serveur injoignable — la session expirera d'elle-même */
    }
  }

  session = null;
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible — sans conséquence */
  }
  notifier();
};

export type ResultatConnexion = { ok: boolean; message?: string };

/**
 * Tentative de connexion.
 *
 * En production sans fournisseur configuré, la fonction refuse toujours : on
 * échoue FERMÉ. Accorder l'accès « en attendant » reviendrait à publier un
 * panel d'administration ouvert à tous.
 */
export const connexion = async (email: string, motDePasse: string): Promise<ResultatConnexion> => {
  if (FOURNISSEUR === "aucun") {
    return {
      ok: false,
      message:
        "Aucun service d'authentification n'est configuré. Le panel restera inaccessible tant que l'API n'aura pas été mise en service.",
    };
  }

  if (FOURNISSEUR === "atelier") {
    // Mode atelier — développement local, ou recette explicitement configurée.
    await new Promise((r) => setTimeout(r, 400)); // simule la latence réseau
    if (!email.trim()) {
      return { ok: false, message: "Renseignez un identifiant." };
    }
    if (CODE_ATELIER) {
      if (motDePasse !== CODE_ATELIER) {
        return { ok: false, message: "Code d'accès incorrect." };
      }
    } else if (motDePasse.length < 4) {
      return { ok: false, message: "Mot de passe d'au moins 4 caractères." };
    }
    session = { nom: email.split("@")[0], email, role: "administrateur" };
    try {
      sessionStorage.setItem(CLE, JSON.stringify(session));
    } catch {
      /* stockage indisponible — la session vivra en mémoire seulement */
    }
    notifier();
    return { ok: true };
  }

  /*
   * Fournisseur `serveur` — la vraie authentification.
   *
   * Rien n'est vérifié ici : le mot de passe part au serveur, qui le compare à
   * une empreinte bcrypt et pose un cookie `HttpOnly`. Ce module ne fait que
   * mémoriser QUI est connecté, pour l'afficher — l'autorité est le cookie, que
   * le JavaScript de la page ne peut ni lire ni fabriquer.
   *
   * Import différé : sans lui, le module réseau partirait dans le même morceau
   * de code que l'écran de connexion, alors qu'il n'a aucune raison d'être
   * chargé dans les autres modes.
   */
  try {
    const { session: api } = await import("./serveur/depotHttp");
    session = await api.connexion(email, motDePasse);
    notifier();
    return { ok: true };
  } catch (e) {
    /*
     * Le message vient du serveur et est déjà rédigé pour être affiché. On ne
     * le reformule pas : lui seul sait ce qui s'est passé, et une reformulation
     * finirait par mentir — « mot de passe incorrect » sur un compte désactivé,
     * par exemple.
     */
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Connexion impossible. Réessayez dans un instant.";
    return { ok: false, message };
  }
};
