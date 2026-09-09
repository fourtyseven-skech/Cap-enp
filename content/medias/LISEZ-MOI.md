# Images envoyées depuis le panel, en mode local

Ce dossier est la **source** des images quand le site tourne sans base de
données — c'est-à-dire pendant le développement, et pour la démonstration au
client avant que l'hébergement ne soit fourni.

## Pourquoi ici et pas dans `public/medias/`

`public/medias/` est un dossier **dérivé** : il est reconstruit à chaque build,
soit depuis la base (`scripts/exporter-medias.mjs`), soit depuis ce dossier-ci
quand il n'y a pas de base. Il n'est pas versionné, et tout fichier qu'il
contient sans être connu de sa source est effacé.

Une image déposée directement dans `public/medias/` disparaîtrait donc au
premier build. Ici, elle est versionnée et suit le dépôt.

## Le jour où la base existe

Les images envoyées depuis le panel partent alors en base, converties en WebP,
et `public/medias/` est reconstruit à partir d'elle. Ce dossier reste comme
archive de ce qui a été fait avant — rien ne le lit plus, rien ne l'efface.
