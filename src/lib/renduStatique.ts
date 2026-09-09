import { createContext, useContext } from "react";

/**
 * « Sommes-nous en train de produire le HTML pré-généré ? »
 *
 * Certains composants n'affichent leur valeur définitive qu'une fois un effet
 * exécuté — un compteur qui part de zéro et s'anime à l'entrée dans le champ de
 * vision, par exemple. Dans le navigateur c'est le comportement voulu ; dans le
 * document pré-généré, où aucun effet ne tourne jamais, cela fige le placeholder
 * dans le HTML. Un robot lisait ainsi « 0 Clients accompagnés ».
 *
 * Ce drapeau vaut `false` partout, sauf dans `entry-accueil.tsx` qui le passe à
 * `true` : les composants concernés y rendent directement leur valeur finale.
 * Le comportement dans le navigateur est inchangé.
 */
export const ContexteRenduStatique = createContext(false);

export const useRenduStatique = () => useContext(ContexteRenduStatique);
