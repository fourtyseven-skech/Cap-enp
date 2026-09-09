import type { Request } from "express";
import { requete } from "./bd.js";
import { adresse } from "./securite.js";

/**
 * ---------------------------------------------------------------------------
 * JOURNAL D'ACTIVITÉ
 * ---------------------------------------------------------------------------
 *
 * Écrit par le serveur, à partir de ce qu'il CONSTATE — jamais à partir de ce
 * que le navigateur annonce. C'est toute la différence avec le journal
 * précédent, qui vivait dans le navigateur et se vidait d'un clic.
 *
 * L'e-mail est stocké en texte et non en référence vers `utilisateurs` : la
 * trace doit survivre à la suppression du compte. Sans cela, effacer un compte
 * effacerait l'historique de ce qu'il a fait — exactement ce que quelqu'un qui
 * aurait des choses à cacher chercherait à faire.
 *
 * La base refuse toute modification et toute suppression de cette table
 * (règles `DO INSTEAD NOTHING` de schema.sql). Il n'existe donc volontairement
 * aucune fonction de mise à jour ici.
 */

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
  /* Changement, réinitialisation, ou demande de lien. Jamais le mot de passe
     lui-même ni le jeton : le journal est lisible par les administrateurs. */
  | "mot-de-passe"
  | "remplacement-global"
  | "redirection"
  | "export";

/**
 * Inscrit une entrée.
 *
 * Ne lève jamais. Un échec d'écriture du journal ne doit pas faire échouer
 * l'opération qu'il décrit : perdre une ligne de journal est regrettable,
 * refuser une publication parce que le journal est indisponible le serait
 * davantage. L'échec part dans la sortie du serveur, où la supervision le voit.
 */
export const tracer = async (
  req: Request,
  action: Action,
  cible: string,
  detail?: string
): Promise<void> => {
  const acteur = req.utilisateur?.email ?? "anonyme";
  try {
    await requete(
      `INSERT INTO journal (acteur, action, cible, detail, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [acteur, action, cible.slice(0, 300), detail?.slice(0, 500) ?? null, adresse(req) || null]
    );
  } catch (e) {
    console.error("[journal] entrée perdue :", action, cible, e);
  }
};

/**
 * Trace une action dont l'acteur n'est pas encore identifié — typiquement une
 * connexion refusée, où il n'y a pas de session mais où l'on connaît l'adresse
 * saisie. C'est justement l'entrée la plus utile en cas d'attaque.
 */
export const tracerAnonyme = async (
  req: Request,
  acteur: string,
  action: Action,
  cible: string,
  detail?: string
): Promise<void> => {
  try {
    await requete(
      `INSERT INTO journal (acteur, action, cible, detail, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [acteur.slice(0, 200), action, cible.slice(0, 300), detail?.slice(0, 500) ?? null, adresse(req) || null]
    );
  } catch (e) {
    console.error("[journal] entrée perdue :", action, cible, e);
  }
};

export type EntreeJournal = {
  id: string;
  date: string;
  acteur: string;
  action: Action;
  cible: string;
  detail: string | null;
};

/** Les dernières entrées, les plus récentes d'abord. */
export const listerJournal = (limite = 400) =>
  requete<EntreeJournal>(
    `SELECT id::text, date, acteur, action, cible, detail
       FROM journal ORDER BY date DESC LIMIT $1`,
    [Math.min(limite, 1000)]
  );
