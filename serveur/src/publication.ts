import { exec } from "node:child_process";
import { requete, uneLigne } from "./bd.js";
import { config } from "./config.js";

/**
 * ---------------------------------------------------------------------------
 * RECONSTRUCTION DU SITE
 * ---------------------------------------------------------------------------
 *
 * Le site est statique : publier ne consiste pas à changer une ligne visible
 * immédiatement, mais à reconstruire les pages. C'est ce qui préserve la
 * pré-génération, le llms.txt et les scores de performance — au prix d'un délai
 * de l'ordre de deux minutes.
 *
 * Le déclenchement se fait par une COMMANDE lancée sur la machine : le site est
 * hébergé chez PlanetHoster, sur le serveur du client, dont le panneau N0C
 * donne un accès SSH avec Node et npm. La reconstruction a lieu sur place, dans
 * le dossier du site.
 *
 * Une première version prévoyait aussi un « crochet » à appeler chez un
 * hébergeur tiers. Il a été retiré : ni Netlify ni Cloudflare ne sont utilisés,
 * et un chemin de code qui ne peut jamais s'exécuter finit par égarer celui qui
 * le lit.
 *
 * Si la commande n'est pas configurée, la publication est quand même
 * ENREGISTRÉE, avec un message explicite. Le contenu est en base et partira à
 * la prochaine reconstruction. Laisser croire à une mise en ligne qui n'a pas
 * eu lieu serait bien pire que d'annoncer qu'il manque un réglage.
 */

export type EtatPublication = "demandee" | "en_cours" | "reussie" | "echouee";

export type Publication = {
  id: string;
  etat: EtatPublication;
  demandee_le: string;
  terminee_le: string | null;
  reference: string | null;
  message: string | null;
};

const CHAMPS = `id::text, etat, demandee_le, terminee_le, reference, message`;

/**
 * Y a-t-il déjà une reconstruction en cours ?
 *
 * Publier trois articles d'affilée ne doit pas lancer trois constructions
 * concurrentes : elles se disputeraient le même dossier de travail et
 * produiraient un résultat imprévisible. La deuxième demande se raccroche donc
 * à celle qui tourne — dont le résultat contiendra de toute façon ses
 * modifications, puisque tout est lu en base au moment du build.
 */
const enCours = () =>
  uneLigne<Publication>(
    `SELECT ${CHAMPS} FROM publications
      WHERE etat IN ('demandee', 'en_cours')
        AND demandee_le > now() - interval '30 minutes'
      ORDER BY demandee_le DESC LIMIT 1`
  );

/**
 * Referme une publication.
 *
 * L'échec d'écriture est ravalé, et c'est délibéré : cette fonction est
 * appelée depuis le rappel d'un processus enfant, hors de toute requête HTTP.
 * Une exception y devient un rejet non capturé qui abat le serveur.
 *
 * Le cas s'est produit en recette : la reconstruction se terminait après la
 * fermeture du pool, et « Cannot use a pool after calling end on the pool »
 * faisait sortir le processus en erreur APRÈS que les 75 vérifications soient
 * passées — une recette réussie qui rendait un code d'échec.
 *
 * Perdre l'état final d'une reconstruction est sans gravité : la ligne reste
 * « en_cours » et la fenêtre de 30 minutes de `enCours` la périme d'elle-même.
 */
const terminer = async (id: string, etat: EtatPublication, message: string) => {
  try {
    await requete(
      `UPDATE publications SET etat = $2, terminee_le = now(), message = $3 WHERE id = $1`,
      [id, etat, message.slice(0, 2000)]
    );
  } catch (e) {
    console.error(
      "[publication] état final non enregistré :",
      e instanceof Error ? e.message : e
    );
  }
};

/* ------------------------------------------------------------- exécution */

