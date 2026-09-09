import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";

/**
 * ---------------------------------------------------------------------------
 * ERREURS
 * ---------------------------------------------------------------------------
 *
 * Une seule forme de réponse en échec, imposée par CONTRAT.md § 2 :
 *
 *     { "erreur": "code_machine", "message": "Phrase affichable." }
 *
 * Le `message` est écrit pour être MONTRÉ à l'éditeur. Il ne doit jamais
 * contenir de trace technique, de requête SQL ni de nom de table : ces
 * détails renseignent un attaquant sur la structure du système et n'aident
 * en rien la personne devant l'écran.
 */

export type CodeErreur =
  | "donnees_invalides"
  | "non_connecte"
  | "droit_insuffisant"
  | "introuvable"
  | "conflit"
  | "fichier_trop_lourd"
  | "trop_de_tentatives"
  | "erreur_serveur";

const STATUTS: Record<CodeErreur, number> = {
  donnees_invalides: 400,
  non_connecte: 401,
  droit_insuffisant: 403,
  introuvable: 404,
  conflit: 409,
  fichier_trop_lourd: 413,
  trop_de_tentatives: 429,
  erreur_serveur: 500,
};

export class ErreurHttp extends Error {
  constructor(
    readonly code: CodeErreur,
    message: string,
    /** Sur un conflit, la version que le serveur détient. */
    readonly distant?: unknown
  ) {
    super(message);
    this.name = "ErreurHttp";
  }

  get statut() {
    return STATUTS[this.code];
  }
}

/* Raccourcis, pour que les routes se lisent comme des phrases. */
export const invalide = (m: string) => new ErreurHttp("donnees_invalides", m);
export const nonConnecte = () =>
  new ErreurHttp("non_connecte", "Votre session a expiré. Reconnectez-vous.");
export const interdit = (m = "Votre rôle ne permet pas cette action.") =>
  new ErreurHttp("droit_insuffisant", m);
export const introuvable = (m = "Cet élément n'existe pas ou a été supprimé.") =>
  new ErreurHttp("introuvable", m);
export const conflit = (m: string, distant?: unknown) =>
  new ErreurHttp("conflit", m, distant);

/**
 * Dernier filet. Express 5 y achemine aussi les rejets des gestionnaires
 * asynchrones, ce qui évite d'entourer chaque route d'un `try/catch`.
 */
export const middlewareErreurs = (
  e: unknown,
  _req: Request,
  res: Response,
  suivant: NextFunction
) => {
  if (res.headersSent) return suivant(e);

  if (e instanceof ErreurHttp) {
    return res
      .status(e.statut)
      .json({ erreur: e.code, message: e.message, distant: e.distant });
  }

  // Erreur imprévue : la trace complète va au journal du serveur, jamais au
  // client. En développement, on la renvoie quand même — chercher une panne
  // sans message est une perte de temps, et il n'y a personne à protéger.
  console.error("[erreur]", e);

  const message =
    config.environnement === "developpement" && e instanceof Error
      ? e.message
      : "Le serveur a rencontré une erreur. Réessayez dans un instant.";

  res.status(500).json({ erreur: "erreur_serveur", message });
};

/** Route inconnue. Renvoyée en JSON, comme tout le reste. */
export const middlewareIntrouvable = (_req: Request, res: Response) => {
  res.status(404).json({
    erreur: "introuvable",
    message: "Cette adresse n'existe pas sur ce serveur.",
  });
};
