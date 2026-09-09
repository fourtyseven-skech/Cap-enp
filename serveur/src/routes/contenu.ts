import { Router } from "express";
import { parametre } from "../parametre.js";
import { requete, transaction, uneLigne } from "../bd.js";
import { conflit, introuvable, invalide } from "../erreurs.js";
import { tracer } from "../journal.js";
import { demanderPublication } from "../publication.js";
import { estAdministrateur, peutEcrire } from "../session.js";
import { schemaContenu, valider } from "../validation.js";

/**
 * ---------------------------------------------------------------------------
 * CONTENU DES PAGES
 * ---------------------------------------------------------------------------
 *
 * Ce qui rendra la page d'accueil éditable. Chaque section est une ligne :
 * « accueil.hero », « accueil.chiffres », « commun.pied »…
 *
 * DEUX COLONNES, ET C'EST TOUT LE SUJET
 * -------------------------------------
 *   · `donnees`   — la version PUBLIÉE, celle que lit la reconstruction ;
 *   · `brouillon` — la version en cours d'édition, invisible du public.
 *
 * L'éditeur doit pouvoir retravailler la page d'accueil sur plusieurs jours
 * sans que le site s'en aperçoive. Publier est un geste distinct, réservé à
 * l'administrateur — et réversible, puisque chaque publication laisse une
 * version dans l'historique.
 *
 * Implémente CONTRAT.md § 5.
 */

export const routesContenu = Router();

const CHAMPS = `cle, libelle, donnees, brouillon, schema_version, maj_le,
                (SELECT email FROM utilisateurs WHERE id = c.maj_par) AS maj_par`;

routesContenu.get("/", async (_req, res) => {
  res.json(await requete(`SELECT ${CHAMPS} FROM contenu_pages c ORDER BY cle`));
});

routesContenu.get("/:cle", async (req, res) => {
  const c = await uneLigne(`SELECT ${CHAMPS} FROM contenu_pages c WHERE cle = $1`, [
    parametre(req, "cle"),
  ]);
  if (!c) throw introuvable("Cette section n'existe pas.");
  res.setHeader("ETag", new Date(c.maj_le as Date).toISOString());
  res.json(c);
});

routesContenu.get("/:cle/versions", async (req, res) => {
  res.json(
    await requete(
      `SELECT v.id::text, v.donnees, v.cree_le,
              COALESCE(u.email, 'compte supprimé') AS acteur
         FROM contenu_versions v
         LEFT JOIN utilisateurs u ON u.id = v.acteur
        WHERE v.cle = $1
        ORDER BY v.cree_le DESC LIMIT 50`,
      [parametre(req, "cle")]
    )
  );
});

/* ========================================================================= */
/* Écriture du brouillon                                                     */
/* ========================================================================= */

routesContenu.put("/:cle", peutEcrire, async (req, res) => {
  const donnees = valider(schemaContenu, req.body);

  const actuel = await uneLigne<{ maj_le: Date }>(
    `SELECT maj_le FROM contenu_pages WHERE cle = $1`,
    [parametre(req, "cle")]
  );
  if (!actuel) throw introuvable("Cette section n'existe pas.");

  // Même contrôle de concurrence que pour les articles (CONTRAT.md § 6).
  const recu = req.headers["if-match"];
  if (!recu || typeof recu !== "string") {
    throw invalide(
      "Modification refusée : la version de départ n'a pas été transmise. Rechargez la page."
    );
  }
  const fourni = new Date(recu.replace(/^W\/|"/g, "").trim()).getTime();
  if (!Number.isFinite(fourni) || fourni !== actuel.maj_le.getTime()) {
    const complet = await uneLigne(`SELECT ${CHAMPS} FROM contenu_pages c WHERE cle = $1`, [
      parametre(req, "cle"),
    ]);
    throw conflit(
      "Cette section a été modifiée entre-temps par quelqu'un d'autre. " +
        "Comparez les deux versions avant d'enregistrer.",
      complet
    );
  }

  const maj = await uneLigne(
    `UPDATE contenu_pages
        SET brouillon = $2, maj_le = now(), maj_par = $3
      WHERE cle = $1
      RETURNING ${CHAMPS.replace(/c\.maj_par/g, "contenu_pages.maj_par")}`,
    [parametre(req, "cle"), JSON.stringify(donnees), req.utilisateur!.id]
  );

  await tracer(req, "modification", parametre(req, "cle"), "Brouillon enregistré");
  res.setHeader("ETag", new Date(maj!.maj_le as Date).toISOString());
  res.json(maj);
});

/* ========================================================================= */
/* Publication et abandon                                                    */
/* ========================================================================= */

routesContenu.post("/:cle/publier", estAdministrateur, async (req, res) => {
  const c = await uneLigne<{ brouillon: unknown; libelle: string }>(
    `SELECT brouillon, libelle FROM contenu_pages WHERE cle = $1`,
    [parametre(req, "cle")]
  );
  if (!c) throw introuvable("Cette section n'existe pas.");
  if (c.brouillon === null) {
    throw invalide("Cette section n'a aucune modification en attente.");
  }

  await transaction(async (client) => {
    // L'historique enregistre ce qui EST PUBLIÉ, à l'instant où ça l'est.
    // Historiser le brouillon n'aurait pas de sens : ce qu'on veut pouvoir
    // restaurer, c'est un état qui a réellement été en ligne.
    await client.query(
      `INSERT INTO contenu_versions (cle, donnees, acteur) VALUES ($1, $2, $3)`,
      [parametre(req, "cle"), JSON.stringify(c.brouillon), req.utilisateur!.id]
    );
    await client.query(
      `UPDATE contenu_pages
          SET donnees = brouillon, brouillon = NULL, maj_le = now(), maj_par = $2
        WHERE cle = $1`,
      [parametre(req, "cle"), req.utilisateur!.id]
    );
    await client.query(
      `DELETE FROM contenu_versions WHERE cle = $1 AND id NOT IN (
         SELECT id FROM contenu_versions WHERE cle = $1 ORDER BY cree_le DESC LIMIT 20)`,
      [parametre(req, "cle")]
    );
  });

  await tracer(req, "publication", parametre(req, "cle"), c.libelle);
  res.json(await demanderPublication(req.utilisateur!.id));
});

routesContenu.post("/:cle/abandonner", peutEcrire, async (req, res) => {
  const c = await uneLigne(
    `UPDATE contenu_pages SET brouillon = NULL, maj_le = now(), maj_par = $2
      WHERE cle = $1 RETURNING cle, libelle`,
    [parametre(req, "cle"), req.utilisateur!.id]
  );
  if (!c) throw introuvable("Cette section n'existe pas.");
  await tracer(req, "modification", parametre(req, "cle"), "Brouillon abandonné");
  res.sendStatus(204);
});
