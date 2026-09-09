import { Router } from "express";
import { parametre } from "../parametre.js";
import type { Request, Response } from "express";
import { requete, transaction, uneLigne } from "../bd.js";
import { conflit, interdit, introuvable, invalide } from "../erreurs.js";
import { tracer } from "../journal.js";
import { demanderPublication } from "../publication.js";
import { estAdministrateur, peutEcrire } from "../session.js";
import { schemaArticle, slug as schemaSlug, valider, type EntreeArticle } from "../validation.js";

/**
 * ---------------------------------------------------------------------------
 * ARTICLES
 * ---------------------------------------------------------------------------
 * Implémente CONTRAT.md § 5.
 */

export const routesArticles = Router();

/** Les colonnes renvoyées au panel, dans la forme qu'il attend. */
const CHAMPS = `
  id::text, slug, titre, chapeau, corps, categorie, format, accent, motif,
  titre_fantome, reponse, version, exergue, meta_description, auteur,
  etiquettes, faq, statut,
  to_char(publie_le, 'YYYY-MM-DD') AS publie_le,
  maj_le, archive, supprime, maquette, image, cree_le`;

type LigneArticle = { slug: string; maj_le: Date; titre: string; statut: string };

/* ========================================================================= */
/* Concurrence                                                               */
/* ========================================================================= */

/**
 * Vérifie l'étiquette de version (CONTRAT.md § 6).
 *
 * L'étiquette vaut `maj_le`. On compare des instants et non des chaînes : le
 * panel renvoie la valeur telle qu'il l'a reçue en JSON, et une comparaison
 * textuelle échouerait sur un simple écart de format ou de fuseau — refusant
 * une écriture parfaitement légitime.
 *
 * Une écriture SANS `If-Match` est refusée. Un client qui oublie l'en-tête ne
 * doit pas obtenir par défaut le comportement le plus destructeur.
 */
