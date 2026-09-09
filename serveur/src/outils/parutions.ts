import { pool, requete } from "../bd.js";
import { verifierConfig } from "../config.js";
import { demanderPublication } from "../publication.js";

/**
 * ---------------------------------------------------------------------------
 * LES PARUTIONS PROGRAMMÉES
 * ---------------------------------------------------------------------------
 *
 *     npm run parutions
 *
 * À lancer une fois par jour par une tâche `cron` de l'hébergeur. Voir le mode
 * d'emploi en fin de fichier.
 *
 * CE QUI MANQUAIT
 * ---------------
 * Un article pouvait déjà être daté du futur : il prend le statut `programme`,
 * et `scripts/exporter-articles.mjs` le fait paraître dès que sa date est
 * atteinte — mais SEULEMENT au moment d'une reconstruction.
 *
 * Or rien ne déclenchait cette reconstruction. Un article programmé pour le
 * mardi attendait donc qu'une personne publie autre chose. « Programmé »
 * voulait dire « paraîtra quand quelqu'un touchera au site », ce qui n'est pas
 * ce que le mot promet.
 *
 * CE QUE FAIT CETTE COMMANDE
 * --------------------------
 * 1. Elle cherche les articles `programme` dont la date est arrivée ;
 * 2. s'il n'y en a aucun, elle s'arrête sans rien faire — c'est le cas le plus
 *    fréquent, et une reconstruction quotidienne inutile userait le serveur
 *    pour rien ;
 * 3. sinon elle les passe en `publie`, trace chaque parution au journal, puis
 *    demande UNE reconstruction pour l'ensemble.
 *
 * POURQUOI CHANGER LE STATUT PLUTÔT QUE LAISSER LE PONT S'EN CHARGER
 * ------------------------------------------------------------------
 * Le pont sait déjà traiter un article programmé dont la date est passée comme
 * s'il était publié. Mais dans le panel, l'article resterait marqué
 * « programmé » alors qu'il est en ligne depuis une semaine. Le statut doit
 * dire la vérité : c'est lui que le client lit.
 *
 * POURQUOI LE JOURNAL DIT « TÂCHE PROGRAMMÉE » ET NON UN NOM DE PERSONNE
 * ----------------------------------------------------------------------
 * Le journal enregistre ce qui s'est passé, pas ce qu'on aurait aimé lire.
 * Personne n'a cliqué : c'est la machine qui a agi, à la date décidée par
 * l'auteur. Attribuer la parution à ce dernier laisserait croire qu'il était
 * devant son écran ce matin-là.
 */

const ACTEUR = "tâche programmée";

const principal = async () => {
  verifierConfig();

  /*
   * `publie_le <= CURRENT_DATE` : la comparaison se fait en DATE, pas en
   * horodatage. Un article daté du 12 paraît le 12 au matin, heure du serveur —
   * la précision à la minute n'a pas de sens pour un blog, et elle ferait
   * dépendre la parution de l'heure exacte du `cron`.
   */
  const dus = await requete<{ slug: string; titre: string; publie_le: string }>(
    `SELECT slug, titre, publie_le::text
       FROM articles
      WHERE statut = 'programme' AND NOT supprime AND publie_le <= CURRENT_DATE
      ORDER BY publie_le`
  );

  if (dus.length === 0) {
    console.log("· Parutions : aucun article à faire paraître aujourd'hui.");
    await pool.end();
    return;
  }

  console.log(`· Parutions : ${dus.length} article(s) à faire paraître.`);

  for (const a of dus) {
    /* La condition est REPRISE dans le UPDATE. Entre la lecture et l'écriture,
       quelqu'un a pu dépublier l'article depuis le panel : sans elle, la tâche
       le remettrait en ligne contre une décision humaine plus récente. */
    const change = await requete<{ slug: string }>(
      `UPDATE articles
          SET statut = 'publie', maj_le = now()
        WHERE slug = $1 AND statut = 'programme' AND NOT supprime
              AND publie_le <= CURRENT_DATE
      RETURNING slug`,
      [a.slug]
    );
    /* `RETURNING` puis comptage : sans lui, on ne saurait pas si la ligne a
       réellement changé, et le journal enregistrerait une parution qui n'a pas
       eu lieu. */
    if (change.length === 0) continue;

    await requete(
      `INSERT INTO journal (acteur, action, cible, detail)
       VALUES ($1, 'publication', $2, $3)`,
      [ACTEUR, a.slug, `parution programmée pour le ${a.publie_le}`]
    );
    console.log(`  ✓ ${a.titre} (${a.slug})`);
  }

  /*
   * UNE reconstruction pour tous les articles du jour, et non une par article.
   * Le site entier est régénéré à chaque fois : trois reconstructions
   * produiraient trois fois le même résultat, en trois fois plus de temps.
   */
  /* `null` : aucune personne n'a demandé cette reconstruction. La colonne
     `demandee_par` renvoie à un compte réel ; l'origine se lit au journal. */
  const publication = await demanderPublication(null);
  console.log(`· Reconstruction demandée (${publication.id}).`);

  await pool.end();
};

principal().catch((e) => {
  /* Sortie en échec : une tâche `cron` silencieuse qui échoue est une tâche
     qu'on croit faite. Le code de retour est ce que l'hébergeur surveille. */
  console.error("\n✖ Les parutions programmées ont échoué :", e);
  process.exit(1);
});

/**
 * ---------------------------------------------------------------------------
 * MODE D'EMPLOI — À FAIRE LE JOUR DU DÉPLOIEMENT
 * ---------------------------------------------------------------------------
 *
 * Dans le panneau N0C de PlanetHoster, section « Tâches cron », une fois par
 * jour à 6 h du matin :
 *
 *     0 6 * * *  cd /chemin/vers/vite-project/serveur && npm run parutions >> parutions.log 2>&1
 *
 * Le chemin exact dépend de l'installation. Trois points de vigilance :
 *
 *   · la tâche doit lire le même `serveur/.env` que l'API — c'est de là que
 *     viennent `DATABASE_URL` et `COMMANDE_RECONSTRUCTION` ;
 *   · `>> parutions.log` conserve une trace : sans elle, une tâche qui échoue
 *     depuis trois semaines ne se remarque pas ;
 *   · la commande est sans effet s'il n'y a rien à publier. La lancer plus
 *     souvent ne casse rien, mais n'apporte rien non plus.
 */
