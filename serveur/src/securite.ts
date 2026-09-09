import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { ErreurHttp } from "./erreurs.js";

/**
 * ---------------------------------------------------------------------------
 * SÉCURITÉ DU TRANSPORT
 * ---------------------------------------------------------------------------
 *
 * Origine autorisée, en-têtes de protection, limitation de débit. Écrit à la
 * main plutôt qu'avec `cors` et `express-rate-limit` : les deux ont des
 * réglages par défaut permissifs, et ce sont exactement les endroits où une
 * valeur par défaut mal comprise devient une faille. Cinquante lignes lisibles
 * valent mieux qu'une configuration qu'on croit avoir comprise.
 */

/* ========================================================================= */
/* Origine                                                                   */
/* ========================================================================= */

/**
 * Une seule origine autorisée, celle du panel.
 *
 * On renvoie l'origine exacte et jamais `*` : avec `credentials: include`, le
 * navigateur refuse de toute façon le joker — mais surtout, un joker signifie
 * que n'importe quel site peut demander la page. `Vary: Origin` est
 * indispensable dès qu'un cache s'intercale, sans quoi il servirait la réponse
 * d'une origine à une autre.
 */
export const origine = (req: Request, res: Response, suivant: NextFunction) => {
  const demandeur = req.headers.origin;

  if (demandeur === config.origineAutorisee) {
    res.setHeader("Access-Control-Allow-Origin", demandeur);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, If-Match");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    // Sans quoi le panel ne peut pas lire l'étiquette de version.
    res.setHeader("Access-Control-Expose-Headers", "ETag");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  res.setHeader("Vary", "Origin");

  // La requête préliminaire du navigateur n'a rien à exécuter.
  if (req.method === "OPTIONS") return res.sendStatus(204);

  suivant();
};

/* ========================================================================= */
/* En-têtes de protection                                                    */
/* ========================================================================= */

export const entetes = (_req: Request, res: Response, suivant: NextFunction) => {
  // L'API ne renvoie que du JSON : elle n'a aucune raison d'être affichée dans
  // un cadre, ni d'être devinée comme un autre type par le navigateur.
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  // Une API ne charge rien : la politique la plus fermée possible convient.
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  // Les réponses contiennent des données d'administration. Aucun cache, nulle part.
  res.setHeader("Cache-Control", "no-store");

  if (config.environnement === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  suivant();
};

/* ========================================================================= */
/* Limitation de débit                                                       */
/* ========================================================================= */

/**
 * Compteur en mémoire, à fenêtre glissante grossière.
 *
 * LIMITE ASSUMÉE : il est propre au processus. Deux instances du serveur
 * doublent les quotas, et un redémarrage les remet à zéro. Pour un panel à
 * trois ou quatre personnes sur un seul processus, c'est suffisant, et cela
 * évite d'ajouter Redis pour compter jusqu'à cinq.
 *
 * Si le serveur passe un jour à plusieurs instances, ce compteur devra migrer
 * en base — sans quoi la protection de la connexion devient décorative.
 */
type Seau = { compte: number; expire: number };
const seaux = new Map<string, Seau>();

// Ménage périodique : sans lui, la table grossit à chaque nouvelle adresse IP
// et ne redescend jamais.
setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, s] of seaux) if (s.expire < maintenant) seaux.delete(cle);
}, 60_000).unref();

/**
 * @param cle      identifiant du compteur (IP, e-mail, session…)
 * @param maximum  tentatives autorisées dans la fenêtre
 * @param fenetreMs durée de la fenêtre
 * @returns `true` si l'appel est autorisé
 */
export const autoriser = (cle: string, maximum: number, fenetreMs: number): boolean => {
  const maintenant = Date.now();
  const s = seaux.get(cle);

  if (!s || s.expire < maintenant) {
    seaux.set(cle, { compte: 1, expire: maintenant + fenetreMs });
    return true;
  }
  if (s.compte >= maximum) return false;

  s.compte += 1;
  return true;
};

/** Efface un compteur — appelé après une connexion réussie. */
export const oublier = (cle: string) => seaux.delete(cle);

export const tropDeTentatives = (m: string) => new ErreurHttp("trop_de_tentatives", m);

/**
 * L'adresse du demandeur.
 *
 * Derrière un proxy (le cas sur tout hébergement mutualisé), `req.ip` est
 * l'adresse du proxy et non celle du visiteur : tout le monde partagerait
 * alors le même quota. On lit donc `X-Forwarded-For`, en prenant la PREMIÈRE
 * adresse — les suivantes sont les proxys traversés.
 *
 * ⚠️ Cet en-tête est fourni par le client et peut être forgé. Il n'est
 * digne de confiance que parce qu'Express est configuré avec `trust proxy` et
 * que le proxy de l'hébergeur le réécrit. Ne jamais s'en servir pour une
 * décision d'autorisation — uniquement pour compter.
 */
export const adresse = (req: Request): string => {
  const transmis = req.headers["x-forwarded-for"];
  const premier = Array.isArray(transmis) ? transmis[0] : transmis?.split(",")[0];
  return (premier ?? req.ip ?? "inconnue").trim();
};

/* ========================================================================= */
/* Quotas généraux                                                           */
/* ========================================================================= */

/** Écritures : 60 par minute et par session (CONTRAT.md § 7). */
export const limiterEcritures = (req: Request, _res: Response, suivant: NextFunction) => {
  if (req.method === "GET" || req.method === "OPTIONS") return suivant();

  /*
   * La PRÉSENCE est exclue du quota.
   *
   * Elle n'écrit rien de durable — une entrée dans une carte en mémoire — mais
   * elle bat toutes les trente secondes, et par écran ouvert. Comptée parmi
   * les écritures, elle consommerait le quota d'une personne qui, elle, n'a
   * rien fait d'autre que laisser un article ouvert. Une alarme qui sonne sur
   * un usage normal est une alarme qu'on cesse d'écouter le jour où elle a
   * raison.
   */
  if (req.path.startsWith("/api/presence")) return suivant();

  const cle = `ecriture:${req.session?.utilisateur ?? adresse(req)}`;
  if (!autoriser(cle, 60, 60_000)) {
    throw tropDeTentatives("Trop de modifications d'affilée. Patientez une minute.");
  }
  suivant();
};
