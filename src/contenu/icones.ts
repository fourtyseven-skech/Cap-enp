import {
  Banknote,
  Boxes,
  Cloud,
  Factory,
  Lightbulb,
  Monitor,
  Puzzle,
  Server,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import LogoMyExobrain from "@/components/brand/LogoMyExobrain";
import { type CleIcone } from "./clesIcones";

/**
 * ---------------------------------------------------------------------------
 * LES ICÔNES DISPONIBLES POUR LE CONTENU
 * ---------------------------------------------------------------------------
 *
 * LE PIÈGE QUE CE FICHIER SUPPRIME
 * --------------------------------
 * Avant l'extraction, l'icône d'un module se déduisait de son TITRE :
 *
 *     icone: moduleIcons[item.title] ?? Server
 *
 * Tant que les titres vivaient dans le code, ça tenait. Le jour où le client
 * pourra les modifier depuis le panel, renommer « GPAO » en « G.P.A.O. » ferait
 * silencieusement retomber l'icône sur celle par défaut. Aucune erreur, aucun
 * avertissement — juste une mauvaise icône que personne ne remarquerait.
 *
 * L'icône est donc devenue un CHAMP à part, choisi dans cette liste. Le titre
 * peut être réécrit librement ; l'icône ne bouge pas. Et une clé inconnue fait
 * échouer le build au lieu de passer inaperçue.
 *
 * AJOUTER UNE ICÔNE
 * -----------------
 * Une ligne ici, et elle devient proposable dans le panel. Le schéma s'appuie
 * sur les clés de cette table : rien d'autre à déclarer.
 */

/** Ce qu'une entrée de liste sait afficher : un composant qui prend `className`. */
export type Icone = LucideIcon | typeof LogoMyExobrain;

/**
 * Chaque clé déclarée dans `clesIcones.ts` DOIT avoir son composant ici.
 *
 * Le type `Record<CleIcone, Icone>` le garantit : ajouter une clé sans son
 * icône ne compile pas. C'est ce qui évite qu'une entrée choisie dans le panel
 * s'affiche sans rien.
 */
export const ICONES: Record<CleIcone, Icone> = {
  serveur: Server,
  panier: ShoppingCart,
  billet: Banknote,
  personnes: Users,
  usine: Factory,
  cle: Wrench,
  camion: Truck,
  entrepot: Warehouse,
  ecran: Monitor,
  puzzle: Puzzle,
  nuage: Cloud,
  ampoule: Lightbulb,
  cartons: Boxes,
  etincelles: Sparkles,
  /* Le produit a sa propre marque : on montre son monogramme, pas un cerveau
     générique. Voir components/brand/LogoMyExobrain. */
  myexobrain: LogoMyExobrain,
};

export { CLES_ICONES, type CleIcone } from "./clesIcones";

/**
 * L'icône d'une clé.
 *
 * Le repli sur `serveur` ne devrait jamais servir : le schéma refuse les clés
 * inconnues au build. Il est là parce qu'un composant sans icône casserait le
 * rendu, alors qu'une icône inattendue ne fait que surprendre.
 */
export const icone = (cle: CleIcone): Icone => ICONES[cle] ?? Server;
