/**
 * Les clés d'icônes utilisables dans le contenu.
 *
 * POURQUOI CE FICHIER EST SÉPARÉ DE `icones.ts`
 * ---------------------------------------------
 * `icones.ts` associe chaque clé à un composant React — dont le monogramme
 * My Exobrain, importé via l'alias `@`. Or `schemas.ts` est chargé par la
 * configuration de Vite, donc par Node, où ni l'alias ni le JSX n'existent :
 *
 *     Cannot find package '@/components' imported from vite.config.ts
 *
 * Les clés sont de simples chaînes. En les isolant ici, le schéma peut les
 * connaître sans rien entraîner du monde React derrière lui.
 */
export const CLES_ICONES = [
  "serveur",
  "panier",
  "billet",
  "personnes",
  "usine",
  "cle",
  "camion",
  "entrepot",
  "ecran",
  "puzzle",
  "nuage",
  "ampoule",
  "cartons",
  "etincelles",
  "myexobrain",
] as const;

export type CleIcone = (typeof CLES_ICONES)[number];
