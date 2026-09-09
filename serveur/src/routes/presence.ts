import { Router } from "express";
import { invalide } from "../erreurs.js";
import { battre, quitter, ressourceValide } from "../presence.js";

/**
 * ---------------------------------------------------------------------------
 * PRÉSENCE — QUI EST SUR QUOI
 * ---------------------------------------------------------------------------
 *
 * Deux routes, sans base de données : voir `src/presence.ts` pour le pourquoi.
 *
 *   PUT    /api/presence   { ressource }  → la liste des AUTRES personnes
 *   DELETE /api/presence   { ressource }  → on s'en va
 *
 * Le panel appelle `PUT` à l'ouverture d'un écran, puis toutes les trente
 * secondes tant qu'il reste ouvert. Une présence non rafraîchie s'éteint seule
 * au bout de quatre-vingt-dix secondes : personne ne peut « oublier » de
 * libérer quoi que ce soit.
 *
 * HORS QUOTA D'ÉCRITURE
 * ---------------------
 * `limiterEcritures` (src/securite.ts) écarte explicitement ce chemin. Ces
 * routes n'écrivent rien de durable, mais elles battent toutes les trente
 * secondes : comptées parmi les écritures, elles consommeraient le quota d'une
 * personne qui n'a fait que laisser un écran ouvert.
 */

export const routesPresence = Router();

routesPresence.put("/", (req, res) => {
  const { ressource } = req.body ?? {};
  if (!ressourceValide(ressource)) {
    throw invalide("Ressource invalide. Forme attendue : « article:mon-article ».");
  }

  const autres = battre(ressource, req.utilisateur!.id, req.utilisateur!.nom);
  res.json({ autres });
});

routesPresence.delete("/", (req, res) => {
  const { ressource } = req.body ?? {};
  if (!ressourceValide(ressource)) throw invalide("Ressource invalide.");

  quitter(ressource, req.utilisateur!.id);
  res.sendStatus(204);
});
