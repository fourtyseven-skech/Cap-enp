/**
 * Les balises d'en-tête communes à TOUTES les pages du site.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * Le site produit son HTML depuis trois endroits différents :
 *
 *   · `index.html` — l'accueil et la page FAQ, écrites à la main ;
 *   · `scripts/build-blog.mjs` — les articles, générés au build ;
 *   · `vite.config.ts` — l'aperçu des articles en développement.
 *
 * Trois gabarits, donc trois occasions d'oublier la même balise. C'est arrivé :
 * le gabarit de développement n'a jamais porté le favicon, si bien qu'en
 * relisant un article on voyait l'icône vierge du navigateur et le blog avait
 * l'air d'un autre site. Le site livré, lui, était correct — ce qui rend ce
 * genre d'écart particulièrement long à repérer.
 *
 * Ces balises sont donc définies ICI, une seule fois, et `verifierTete()`
 * interrompt le build si une page en perd une. Corriger le symptôme aurait
 * laissé la cause en place : rien n'aurait empêché le prochain oubli.
 */

/** Le bloc à insérer dans le `<head>` de toute page. */
export const BALISES_COMMUNES = `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="author" content="Megasoft">
    <link rel="icon" type="image/png" href="/megasoft-favicon.png">
    <link rel="preload" href="/fonts/inter-tight-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/poppins-800-latin.woff2" as="font" type="font/woff2" crossorigin>`;

/**
 * Ce qu'on vérifie, et sous quelle forme.
 *
 * Des motifs et non une comparaison de texte : `index.html` est écrit à la main,
 * avec des balises auto-fermantes et l'ordre d'attributs de son auteur. Comparer
 * les chaînes ferait échouer le contrôle sur une différence d'écriture, pas sur
 * une absence — et un contrôle qui crie pour rien finit désactivé.
 */
const MARQUEURS = [
  ["encodage", /<meta\s+charset=/i],
  ["viewport", /name="viewport"/],
  ["auteur", /name="author"/],
  ["favicon", /rel="icon"/],
  ["police Inter Tight", /inter-tight-latin\.woff2/],
  ["police Poppins", /poppins-800-latin\.woff2/],
];

/**
 * Interrompt le build si une page a perdu une balise commune.
 *
 * @param {string} html    le document complet
 * @param {string} page    son nom, pour que le message dise quoi corriger
 */
export function verifierTete(html, page) {
  const manquants = MARQUEURS.filter(([, motif]) => !motif.test(html)).map(([nom]) => nom);
  if (manquants.length) {
    throw new Error(
      `${page} : balise(s) d'en-tête commune(s) absente(s) — ${manquants.join(", ")}. ` +
        "Voir scripts/tete-commune.mjs : ces balises doivent figurer sur TOUTES les pages, " +
        "sans quoi le blog finit par ressembler à un autre site."
    );
  }
}
