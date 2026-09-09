import { randomBytes } from "node:crypto";
import { Router } from "express";
import { parametre } from "../parametre.js";
import { requete, uneLigne } from "../bd.js";
import { config } from "../config.js";
import { envoyerInvitation, smtpConfigure } from "../courriel.js";
import { introuvable, invalide } from "../erreurs.js";
import { listerJournal, tracer, tracerAnonyme } from "../journal.js";
import { oublierUtilisateur } from "../presence.js";
import { demanderPublication, listerPublications, obtenirPublication } from "../publication.js";
import { adresse, autoriser, oublier, tropDeTentatives } from "../securite.js";
import {
  connecte,
  estAdministrateur,
  fermerSession,
  fermerToutesLesSessions,
  hacher,
  ouvrirSession,
  verifierMotDePasse,
  type Role,
} from "../session.js";
import {
  schemaChangementMdp,
  schemaConnexion,
  schemaModifUtilisateur,
  schemaUtilisateur,
  valider,
} from "../validation.js";

/**
 * ---------------------------------------------------------------------------
 * CONNEXION, COMPTES, JOURNAL, PUBLICATIONS
 * ---------------------------------------------------------------------------
 * Implémente CONTRAT.md § 3, § 5 et § 7.
 */

export const routesAuth = Router();
export const routesComptes = Router();
export const routesJournal = Router();
export const routesPublications = Router();

/* ========================================================================= */
/* Connexion                                                                 */
/* ========================================================================= */

routesAuth.post("/connexion", async (req, res) => {
  const { email, motDePasse } = valider(schemaConnexion, req.body);
  const normalise = email.trim().toLowerCase();

  /*
   * Double limitation : par adresse IP ET par e-mail (CONTRAT.md § 7).
   *
   * Par IP seule, un attaquant réparti sur plusieurs adresses passe au travers.
   * Par e-mail seul, il lui suffit de viser plusieurs comptes. Il faut les deux.
   */
  const parIp = `connexion:ip:${adresse(req)}`;
  const parEmail = `connexion:email:${normalise}`;
  if (!autoriser(parIp, 5, 15 * 60_000) || !autoriser(parEmail, 5, 15 * 60_000)) {
    await tracerAnonyme(req, normalise, "connexion-refusee", "quota", "Trop de tentatives");
    throw tropDeTentatives(
      "Trop de tentatives de connexion. Réessayez dans une quinzaine de minutes."
    );
  }

  const u = await uneLigne<{
    id: string;
    email: string;
    nom: string;
    role: Role;
    empreinte_mdp: string;
    actif: boolean;
  }>(
    `SELECT id::text, email, nom, role, empreinte_mdp, actif
       FROM utilisateurs WHERE lower(email) = $1`,
    [normalise]
  );

  /*
   * On vérifie TOUJOURS un mot de passe, même quand le compte est inconnu.
   *
   * Sans cela, une adresse inexistante répondrait instantanément là où une
   * adresse connue prendrait les ~250 ms de bcrypt. En chronométrant les
   * réponses, on dresserait la liste des comptes avant même de s'attaquer aux
   * mots de passe. `verifierMotDePasse` compare alors à une empreinte factice.
   */
  const correct = await verifierMotDePasse(motDePasse, u?.empreinte_mdp ?? null);

  if (!u || !correct || !u.actif) {
    await tracerAnonyme(
      req,
      normalise,
      "connexion-refusee",
      "panel",
      !u ? "Compte inconnu" : !u.actif ? "Compte désactivé" : "Mot de passe incorrect"
    );
    /*
     * Une seule et même réponse dans les trois cas. Distinguer « compte
     * inconnu » de « mot de passe incorrect » indiquerait quelles adresses
     * existent. Le journal, lui, garde le détail — il n'est lu que par un
     * administrateur.
     */
    throw new (await import("../erreurs.js")).ErreurHttp(
      "non_connecte",
      "Identifiant ou mot de passe incorrect."
    );
  }

  oublier(parIp);
  oublier(parEmail);

  await ouvrirSession(res, u.id, adresse(req), String(req.headers["user-agent"] ?? ""));
  await requete(`UPDATE utilisateurs SET derniere_connexion = now() WHERE id = $1`, [u.id]);

  req.utilisateur = { id: u.id, email: u.email, nom: u.nom, role: u.role };
  await tracer(req, "connexion", "panel");

  res.json({ nom: u.nom, email: u.email, role: u.role });
});

