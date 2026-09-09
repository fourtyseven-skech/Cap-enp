import express from "express";
import { config } from "./config.js";
import { middlewareErreurs, middlewareIntrouvable } from "./erreurs.js";
import { entetes, limiterEcritures, origine } from "./securite.js";
import { connecte, identifier } from "./session.js";
import { routesArticles } from "./routes/articles.js";
import { routesContenu } from "./routes/contenu.js";
import { routesMedias } from "./routes/medias.js";
import { routesPresence } from "./routes/presence.js";
import {
  routesAuth,
  routesComptes,
  routesJournal,
  routesPublications,
} from "./routes/comptes.js";

/**
 * ---------------------------------------------------------------------------
 * L'APPLICATION
 * ---------------------------------------------------------------------------
 *
 * Construite ici, démarrée dans `index.ts`. La séparation n'est pas cosmétique :
 * tant que l'application s'ouvrait un port au moment de l'import, il était
 * impossible de l'exercer depuis une recette sans lancer un vrai serveur et se
 * connecter à la vraie base.
 *
 * Implémente `serveur/CONTRAT.md`. Le site public ne parle JAMAIS à ce
 * serveur : il est statique, et cette API ne sert que le panel
 * d'administration. C'est ce qui permet au site de rester pré-généré.
 *
 * L'ordre des middlewares ci-dessous n'est pas décoratif — il EST la sécurité.
 * Chaque commentaire dit ce qui casserait si on déplaçait la ligne.
 */
export const creerApp = () => {
  const app = express();

  /*
   * Derrière le proxy de l'hébergeur (le cas sur tout mutualisé), `req.ip` est
   * l'adresse du proxy. Sans ce réglage, tous les visiteurs partageraient le
   * même quota de connexion — la limitation deviendrait inutile.
   */
  app.set("trust proxy", 1);

  /* La version d'Express n'a pas à être annoncée : c'est une aide gratuite pour
     qui cherche une faille connue. */
  app.disable("x-powered-by");

  /* 1. En-têtes de protection — avant tout, y compris avant les erreurs, pour
        qu'une réponse d'échec les porte aussi. */
  app.use(entetes);

  /* 2. Origine autorisée. Avant la lecture du corps : une requête d'une origine
        refusée n'a aucune raison d'être analysée. */
  app.use(origine);

  /* 3. Corps JSON. Plafond à 2 Mo : un article très long en fait quelques
        dizaines de kilo-octets, et le contenu d'une section est plafonné par la
        validation. Au-delà, c'est une anomalie, pas un contenu. */
  app.use(express.json({ limit: "2mb" }));

  /* 4. Identification. Doit précéder les routes ET la limitation d'écritures,
        qui compte par session. */
  app.use(identifier);

  /* 5. Quota d'écritures. */
  app.use(limiterEcritures);

  /* ------------------------------------------------------------------ routes */

  /* Contrôle de vie, sans authentification : l'hébergeur doit pouvoir vérifier
     que le service tourne sans détenir de compte. Ne révèle rien d'autre. */
  app.get("/api/sante", (_req, res) => res.json({ etat: "ok" }));

  /* Connexion : les seules routes accessibles sans session. */
  app.use("/api", routesAuth);

  /* Tout le reste exige une session valide. `connecte` est posé ici, une fois,
     plutôt que route par route : un oubli sur une seule route ouvrirait une
     porte, et c'est exactement le genre d'oubli qui ne se voit pas. */
  app.use("/api/articles", connecte, routesArticles);
  app.use("/api/contenu", connecte, routesContenu);
  app.use("/api/medias", connecte, routesMedias);
  app.use("/api/utilisateurs", connecte, routesComptes);
  /* Présence : qui travaille sur quoi. Éphémère, en mémoire — voir
     src/presence.ts. Placée avant le journal, elle n'écrit rien de durable. */
  app.use("/api/presence", connecte, routesPresence);
  app.use("/api/journal", connecte, routesJournal);
  app.use("/api/publications", connecte, routesPublications);

  app.use(middlewareIntrouvable);
  app.use(middlewareErreurs);

  return app;
};
