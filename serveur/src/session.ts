import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { requete, uneLigne } from "./bd.js";
import { interdit, nonConnecte } from "./erreurs.js";

/**
 * ---------------------------------------------------------------------------
 * SESSIONS ET DROITS
 * ---------------------------------------------------------------------------
 *
 * Le cookie contient un jeton aléatoire. La base ne stocke que son EMPREINTE :
 * si le contenu de la base fuite un jour, les sessions en cours ne sont pas
 * utilisables pour autant — il manque le jeton lui-même, qui n'existe que dans
 * le navigateur de la personne connectée.
 *
 * Pas de JWT : un jeton signé reste valide jusqu'à son expiration et ne peut
 * pas être rappelé. Une session en base se supprime, donc se révoque — après
 * un départ, un vol de poste, ou un doute.
 */

export type Role = "administrateur" | "redacteur" | "relecteur";

export type Utilisateur = {
  id: string;
  email: string;
  nom: string;
  role: Role;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: { id: string; utilisateur: string };
      utilisateur?: Utilisateur;
    }
  }
}

const NOM_COOKIE = "ms_session";

/* ========================================================================= */
/* Mots de passe                                                             */
/* ========================================================================= */

export const hacher = (motDePasse: string) =>
  bcrypt.hash(motDePasse, config.session.coutBcrypt);

/**
 * Empreinte factice, utilisée quand l'e-mail est inconnu.
 *
 * Sans elle, une adresse inexistante répondrait instantanément alors qu'une
 * adresse connue prendrait les ~250 ms de bcrypt. En chronométrant, on
 * dresserait la liste des comptes existants avant même de s'attaquer aux mots
 * de passe. On vérifie donc toujours quelque chose.
 */
const LEURRE = bcrypt.hashSync("aucun compte ne porte ce mot de passe", 12);

export const verifierMotDePasse = async (motDePasse: string, empreinte: string | null) =>
  bcrypt.compare(motDePasse, empreinte ?? LEURRE);

/* ========================================================================= */
/* Jetons                                                                    */
/* ========================================================================= */

const empreinteJeton = (jeton: string) =>
  createHash("sha256").update(jeton + config.session.secret).digest("hex");

/**
 * Comparaison à durée constante.
 *
 * Une comparaison ordinaire s'arrête au premier caractère différent : sa durée
 * dépend donc du nombre de caractères corrects, ce qui permet de reconstituer
 * une valeur secret par tâtonnement. Ici, les longueurs sont toujours égales
 * (empreintes hexadécimales), mais le contrôle reste pour que la propriété
 * survive à une modification.
 */
const memeValeur = (a: string, b: string) => {
  const ta = Buffer.from(a);
  const tb = Buffer.from(b);
  return ta.length === tb.length && timingSafeEqual(ta, tb);
};

/* ========================================================================= */
/* Cookies                                                                   */
/* ========================================================================= */

/** Analyse l'en-tête `Cookie`. Aucune dépendance pour cinq lignes. */
const lireCookie = (req: Request, nom: string): string | null => {
  const brut = req.headers.cookie;
  if (!brut) return null;
  for (const morceau of brut.split(";")) {
    const coupe = morceau.indexOf("=");
    if (coupe === -1) continue;
    if (morceau.slice(0, coupe).trim() === nom) {
      return decodeURIComponent(morceau.slice(coupe + 1).trim());
    }
  }
  return null;
};

const poserCookie = (res: Response, jeton: string, dureeMs: number) => {
  const attributs = [
    `${NOM_COOKIE}=${encodeURIComponent(jeton)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(dureeMs / 1000)}`,
  ];
  // `Secure` empêche le cookie de circuler en clair. En développement local,
  // l'adresse est en http:// et le navigateur refuserait alors le cookie.
  if (config.environnement === "production") attributs.push("Secure");
  res.setHeader("Set-Cookie", attributs.join("; "));
};