routesAuth.post("/deconnexion", async (req, res) => {
  if (req.utilisateur) {
    await tracer(req, "deconnexion", "panel");
    /* Ses présences s'éteignent tout de suite. Elles finiraient par expirer
       seules au bout de quatre-vingt-dix secondes, mais afficher « Amel a cet
       article ouvert » alors qu'Amel vient de se déconnecter ferait douter de
       tout le reste de l'indication. */
    oublierUtilisateur(req.utilisateur.id);
  }
  await fermerSession(req, res);
  res.sendStatus(204);
});

/** L'utilisateur courant. Appelé au chargement du panel. */
routesAuth.get("/session", (req, res) => {
  if (!req.utilisateur) {
    // 401 et non 404 : le panel doit afficher l'écran de connexion, pas une
    // erreur. Ce n'est pas une anomalie, c'est le cas d'une première visite.
    res.status(401).json({ erreur: "non_connecte", message: "Aucune session en cours." });
    return;
  }
  const { nom, email, role } = req.utilisateur;
  res.json({ nom, email, role });
});

/* ========================================================================= */
/* Mot de passe                                                              */
/* ========================================================================= */

/**
 * CHANGER SON PROPRE MOT DE PASSE.
 *
 * ⚠️ IL N'EXISTE VOLONTAIREMENT AUCUN « MOT DE PASSE OUBLIÉ ».
 *
 * Décision du client, et elle se défend : un panel d'administration n'est pas
 * un site grand public. Un formulaire public de récupération y ajoute une
 * surface d'attaque — envoi de courriels déclenchable par un inconnu, jetons
 * qui traînent dans des boîtes aux lettres — pour un besoin qui se produit
 * deux fois par an, chez trois personnes qui se connaissent.
 *
 * Un compte qui perd son mot de passe est repris en main par un
 * administrateur, directement en base. C'est plus lent, et c'est voulu.
 *
 * Il manquait, et c'était bloquant : un compte créé recevait un mot de passe
 * provisoire qu'il n'avait aucun moyen de remplacer. « Provisoire » était donc
 * un mot sans suite.
 *
 * Le mot de passe actuel est redemandé — sinon un écran laissé ouvert dans un
 * bureau suffit à prendre le compte définitivement.
 */
routesAuth.post("/mot-de-passe", connecte, async (req, res) => {
  const { actuel, nouveau } = valider(schemaChangementMdp, req.body);

  const u = await uneLigne<{ id: string; empreinte_mdp: string }>(
    `SELECT id::text, empreinte_mdp FROM utilisateurs WHERE id = $1`,
    [req.utilisateur!.id]
  );
  if (!(await verifierMotDePasse(actuel, u?.empreinte_mdp ?? null))) {
    throw invalide("Le mot de passe actuel ne correspond pas.");
  }
  if (actuel === nouveau) throw invalide("Le nouveau mot de passe est identique à l'ancien.");

  await requete(`UPDATE utilisateurs SET empreinte_mdp = $2 WHERE id = $1`, [
    req.utilisateur!.id,
    await hacher(nouveau),
  ]);

  /*
   * Toutes les autres sessions tombent, y compris celles ouvertes ailleurs.
   * C'est le geste que l'on attend d'un changement de mot de passe : si on le
   * change parce qu'on le croit connu, laisser les sessions ouvertes ne
   * protège de rien. La session courante est rouverte dans la foulée.
   */
  await fermerToutesLesSessions(req.utilisateur!.id);
  await ouvrirSession(res, req.utilisateur!.id, adresse(req), String(req.headers["user-agent"] ?? ""));

  await tracer(req, "mot-de-passe", req.utilisateur!.email, "Changé par son propriétaire");
  res.sendStatus(204);
});

/* ========================================================================= */
/* Comptes                                                                   */
/* ========================================================================= */

const CHAMPS_U = `id::text, email, nom, role, actif, cree_le, derniere_connexion`;