const verifierEtiquette = (req: Request, majLe: Date, distant: unknown) => {
  const recu = req.headers["if-match"];
  if (!recu || typeof recu !== "string") {
    throw invalide(
      "Modification refusée : la version de départ n'a pas été transmise. Rechargez la page."
    );
  }

  const propre = recu.replace(/^W\/|"/g, "").trim();
  const attendu = majLe.getTime();
  const fourni = new Date(propre).getTime();

  if (!Number.isFinite(fourni) || fourni !== attendu) {
    throw conflit(
      "Cet élément a été modifié entre-temps par quelqu'un d'autre. " +
        "Comparez les deux versions avant d'enregistrer.",
      distant
    );
  }
};

/** Pose l'étiquette sur une réponse de lecture. */
const poserEtiquette = (res: Response, majLe: Date | string) => {
  res.setHeader("ETag", new Date(majLe).toISOString());
};

/* ========================================================================= */
/* Lecture                                                                   */
/* ========================================================================= */

routesArticles.get("/", async (req, res) => {
  const corbeille = req.query.corbeille === "1";
  const conditions = [corbeille ? "supprime" : "NOT supprime"];
  const params: unknown[] = [];

  if (typeof req.query.statut === "string" && req.query.statut) {
    params.push(req.query.statut);
    conditions.push(`statut = $${params.length}`);
  }
  if (typeof req.query.categorie === "string" && req.query.categorie) {
    params.push(req.query.categorie);
    conditions.push(`categorie = $${params.length}`);
  }

  const lignes = await requete(
    `SELECT ${CHAMPS} FROM articles
      WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(publie_le, cree_le::date) DESC, maj_le DESC`,
    params
  );
  res.json(lignes);
});

routesArticles.get("/:slug", async (req, res) => {
  const a = await uneLigne(`SELECT ${CHAMPS} FROM articles WHERE slug = $1`, [parametre(req, "slug")]);
  if (!a) throw introuvable("Cet article n'existe pas.");
  poserEtiquette(res, a.maj_le as Date);
  res.json(a);
});

routesArticles.get("/:slug/versions", async (req, res) => {
  const v = await requete(
    `SELECT v.id::text, v.contenu, v.cree_le,
            COALESCE(u.email, 'compte supprimé') AS acteur
       FROM article_versions v
       JOIN articles a ON a.id = v.article
       LEFT JOIN utilisateurs u ON u.id = v.acteur
      WHERE a.slug = $1
      ORDER BY v.cree_le DESC LIMIT 50`,
    [parametre(req, "slug")]
  );
  res.json(v);
});

/* ========================================================================= */
/* Écriture                                                                  */
/* ========================================================================= */

/**
 * Seul un administrateur met un article en ligne.
 *
 * ⚠️ CE CONTRÔLE COMBLE UNE PORTE DÉROBÉE.
 *
 * `POST /:slug/publier` exigeait bien `estAdministrateur`, mais l'écriture
 * ordinaire — `POST /` et `PUT /:slug`, ouvertes aux rédacteurs — accepte un
 * champ `statut`. Un rédacteur n'avait donc qu'à enregistrer son article avec
 * `statut: "publie"` pour le mettre en ligne lui-même : le contrôle
 * d'administration se contournait par la porte d'à côté.
 *
 * Le panel publie précisément de cette façon, ce qui explique que le défaut
 * soit passé inaperçu — le chemin « légitime » était le chemin détourné.
 *
 * `programme` est logé à la même enseigne : un article programmé paraît tout
 * seul à la date dite, sans repasser devant personne.
 */
const verifierDroitDePublier = (req: Request, statut: string) => {
  if (statut !== "publie" && statut !== "programme") return;
  if (req.utilisateur?.role === "administrateur") return;
  throw interdit(
    "Seul un administrateur peut mettre un article en ligne. Enregistrez-le en " +
      "relecture : un administrateur le publiera."
  );
};

/** Les valeurs d'un article, dans l'ordre attendu par les requêtes ci-dessous. */
const valeurs = (a: EntreeArticle) => [
  a.slug,
  a.titre,
  a.chapeau,
  a.corps,
  a.categorie,
  a.format,
  a.accent ?? null,
  a.motif ?? null,
  a.titre_fantome,
  a.reponse,
  a.version,
  a.exergue,
  a.meta_description,
  a.auteur,
  a.etiquettes,
  JSON.stringify(a.faq),
  a.statut,
  a.publie_le || null,
  a.maquette,
  a.image ?? "",
];

routesArticles.post("/", peutEcrire, async (req, res) => {
  const a = valider(schemaArticle, req.body);
  verifierDroitDePublier(req, a.statut);

  const existe = await uneLigne(`SELECT 1 FROM articles WHERE slug = $1`, [a.slug]);
  if (existe) {
    throw conflit("Un article utilise déjà cette adresse. Choisissez-en une autre.");
  }

  const cree = await transaction(async (client) => {
    const r = await client.query(
      `INSERT INTO articles
        (slug, titre, chapeau, corps, categorie, format, accent, motif,
         titre_fantome, reponse, version, exergue, meta_description, auteur,
         etiquettes, faq, statut, publie_le, maquette, image, cree_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING ${CHAMPS}`,
      [...valeurs(a), req.utilisateur!.id]
    );
    const ligne = r.rows[0];
    // L'historique part avec la création : la version 1 doit exister, sinon
    // « restaurer la version précédente » n'a rien à proposer sur un article
    // modifié une seule fois.
    await client.query(
      `INSERT INTO article_versions (article, contenu, acteur) VALUES ($1, $2, $3)`,
      [ligne.id, JSON.stringify(a), req.utilisateur!.id]
    );
    return ligne;
  });

  await tracer(req, "creation", a.slug, a.titre);
  poserEtiquette(res, cree.maj_le as Date);
  res.status(201).json(cree);
});

routesArticles.put("/:slug", peutEcrire, async (req, res) => {
  const ancienSlug = parametre(req, "slug");
  const a = valider(schemaArticle, req.body);
  verifierDroitDePublier(req, a.statut);

  const actuel = await uneLigne<LigneArticle & { id: string }>(
    `SELECT id::text, slug, maj_le, titre, statut FROM articles WHERE slug = $1`,
    [ancienSlug]
  );
  if (!actuel) throw introuvable("Cet article n'existe pas.");

  const complet = await uneLigne(`SELECT ${CHAMPS} FROM articles WHERE slug = $1`, [ancienSlug]);
  verifierEtiquette(req, actuel.maj_le, complet);

  // Changement d'adresse : la nouvelle ne doit pas être déjà prise.
  if (a.slug !== ancienSlug) {
    valider(schemaSlug, a.slug);
    const prise = await uneLigne(`SELECT 1 FROM articles WHERE slug = $1`, [a.slug]);
    if (prise) throw conflit("Un autre article utilise déjà cette adresse.");
  }

  const maj = await transaction(async (client) => {
    const r = await client.query(
      `UPDATE articles SET
         slug=$1, titre=$2, chapeau=$3, corps=$4, categorie=$5, format=$6,
         accent=$7, motif=$8, titre_fantome=$9, reponse=$10, version=$11,
         exergue=$12, meta_description=$13, auteur=$14, etiquettes=$15,
         faq=$16, statut=$17, publie_le=$18, maquette=$19, image=$20,
         maj_le = now(), archive = false
       WHERE id = $21
       RETURNING ${CHAMPS}`,
      [...valeurs(a), actuel.id]
    );

    await client.query(
      `INSERT INTO article_versions (article, contenu, acteur) VALUES ($1, $2, $3)`,
      [actuel.id, JSON.stringify(a), req.utilisateur!.id]
    );

    /*
     * Redirection automatique au changement d'adresse.
     *
     * Ce n'est PAS une option offerte à l'éditeur, et c'est délibéré : sans
     * elle, chaque correction de titre casse les liens déjà partagés et fait
     * perdre le référencement acquis par la page. Personne ne pense à cocher
     * une case pour ça — donc le serveur le fait.
     *
     * Seulement si l'article avait déjà été publié : une adresse jamais mise
     * en ligne n'a par définition aucun lien entrant.
     */
    if (a.slug !== ancienSlug && actuel.statut === "publie") {
      await client.query(
        `INSERT INTO redirections (depuis, vers, code) VALUES ($1, $2, 301)
         ON CONFLICT (depuis) DO UPDATE SET vers = EXCLUDED.vers`,
        [`/blog/${ancienSlug}/`, `/blog/${a.slug}/`]
      );
    }

    // Vingt versions par article : de quoi réparer une bêtise récente, sans
    // laisser la table grossir indéfiniment.
    await client.query(
      `DELETE FROM article_versions WHERE article = $1 AND id NOT IN (
         SELECT id FROM article_versions WHERE article = $1
          ORDER BY cree_le DESC LIMIT 20)`,
      [actuel.id]
    );

    return r.rows[0];
  });

  /*
   * LE JOURNAL DOIT DIRE CE QUI S'EST PASSÉ, PAS PAR QUELLE ROUTE.
   *
   * Un article peut passer de brouillon à publié par cette route-ci — c'est ce
   * que fait le panel quand on clique « Publier » depuis l'éditeur — comme par
   * `POST /:slug/publier`. Tracer « modification » dans le premier cas rendait
   * le journal faux : on y cherchait les publications, elles n'y étaient pas.
   */
  const devientPublie = actuel.statut !== "publie" && a.statut === "publie";
  const cessePublie = actuel.statut === "publie" && a.statut !== "publie";

  await tracer(
    req,
    devientPublie ? "publication" : cessePublie ? "depublication" : "modification",
    a.slug,
    a.titre
  );
  if (a.slug !== ancienSlug && actuel.statut === "publie") {
    await tracer(req, "redirection", `/blog/${ancienSlug}/`, `→ /blog/${a.slug}/ (301)`);
  }

  poserEtiquette(res, maj.maj_le as Date);
  res.json(maj);
});

/* ========================================================================= */
/* Publication                                                               */
/* ========================================================================= */

const changerStatut = async (
  req: Request,
  res: Response,
  statut: "publie" | "brouillon",
  action: "publication" | "depublication"
) => {
  const a = await uneLigne<LigneArticle>(
    `SELECT slug, titre, statut, maj_le FROM articles WHERE slug = $1 AND NOT supprime`,
    [parametre(req, "slug")]
  );
  if (!a) throw introuvable("Cet article n'existe pas.");

  if (statut === "publie" && a.statut === "publie") {
    throw invalide("Cet article est déjà publié.");
  }

  /*
   * Les deux conversions de type sont OBLIGATOIRES.
   *
   * `$2` sert ici à deux usages : affecter la colonne `statut`, de type
   * `statut_article`, et se comparer au texte 'publie'. Sans conversion,
   * PostgreSQL refuse la requête entière :
   *
   *     42P08 inconsistent types deduced for parameter $2
   *     detail: text versus statut_article
   *
   * Le défaut n'apparaît qu'à l'exécution -- la requête est syntaxiquement
   * correcte -- et il visait la toute première publication.
   */
  await requete(
    `UPDATE articles SET statut = $2::statut_article, maj_le = now(),
       publie_le = CASE WHEN $2::text = 'publie' AND publie_le IS NULL
                        THEN CURRENT_DATE ELSE publie_le END
     WHERE slug = $1`,
    [parametre(req, "slug"), statut]
  );

  await tracer(req, action, a.slug, a.titre);
  res.json(await demanderPublication(req.utilisateur!.id));
};

routesArticles.post("/:slug/publier", estAdministrateur, (req, res) =>
  changerStatut(req, res, "publie", "publication")
);

routesArticles.post("/:slug/depublier", estAdministrateur, (req, res) =>
  changerStatut(req, res, "brouillon", "depublication")
);

/* ========================================================================= */
/* Archivage, corbeille, restauration                                        */
/* ========================================================================= */

routesArticles.post("/:slug/archiver", estAdministrateur, async (req, res) => {
  const a = await uneLigne<LigneArticle>(
    `UPDATE articles SET archive = true, statut = 'brouillon', maj_le = now()
      WHERE slug = $1 AND NOT supprime RETURNING slug, titre, statut, maj_le`,
    [parametre(req, "slug")]
  );
  if (!a) throw introuvable("Cet article n'existe pas.");
  await tracer(req, "archivage", a.slug, a.titre);
  res.sendStatus(204);
});

/**
 * Corbeille, jamais suppression.
 *
 * Le contrat ne prévoit AUCUNE route de destruction définitive, et c'est
 * volontaire : une page déjà indexée qui disparaît fait perdre le
 * référencement acquis et laisse des liens morts sur le web. Vider réellement
 * la corbeille est une opération d'administration de la base, faite en
 * connaissance de cause — pas un bouton dans une interface.
 */
routesArticles.delete("/:slug", estAdministrateur, async (req, res) => {
  const a = await uneLigne<LigneArticle>(
    `UPDATE articles SET supprime = true, statut = 'brouillon', maj_le = now()
      WHERE slug = $1 RETURNING slug, titre, statut, maj_le`,
    [parametre(req, "slug")]
  );
  if (!a) throw introuvable("Cet article n'existe pas.");
  await tracer(req, "suppression", a.slug, a.titre);
  res.sendStatus(204);
});

routesArticles.post("/:slug/restaurer", estAdministrateur, async (req, res) => {
  const a = await uneLigne<LigneArticle>(
    `UPDATE articles SET supprime = false, archive = false, maj_le = now()
      WHERE slug = $1 RETURNING slug, titre, statut, maj_le`,
    [parametre(req, "slug")]
  );
  if (!a) throw introuvable("Cet article n'existe pas.");
  await tracer(req, "restauration", a.slug, a.titre);
  res.sendStatus(204);
});

routesArticles.post("/:slug/versions/:id/restaurer", peutEcrire, async (req, res) => {
  const v = await uneLigne<{ contenu: unknown }>(
    `SELECT v.contenu FROM article_versions v
       JOIN articles a ON a.id = v.article
      WHERE a.slug = $1 AND v.id = $2`,
    [parametre(req, "slug"), parametre(req, "id")]
  );
  if (!v) throw introuvable("Cette version n'existe pas.");

  const a = valider(schemaArticle, v.contenu);

  const maj = await uneLigne(
    `UPDATE articles SET
       titre=$2, chapeau=$3, corps=$4, categorie=$5, format=$6, accent=$7,
       motif=$8, titre_fantome=$9, reponse=$10, version=$11, exergue=$12,
       meta_description=$13, auteur=$14, etiquettes=$15, faq=$16, image=$17,
       maj_le = now()
     WHERE slug = $1
     RETURNING ${CHAMPS}`,
    [
      parametre(req, "slug"),
      a.titre, a.chapeau, a.corps, a.categorie, a.format, a.accent ?? null,
      a.motif ?? null, a.titre_fantome, a.reponse, a.version, a.exergue,
      a.meta_description, a.auteur, a.etiquettes, JSON.stringify(a.faq),
      a.image ?? "",
    ]
  );
  if (!maj) throw introuvable("Cet article n'existe pas.");

  await tracer(req, "restauration", parametre(req, "slug"), `Version du ${String(parametre(req, "id"))}`);
  poserEtiquette(res, maj.maj_le as Date);
  res.json(maj);
});
