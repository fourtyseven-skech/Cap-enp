import { serveurConfigure } from "./serveur/client";
import * as local from "./mediatheque";
import * as distant from "./serveur/mediatheque";

/**
 * ---------------------------------------------------------------------------
 * MÉDIATHÈQUE — LE POINT DE BASCULE
 * ---------------------------------------------------------------------------
 *
 * Les vues importent ce fichier, jamais `mediatheque.ts` directement. Il choisit
 * au chargement entre le stockage navigateur (IndexedDB) et le serveur, selon la
 * seule présence de `VITE_API_URL` — exactement comme `depot.ts` le fait pour les
 * articles.
 *
 * POURQUOI UNE FAÇADE PLUTÔT QU'UNE BASCULE DANS `mediatheque.ts`
 * --------------------------------------------------------------
 * `depot.ts` bascule chez lui : ses fonctions ne s'appellent presque pas entre
 * elles, le renommage y était sans risque. `mediatheque.ts` est différent :
 * `resoudre` appelle `urlMedia`, `versHtml` appelle `principale`, `importer`
 * passe par `transaction`. Renommer onze exports en gardant ces liens corrects
 * était une occasion de casser silencieusement le mode local — qui est celui
 * qui fonctionne aujourd'hui.
 *
 * Une façade ne touche à aucun des deux fichiers. C'est aussi ce qui rend le
 * retour en arrière trivial.
 *
 * POURQUOI CE NOM
 * ---------------
 * `medias.ts` aurait été plus naturel, mais la vue s'appelle `Medias.tsx` : les
 * deux noms ne diffèrent que par la casse, et Windows ne les distingue pas. Le
 * projet aurait compilé ici et échoué sur une machine sensible à la casse, ou
 * l'inverse.
 */

/* Ce qui ne dépend pas du stockage : plafonds de l'import navigateur, types. */
export { PLAFONDS, REFERENCE } from "./mediatheque";
export type { Media, Resultat } from "./mediatheque";

/**
 * Conversion de type volontaire.
 *
 * Les deux implémentations ont la même FORME mais pas la même signature : en
 * local, `listerMedias` rend un tableau via IndexedDB, `urlMedia` accepte une
 * largeur pour choisir une déclinaison — le serveur n'en produit qu'une. Sans
 * conversion, TypeScript exposerait aux vues une union de signatures qu'elles
 * devraient toutes traiter, alors qu'elles n'ont précisément pas à savoir d'où
 * viennent les images.
 *
 * On annonce donc le type local, qui est le contrat que les vues respectent
 * déjà.
 */
type Mediatheque = typeof local;
const source: Mediatheque = serveurConfigure
  ? ({ ...local, ...distant } as unknown as Mediatheque)
  : local;

export const listerMedias = source.listerMedias;
export const obtenirMedia = source.obtenirMedia;
export const supprimerMedia = source.supprimerMedia;
export const majMedia = source.majMedia;
export const importer = source.importer;
export const quota = source.quota;

export const versMarkdown = source.versMarkdown;
export const urlMedia = source.urlMedia;
export const resoudre = source.resoudre;
export const referencesDe = source.referencesDe;
export const versHtml = source.versHtml;

/**
 * Où vivent les images. Affiché dans le panel, comme `MODE_STOCKAGE` pour les
 * articles : un rédacteur doit savoir si ce qu'il envoie quitte son navigateur.
 */
export const MODE_MEDIAS: "navigateur" | "serveur" = serveurConfigure
  ? "serveur"
  : "navigateur";

/**
 * Les règles réellement appliquées, telles qu'on les affiche au rédacteur.
 *
 * Elles ne sont PAS les mêmes des deux côtés, et l'écran doit dire la vérité :
 * le traitement navigateur ramène à 1 600 px et produit trois déclinaisons pour
 * un `srcset` ; le serveur ramène à 2 000 px et produit une seule image, parce
 * que les articles n'utilisent pas de `srcset`.
 *
 * La liste était écrite en dur dans `Medias.tsx` avec les valeurs locales. En
 * mode serveur, elle aurait annoncé au client des règles que rien n'applique —
 * et il aurait redimensionné ses images pour rien.
 */
export const REGLES: string[] = serveurConfigure
  ? [
      "Source acceptée jusqu'à 25 Mo",
      "Conversion WebP automatique, sans option",
      "Largeur ramenée à 2 000 px",
      "Compression sans perte si elle donne un fichier plus léger",
      "Image stockée dans la base, pas sur le disque du serveur",
      "SVG refusé — il peut contenir du code exécutable",
      "Type vérifié sur le contenu du fichier, pas sur son extension",
      "Texte alternatif bloquant",
    ]
  : [
      `Source acceptée jusqu'à ${local.PLAFONDS.sourceMo} Mo et ${local.PLAFONDS.sourcePx} px`,
      "Conversion WebP automatique, sans option",
      `Largeur ramenée à ${local.PLAFONDS.largeurMax} px`,
      `Déclinaisons ${local.PLAFONDS.tailles.join(" · ")} px pour le srcset`,
      `Qualité réduite par paliers jusqu'à passer sous ${local.PLAFONDS.poidsMaxKo} Ko`,
      "SVG refusé — il peut contenir du code exécutable",
      "Texte alternatif bloquant",
      "Stockage dans ce navigateur uniquement",
    ];
