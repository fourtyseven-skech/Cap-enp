import { config, verifierConfig } from "./config.js";
import { pool, verifierBase } from "./bd.js";
import { purgerSessions } from "./session.js";
import { creerApp } from "./app.js";

/**
 * Point d'entrée : vérifie la configuration, vérifie la base, puis écoute.
 * La construction de l'application est dans `app.ts`, pour qu'elle puisse être
 * exercée par la recette sans ouvrir de port ni toucher à la vraie base.
 */

verifierConfig();

const modeReconstruction = () =>
  config.reconstruction.commande
    ? `commande locale dans ${config.reconstruction.repertoire || process.cwd()}`
    : "AUCUNE — les publications seront enregistrées sans reconstruire";

const demarrer = async () => {
  try {
    await verifierBase();
  } catch (e) {
    console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }

  // Ménage des sessions expirées : au démarrage, puis toutes les heures.
  // `unref()` pour que ce minuteur n'empêche pas le processus de s'arrêter.
  void purgerSessions().catch(() => undefined);
  setInterval(() => void purgerSessions().catch(() => undefined), 3600_000).unref();

  const serveur = creerApp().listen(config.port, () => {
    console.log(
      [
        "",
        "✓ API du panel Megasoft",
        `  port           ${config.port}`,
        `  origine        ${config.origineAutorisee}`,
        `  environnement  ${config.environnement}`,
        `  reconstruction ${modeReconstruction()}`,
        "",
      ].join("\n")
    );
  });

  /*
   * Arrêt propre. Sans cela, un redéploiement coupe les requêtes en cours au
   * milieu — y compris une transaction, qui laisse alors une écriture à moitié
   * faite, sans que personne ne s'en aperçoive.
   */
  const arreter = (signal: string) => {
    console.log(`\n${signal} reçu — arrêt en cours.`);
    serveur.close(() => {
      void pool.end().then(() => process.exit(0));
    });
    // Filet : si une requête ne se termine pas, on n'attend pas indéfiniment.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => arreter("SIGTERM"));
  process.on("SIGINT", () => arreter("SIGINT"));
};

void demarrer();