routesComptes.get("/", estAdministrateur, async (_req, res) => {
  res.json(await requete(`SELECT ${CHAMPS_U} FROM utilisateurs ORDER BY nom`));
});

routesComptes.post("/", estAdministrateur, async (req, res) => {
  const { nom, email, role } = valider(schemaUtilisateur, req.body);

  const existe = await uneLigne(`SELECT 1 FROM utilisateurs WHERE lower(email) = $1`, [
    email.toLowerCase(),
  ]);
  if (existe) throw invalide("Un compte utilise déjà cette adresse.");

  /*
   * Mot de passe provisoire aléatoire, JAMAIS choisi par l'administrateur.
   *
   * Il n'est pas renvoyé dans la réponse : sans service d'envoi d'e-mails
   * (voir CONTRAT.md § 10), il faut le communiquer de vive voix. Le générer
   * aléatoirement évite le réflexe du « Megasoft2026 » attribué à tout le
   * monde, qui est le vrai risque ici.
   */
  const provisoire = randomBytes(12).toString("base64url");

  const u = await uneLigne(
    `INSERT INTO utilisateurs (nom, email, role, empreinte_mdp)
     VALUES ($1, $2, $3, $4) RETURNING ${CHAMPS_U}`,
    [nom, email, role, await hacher(provisoire)]
  );

  /*
   * L'invitation part si un service d'envoi est configuré — et son échec
   * n'annule jamais la création : le compte existe, le mot de passe provisoire
   * est renvoyé ci-dessous, et l'administrateur peut le transmettre lui-même.
   * Transformer une panne de messagerie en panne d'administration serait pire
   * que l'absence de courriel.
   */
  const envoi = smtpConfigure
    ? await envoyerInvitation(
        email,
        nom,
        provisoire,
        (config.smtp.adressePanel || config.origineAutorisee).replace(/\/$/, "") + "/admin"
      )
    : { envoye: false, raison: "Aucun service d'envoi n'est configuré." };

  await tracer(
    req,
    "role-modifie",
    email,
    `Compte créé — ${role}${envoi.envoye ? ", invitation envoyée" : ""}`
  );

  // Affiché une seule fois, dans la réponse à la création. Le serveur ne le
  // conserve nulle part : seule son empreinte est en base.
  //
  // Il est renvoyé MÊME quand l'invitation est partie : un courriel peut
  // arriver dans les indésirables, et l'administrateur doit garder de quoi
  // dépanner sans repasser par une réinitialisation.
  res.status(201).json({
    ...u,
    motDePasseProvisoire: provisoire,
    courrielEnvoye: envoi.envoye,
    courrielRaison: envoi.envoye ? undefined : envoi.raison,
  });
});

