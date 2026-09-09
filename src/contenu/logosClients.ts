/**
 * ---------------------------------------------------------------------------
 * LES FICHIERS DE LOGOS CLIENTS
 * ---------------------------------------------------------------------------
 *
 * `content/accueil/references.json` ne cite que des NOMS de fichiers. Ce module
 * les transforme en adresses réelles, empreintées par Vite.
 *
 * POURQUOI UN GLOB PLUTÔT QUE TRENTE-QUATRE IMPORTS
 * -------------------------------------------------
 * Avant, chaque logo avait sa ligne d'import et sa variable :
 *
 *     import ups from "@/assets/clients/ups.webp";
 *     …
 *     { name: "UPS", src: ups },
 *
 * Ajouter un client demandait donc d'écrire du code. Avec un glob, la liste
 * vient du contenu et le fichier est retrouvé par son nom — c'est ce qui
 * permettra au panel d'ajouter un logo sans qu'un développeur intervienne.
 *
 * `eager: true` : les adresses sont résolues à la compilation, comme avant. Le
 * ruban ne fait aucune requête supplémentaire et les fichiers restent
 * empreintés, donc cachables un an.
 *
 * ⚠️ Le motif inclut `_orig/`, où sont rangés les fichiers avant optimisation.
 * On indexe donc par NOM DE FICHIER SEUL, et une entrée de `_orig/` écraserait
 * silencieusement la bonne : le dossier est explicitement écarté.
 */

const modules = import.meta.glob<string>("@/assets/clients/*.{webp,png,jpg,jpeg,avif}", {
  eager: true,
  query: "?url",
  import: "default",
});

const parNom = new Map<string, string>();

for (const [chemin, url] of Object.entries(modules)) {
  if (chemin.includes("/_orig/")) continue;
  const nom = chemin.split("/").pop();
  if (nom) parNom.set(nom, url);
}

/**
 * L'adresse d'un logo, ou `null` s'il manque.
 *
 * DEUX ORIGINES POSSIBLES
 * -----------------------
 * Un logo envoyé depuis le panel porte déjà son adresse publique
 * (« /medias/<identifiant>.webp ») : il est recopié dans `public/medias/` par
 * `scripts/exporter-medias.mjs` avant le build, et se sert donc tel quel. Un
 * logo du dépôt, lui, passe par le glob ci-dessus pour recevoir son empreinte.
 *
 * On renvoie `null` plutôt que de lever : un logo absent doit faire un trou
 * dans le ruban, pas une page blanche. Le composant l'écarte et l'écrit dans la
 * console, ce qui se voit en développement sans casser le site en production.
 */
export const urlLogo = (fichier: string): string | null => {
  if (fichier.startsWith("/medias/")) return fichier;
  return parNom.get(fichier) ?? null;
};
