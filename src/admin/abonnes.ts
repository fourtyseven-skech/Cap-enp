/**
 * Le signal « quelque chose a changé », partagé par les deux dépôts.
 *
 * POURQUOI CE FICHIER MINUSCULE EXISTE
 * ------------------------------------
 * `depot.ts` (stockage navigateur) et `serveur/adaptateur.ts` (stockage
 * serveur) doivent tous deux prévenir les vues qu'elles doivent se redessiner.
 * Si le mécanisme vivait dans l'un des deux, l'autre devrait l'importer — et
 * comme `depot.ts` importe déjà l'adaptateur pour choisir entre les deux, on
 * obtiendrait un cycle d'imports.
 *
 * Un cycle ne casse pas toujours à la compilation : il produit souvent une
 * valeur `undefined` au chargement, dans un seul des deux sens, et seulement
 * dans le fichier construit. C'est une panne pénible à diagnostiquer pour un
 * gain nul — d'où ces vingt lignes à part.
 */

const abonnes = new Set<() => void>();

/** S'abonner aux changements. Renvoie la fonction de désabonnement. */
export const surChangement = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

/** Prévenir toutes les vues abonnées. */
export const notifier = () => abonnes.forEach((f) => f());
