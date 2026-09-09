import type { Request } from "express";
import { introuvable } from "./erreurs.js";

/**
 * Lit un paramètre d'adresse (`/api/articles/:slug`).
 *
 * Express type `req.params` comme un dictionnaire ouvert : avec
 * `noUncheckedIndexedAccess`, chaque lecture vaut donc `string | undefined`.
 * L'option est gardée — elle attrape de vraies fautes ailleurs — et le cas est
 * traité ici, une fois.
 *
 * Un paramètre absent ne peut pas arriver : la route ne se déclenche que si il
 * est présent. Mais si le chemin de la route et cet appel divergeaient un jour,
 * mieux vaut un 404 explicite qu'une requête SQL avec `undefined`.
 */
export const parametre = (req: Request, nom: string): string => {
  const v = (req.params as Record<string, string | undefined>)[nom];
  if (typeof v !== "string" || !v) throw introuvable("Adresse incomplète.");
  return v;
};