const retirerCookie = (res: Response) => {
  res.setHeader(
    "Set-Cookie",
    `${NOM_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
};

/* ========================================================================= */
/* Ouverture et fermeture                                                    */
/* ========================================================================= */

export const ouvrirSession = async (
  res: Response,
  utilisateur: string,
  ip: string,
  agent: string
) => {
  const jeton = randomBytes(32).toString("base64url");
  const dureeMs = config.session.dureeH * 3600 * 1000;

  await requete(
    `INSERT INTO sessions (utilisateur, empreinte_jeton, expire_le, ip, agent)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval, $4, $5)`,
    [utilisateur, empreinteJeton(jeton), String(config.session.dureeH), ip || null, agent.slice(0, 400)]
  );

  poserCookie(res, jeton, dureeMs);
};

export const fermerSession = async (req: Request, res: Response) => {
  const jeton = lireCookie(req, NOM_COOKIE);
  if (jeton) {
    // On supprime la ligne, on ne la marque pas expirée : une session fermée
    // n'a aucune raison de survivre en base.
    await requete(`DELETE FROM sessions WHERE empreinte_jeton = $1`, [empreinteJeton(jeton)]);
  }
  retirerCookie(res);
};

/** Ferme toutes les sessions d'un compte — désactivation, changement de rôle. */
export const fermerToutesLesSessions = (utilisateur: string) =>
  requete(`DELETE FROM sessions WHERE utilisateur = $1`, [utilisateur]);

/* ========================================================================= */
/* Middlewares                                                               */
/* ========================================================================= */

type LigneSession = {
  session_id: string;
  utilisateur: string;
  email: string;
  nom: string;
  role: Role;
  actif: boolean;
  empreinte_jeton: string;
};

/**
 * Identifie le demandeur, sans exiger qu'il soit connecté.
 *
 * Placé avant toutes les routes : les routes publiques (connexion) doivent
 * pouvoir s'exécuter sans session, et `GET /api/session` doit pouvoir répondre
 * « personne » sans que ce soit une erreur.
 */
export const identifier = async (req: Request, _res: Response, suivant: NextFunction) => {
  const jeton = lireCookie(req, NOM_COOKIE);
  if (!jeton) return suivant();

  const empreinte = empreinteJeton(jeton);

  const l = await uneLigne<LigneSession>(
    `SELECT s.id AS session_id, s.empreinte_jeton, u.id AS utilisateur,
            u.email, u.nom, u.role, u.actif
       FROM sessions s
       JOIN utilisateurs u ON u.id = s.utilisateur
      WHERE s.empreinte_jeton = $1 AND s.expire_le > now()`,
    [empreinte]
  );

  // Un compte désactivé garde son cookie : c'est ici qu'on l'arrête, à chaque
  // requête, et non seulement à la connexion.
  if (!l || !l.actif || !memeValeur(l.empreinte_jeton, empreinte)) return suivant();

  req.session = { id: l.session_id, utilisateur: l.utilisateur };
  req.utilisateur = { id: l.utilisateur, email: l.email, nom: l.nom, role: l.role };
  suivant();
};

/** Exige une session valide. */
export const connecte = (req: Request, _res: Response, suivant: NextFunction) => {
  if (!req.utilisateur) throw nonConnecte();
  suivant();
};

/**
 * Exige un rôle.
 *
 * ⚠️ C'est ICI que se joue la sécurité, pas dans le panel. Le panel masque des
 * boutons pour le confort ; un bouton masqué reste appelable en écrivant la
 * requête à la main.
 */
export const exigeRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, suivant: NextFunction) => {
    if (!req.utilisateur) throw nonConnecte();
    if (!roles.includes(req.utilisateur.role)) throw interdit();
    suivant();
  };

/** Peut écrire un brouillon. */
export const peutEcrire = exigeRole("administrateur", "redacteur");

/** Peut publier, gérer les comptes, supprimer. */
export const estAdministrateur = exigeRole("administrateur");

/** Ménage : les sessions expirées n'ont pas à s'accumuler. */
export const purgerSessions = () =>
  requete(`DELETE FROM sessions WHERE expire_le < now()`);
