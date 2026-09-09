# Originaux des logos clients

Les fichiers de ce dossier sont les versions **avant optimisation** des logos —
PNG et JPEG remplacés par leur équivalent WebP dans le dossier parent.

Ils sont rangés ici et non supprimés : si un logo devait être ré-optimisé un
jour, mieux vaut repartir de l'original que d'un WebP déjà compressé.

## Pourquoi ils ne peuvent pas rester à côté des autres

Le ruban de références lit désormais son dossier par `import.meta.glob`
(`src/contenu/logosClients.ts`), ce qui permet d'ajouter un client sans écrire
de code. Mais un glob emporte dans le site construit **tous** les fichiers qu'il
rencontre, référencés ou non.

Laissés dans le dossier parent, ces onze fichiers ajoutaient 522 Ko à `dist/`
pour des images que personne n'affiche. Le motif du glob ne descend pas dans les
sous-dossiers : les ranger ici suffit à les en sortir.