routesComptes.patch("/:id", estAdministrateur, async (req, res) => {
  const champs = valider(schemaModifUtilisateur, req.body);

  const cible = await uneLigne<{ email: string; role: Role; actif: boolean }>(
    `SELECT email, role, actif FROM utilisateurs WHERE id = $1`,
    [parametre(req, "id")]
  );
  if (!cible) throw introuvable("Ce compte n'existe pas.");

  /*
   * On ne peut pas se retirer à soi-même le rôle d'administrateur, ni se
   * désactiver. Sans ce garde-fou, une fausse manœuvre peut laisser le panel
   * sans aucun administrateur — situation qui ne se répare qu'en écrivant
   * directement dans la base.
   */
  if (parametre(req, "id") === req.utilisateur!.id) {
    if (champs.role && champs.role !== "administrateur") {
      throw invalide("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
    }
    if (champs.actif === false) {
      throw invalide("Vous ne pouvez pas désactiver votre propre compte.");
    }
  }

  // Il doit rester au moins un administrateur actif.
  if ((champs.role && champs.role !== "administrateur") || champs.actif === false) {
    if (cible.role === "administrateur" && cible.actif) {
      const restants = await uneLigne<{ n: string }>(
        `SELECT count(*)::text AS n FROM utilisateurs
          WHERE role = 'administrateur' AND actif AND id <> $1`,
        [parametre(req, "id")]
      );
      if (Number(restants?.n ?? 0) === 0) {
        throw invalide(
          "C'est le dernier administrateur actif. Nommez-en un autre avant de modifier celui-ci."
        );
      }
    }
  }

  const u = await uneLigne(
    `UPDATE utilisateurs SET
        nom   = COALESCE($2, nom),
        role  = COALESCE($3, role),
        actif = COALESCE($4, actif)
      WHERE id = $1 RETURNING ${CHAMPS_U}`,
    [parametre(req, "id"), champs.nom ?? null, champs.role ?? null, champs.actif ?? null]
  );

  /*
   * Un changement de rôle ou une désactivation ferme les sessions en cours.
   *
   * Sinon, la personne garde ses anciens droits jusqu'à l'expiration de son
   * cookie — parfois douze heures. Retirer un droit doit prendre effet
   * immédiatement, sans quoi la mesure n'en est pas une.
   */
  if (champs.role || champs.actif === false) {
    await fermerToutesLesSessions(parametre(req, "id"));
  }

  await tracer(
    req,
    "role-modifie",
    cible.email,
    champs.actif === false ? "Compte désactivé" : `Rôle : ${champs.role ?? cible.role}`
  );
  res.json(u);
});

routesComptes.delete("/:id", estAdministrateur, async (req, res) => {
  if (parametre(req, "id") === req.utilisateur!.id) {
    throw invalide("Vous ne pouvez pas supprimer votre propre compte.");
  }

  const u = await uneLigne<{ email: string; role: Role; actif: boolean }>(
    `SELECT email, role, actif FROM utilisateurs WHERE id = $1`,
    [parametre(req, "id")]
  );
  if (!u) throw introuvable("Ce compte n'existe pas.");

  if (u.role === "administrateur" && u.actif) {
    const restants = await uneLigne<{ n: string }>(
      `SELECT count(*)::text AS n FROM utilisateurs
        WHERE role = 'administrateur' AND actif AND id <> $1`,
      [parametre(req, "id")]
    );
    if (Number(restants?.n ?? 0) === 0) {
      throw invalide("C'est le dernier administrateur actif : il ne peut pas être supprimé.");
    }
  }

  await requete(`DELETE FROM utilisateurs WHERE id = $1`, [parametre(req, "id")]);

  // Le journal conserve l'e-mail en texte : la trace de ce que ce compte a
  // fait survit à sa suppression. C'est voulu.
  await tracer(req, "role-modifie", u.email, "Compte supprimé");
  res.sendStatus(204);
});

/* ========================================================================= */
/* Journal                                                                   */
/* ========================================================================= */

routesJournal.get("/", estAdministrateur, async (req, res) => {
  const limite = Number(req.query.limite);
  res.json(await listerJournal(Number.isFinite(limite) ? limite : 400));
});

/* ========================================================================= */
/* Publications                                                              */
/* ========================================================================= */

/**
 * DEMANDER UNE RECONSTRUCTION DU SITE.
 *
 * Elle manquait, et son absence a produit le défaut le plus visible du
 * 6 septembre 2026 : le panel enregistrait « publié » en base, l'article
 * apparaissait dans la liste avec le bon statut… et le site ne changeait pas.
 * Le blog restait figé sur ses cinq articles, sans le moindre message d'erreur,
 * parce que personne ne demandait jamais au serveur de reconstruire.
 *
 * `POST /:slug/publier` le faisait déjà, mais le panel ne l'appelait pas : il
 * passait par l'enregistrement ordinaire (`PUT`), qui écrit sans reconstruire.
 * Plutôt que d'obliger chaque écran à connaître la bonne route, on expose ici
 * le geste lui-même — « remets le site à jour » — que l'éditeur appelle après
 * toute écriture qui change ce que voit un visiteur.
 *
 * Réservé aux administrateurs : une reconstruction consomme la machine, et
 * mettre en ligne est déjà une prérogative d'administrateur.
 */
routesPublications.post("/", estAdministrateur, async (req, res) => {
  res.status(202).json(await demanderPublication(req.utilisateur!.id));
});

routesPublications.get("/", async (_req, res) => {
  res.json(await listerPublications());
});

routesPublications.get("/:id", async (req, res) => {
  const p = await obtenirPublication(parametre(req, "id"));
  if (!p) throw introuvable("Cette publication n'existe pas.");
  res.json(p);
});