const lancerCommande = (id: string) => {
  // `exec` et non `spawn` avec arguments : la commande vient de la
  // configuration du serveur, écrite par nous, et contient légitimement un
  // enchaînement (`npm ci && npm run build`). Elle ne provient
  // JAMAIS d'une entrée utilisateur — c'est ce qui rend ce choix acceptable.
  const enfant = exec(
    config.reconstruction.commande,
    {
      cwd: config.reconstruction.repertoire || process.cwd(),
      timeout: config.reconstruction.delaiMs,
      maxBuffer: 8 * 1024 * 1024,
      /*
       * L'ENVIRONNEMENT DE LA RECONSTRUCTION EST IMPOSÉ ICI.
       *
       * Un test réel a montré le défaut : le site construit héritait du `.env`
       * de développement, où `VITE_AVEC_PANEL=1` était resté. Le panel partait
       * donc dans le site public, `verifier-dist.mjs` refusait le résultat —
       * à juste titre — et LES QUATRE PUBLICATIONS ONT ÉCHOUÉ D'AFFILÉE.
       *
       * Vu du panel, l'article était « publié » ; sur le site, rien ne
       * changeait. Personne ne pouvait faire le lien.
       *
       * Ces variables ont la priorité sur tout fichier `.env` du site (Vite
       * donne le dessus à l'environnement du processus). La reconstruction
       * lancée depuis le panel produit donc TOUJOURS un site public, quelle
       * que soit la configuration laissée sur la machine.
       */
      env: {
        ...process.env,
        // Jamais de panel dans le site public.
        VITE_AVEC_PANEL: "0",
        // Jamais de mode atelier : l'authentification réelle, ou rien.
        VITE_ADMIN_AUTH: "aucun",
        /*
         * NODE_ENV n'est volontairement PAS forcé à « production » : npm
         * sauterait alors les dépendances de développement — or ce sont
         * précisément elles qui construisent le site (vite, typescript, sharp,
         * pg). C'est la même raison pour laquelle la commande de
         * reconstruction ne doit pas porter `--omit=dev` : l'exemple livré le
         * portait, et la première publication chez le client aurait échoué.
         */
      },
    },
    (erreur, sortie, erreurSortie) => {
      if (erreur) {
        // Les dernières lignes seulement : un journal de build complet fait
        // des centaines de lignes, et la cause est presque toujours à la fin.
        const extrait = (erreurSortie || sortie || erreur.message).slice(-1500);
        void terminer(id, "echouee", `La reconstruction a échoué.\n${extrait}`);
        return;
      }
      void terminer(id, "reussie", "Le site a été reconstruit et mis en ligne.");
    }
  );

  void requete(`UPDATE publications SET etat = 'en_cours', reference = $2 WHERE id = $1`, [
    id,
    enfant.pid ? `pid:${enfant.pid}` : null,
  ]);
};

/* ---------------------------------------------------------------- API */

/**
 * Demande une reconstruction. Rend la main immédiatement : le panel suit
 * l'avancement en interrogeant `GET /api/publications/:id`.
 */
export const demanderPublication = async (
  /*
   * `null` quand personne n'a cliqué : la tâche de parution programmée demande
   * elle aussi une reconstruction, à l'heure décidée par l'auteur. La colonne
   * est une clé étrangère vers `utilisateurs` — y écrire un libellé comme
   * « tâche programmée » n'est pas possible, et ce serait mentir sur qui a agi.
   * Le journal, lui, nomme la tâche : c'est là que se lit l'origine.
   */
  utilisateur: string | null
): Promise<Publication> => {
  const dejaLancee = await enCours();
  if (dejaLancee) return dejaLancee;

  const ligne = await uneLigne<Publication>(
    `INSERT INTO publications (demandee_par) VALUES ($1) RETURNING ${CHAMPS}`,
    [utilisateur]
  );
  if (!ligne) throw new Error("Publication non enregistrée.");

  if (config.reconstruction.commande) {
    lancerCommande(ligne.id);
  } else {
    await terminer(
      ligne.id,
      "reussie",
      "Modification enregistrée. Aucune reconstruction automatique n'est configurée : " +
        "le site sera à jour au prochain déploiement."
    );
  }

  return (await obtenirPublication(ligne.id)) ?? ligne;
};

export const obtenirPublication = (id: string) =>
  uneLigne<Publication>(`SELECT ${CHAMPS} FROM publications WHERE id = $1`, [id]);

export const listerPublications = (limite = 20) =>
  requete<Publication>(
    `SELECT ${CHAMPS} FROM publications ORDER BY demandee_le DESC LIMIT $1`,
    [Math.min(limite, 100)]
  );
