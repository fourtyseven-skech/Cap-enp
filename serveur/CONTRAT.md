# Contrat d'API du panel Megasoft

**État : préparation.** Ce document décrit ce que le serveur devra faire, sans
présumer du langage dans lequel il sera écrit. Node.js et PHP satisfont ce
contrat de la même manière — c'est justement l'intérêt de l'écrire d'abord.

Il fait autorité : le panel est codé contre ce document, et le serveur devra
s'y conformer. Toute divergence est un défaut du serveur, pas du panel.

---

## 1. Principes

**Le site public ne parle jamais à cette API.** Elle sert exclusivement le
panel d'administration. Un visiteur du site ne fait aucune requête vers elle —
c'est ce qui permet au site de rester statique et pré-généré.

**Rien n'est vrai côté navigateur.** Le rôle, l'identité et les droits sont
revérifiés par le serveur à chaque requête. Le panel affiche ou masque des
boutons pour le confort de l'utilisateur, jamais pour la sécurité : un bouton
masqué reste appelable en écrivant la requête à la main.

**La session voyage en cookie `HttpOnly`.** Jamais en jeton stocké par le
JavaScript de la page : un tel jeton est lisible par n'importe quel script
tiers qui se glisserait dans la page.

| Attribut du cookie | Valeur | Pourquoi |
|---|---|---|
| `HttpOnly` | `true` | Illisible par JavaScript |
| `Secure` | `true` | Ne circule qu'en HTTPS |
| `SameSite` | `Strict` | N'est pas envoyé depuis un autre site |
| `Path` | `/` | — |

**Toutes les réponses sont en JSON**, y compris les erreurs.

---

## 2. Forme des erreurs

Une seule forme, pour que le panel n'ait qu'un seul chemin de traitement.

```json
{
  "erreur": "code_machine",
  "message": "Phrase en français, affichable telle quelle à l'utilisateur."
}
```

| Code HTTP | `erreur` | Sens |
|---|---|---|
| 400 | `donnees_invalides` | Le corps ne respecte pas le schéma |
| 401 | `non_connecte` | Session absente ou expirée |
| 403 | `droit_insuffisant` | Connecté, mais le rôle ne permet pas l'action |
| 404 | `introuvable` | La ressource n'existe pas |
| 409 | `conflit` | Modifié entre-temps par quelqu'un d'autre (§ 6) |
| 413 | `fichier_trop_lourd` | Dépasse `POIDS_MAX_MO` |
| 429 | `trop_de_tentatives` | Limitation de débit (§ 7) |
| 500 | `erreur_serveur` | Anomalie — le détail va au journal, pas au client |

Le champ `message` est destiné à être **affiché**. Il ne doit jamais contenir
de trace technique, de requête SQL ni de nom de table : ces informations
renseignent un attaquant et n'aident pas l'éditeur.

---

## 3. Authentification

### `POST /api/connexion`

```json
{ "email": "prenom@megasoft-office.com", "motDePasse": "…" }
```

Réponse `200`, avec le cookie de session posé :

```json
{ "nom": "Prénom Nom", "email": "…", "role": "administrateur" }
```

Un e-mail inconnu et un mot de passe faux renvoient **la même erreur**,
`401 non_connecte`, avec le même message et **après le même temps de calcul**.
Distinguer les deux cas révélerait quelles adresses existent, et permettrait de
dresser la liste des comptes avant de s'attaquer aux mots de passe.

### `POST /api/deconnexion`

Détruit la session en base — pas seulement le cookie. Réponse `204`.

### `GET /api/session`

Renvoie l'utilisateur courant, ou `401`. Appelé au chargement du panel pour
savoir s'il faut afficher l'écran de connexion.

### `POST /api/mot-de-passe`

Change son PROPRE mot de passe. Corps : `{ actuel, nouveau }`. Le mot de passe
actuel est redemandé — un écran resté ouvert dans un bureau ne doit pas suffire
à prendre le compte. Douze caractères minimum pour le nouveau ; aucune règle de
casse ni de ponctuation, qui produisent des mots de passe courts et écrits sur
un post-it.

Toutes les sessions du compte sont fermées, y compris ailleurs, et la session
courante est rouverte dans la même réponse : changer son mot de passe ne
déconnecte pas. Réponse `204`.

### Il n'existe PAS de « mot de passe oublié »

Décision du client, à tenir pour définitive. Un panel d'administration n'est
pas un site grand public : un formulaire public de récupération y ajoute une
surface d'attaque — envois de courriels déclenchables par un inconnu, jetons
de réinitialisation qui traînent dans des boîtes aux lettres — pour un besoin
qui se produit deux fois par an chez trois personnes qui se connaissent.

Un compte qui perd son mot de passe est repris en main **par un
administrateur, directement en base**. Aucune route publique ne doit être
ajoutée pour cela.

---

## 4. Rôles

| Action | administrateur | redacteur | relecteur |
|---|:--:|:--:|:--:|
| Lire | ✅ | ✅ | ✅ |
| Créer et modifier un brouillon | ✅ | ✅ | — |
| Publier / dépublier | ✅ | — | — |
| Modifier le contenu des pages | ✅ | ✅ | — |
| Publier le contenu des pages | ✅ | — | — |
| Envoyer un média | ✅ | ✅ | — |
| Supprimer un média | ✅ | — | — |
| Gérer les comptes | ✅ | — | — |
| Lire le journal | ✅ | — | — |

---

## 5. Ressources

### Articles

| Méthode | Route | Rôle | Effet |
|---|---|---|---|
| `GET` | `/api/articles` | tous | Liste. `?statut=`, `?categorie=`, `?corbeille=1` |
| `GET` | `/api/articles/:slug` | tous | Un article |
| `POST` | `/api/articles` | rédacteur | Crée. `409` si le slug existe |
| `PUT` | `/api/articles/:slug` | rédacteur | Remplace. Voir § 6 |
| `POST` | `/api/articles/:slug/publier` | administrateur | `statut = publie` + reconstruction |
| `POST` | `/api/articles/:slug/depublier` | administrateur | Repasse en brouillon + reconstruction |
| `POST` | `/api/articles/:slug/archiver` | administrateur | Retire des listes sans détruire |
| `DELETE` | `/api/articles/:slug` | administrateur | Corbeille — **jamais** de suppression réelle |
| `POST` | `/api/articles/:slug/restaurer` | administrateur | Sort de la corbeille |
| `GET` | `/api/articles/:slug/versions` | tous | Historique |
| `POST` | `/api/articles/:slug/versions/:id/restaurer` | rédacteur | Restaure une version |

Changer le slug d'un article **déjà publié** crée automatiquement une
redirection `301` de l'ancienne adresse vers la nouvelle. Ce n'est pas une
option offerte à l'éditeur : sans cette redirection, chaque correction de titre
casse les liens déjà partagés et fait perdre le référencement de la page.

### Contenu des pages

| Méthode | Route | Rôle | Effet |
|---|---|---|---|
| `GET` | `/api/contenu` | tous | Toutes les sections, publié + brouillon |
| `GET` | `/api/contenu/:cle` | tous | Une section |
| `PUT` | `/api/contenu/:cle` | rédacteur | Écrit le **brouillon** uniquement |
| `POST` | `/api/contenu/:cle/publier` | administrateur | Brouillon → publié + reconstruction |
| `POST` | `/api/contenu/:cle/abandonner` | rédacteur | Efface le brouillon |
| `GET` | `/api/contenu/:cle/versions` | tous | Historique |

Le serveur **valide les données contre le schéma Zod** avant d'écrire. Un
schéma invalide donne `400`, jamais une écriture partielle : une section à
moitié écrite casserait la reconstruction du site.

### Médias

| Méthode | Route | Rôle | Effet |
|---|---|---|---|
| `GET` | `/api/medias` | tous | Liste |
| `POST` | `/api/medias` | rédacteur | Envoi `multipart/form-data` |
| `PATCH` | `/api/medias/:id` | rédacteur | Modifie le texte alternatif |
| `DELETE` | `/api/medias/:id` | administrateur | `409` si le média est référencé |

À l'envoi, **les images sont converties en WebP** puis stockées dans la base
(`medias.contenu`). Le site étant reconstruit depuis les sources présentes sur
le serveur, un fichier posé sur le disque ne survit pas forcément à un
redéploiement : la base est le seul endroit dont on sache qu'il persiste et
qu'il est sauvegardé.

Les vidéos et les PDF restent sur le disque — plusieurs mégaoctets par fichier
en `bytea` alourdiraient chaque sauvegarde.

Les déclinaisons vidéo **MP4 480p et 720p ne sont pas encore produites** :
elles demandent `ffmpeg`, dont la disponibilité sur l'hébergement reste à
confirmer.

Le type est déterminé par le **contenu** du fichier, pas par son extension ni
par l'en-tête annoncé par le navigateur. Un fichier renommé en `.jpg` reste ce
qu'il est, et les deux autres indications viennent du client, donc d'un endroit
qu'on ne contrôle pas.

### Publications

| Méthode | Route | Rôle | Effet |
|---|---|---|---|
| `GET` | `/api/publications` | tous | Les dernières reconstructions et leur état |
| `GET` | `/api/publications/:id` | tous | État d'une reconstruction |

Le panel interroge cette route pour afficher l'avancement, plutôt que de
laisser l'éditeur devant un écran muet pendant deux minutes.

### Journal et comptes

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/journal` | administrateur |
| `GET` | `/api/utilisateurs` | administrateur |
| `POST` | `/api/utilisateurs` | administrateur |
| `PATCH` | `/api/utilisateurs/:id` | administrateur |
| `DELETE` | `/api/utilisateurs/:id` | administrateur |

Le journal n'a **aucune** route d'écriture ni de suppression : les entrées sont
créées par le serveur lui-même, et la base refuse toute modification (règles
`DO INSTEAD NOTHING` de `schema.sql`).

---

## 6. Modifications simultanées

Deux personnes qui ouvrent le même article ne doivent pas s'écraser en silence.

Toute lecture renvoie un en-tête `ETag` valant la date `maj_le`. Toute écriture
doit renvoyer cette valeur dans `If-Match`.

- Valeurs identiques → l'écriture a lieu.
- Valeurs différentes → `409 conflit`, avec la version du serveur dans le
  corps, pour que le panel puisse montrer l'écart.

Une écriture **sans** `If-Match` est refusée en `400`. Un client qui oublie
l'en-tête ne doit pas obtenir par défaut le comportement le plus destructeur.

### Les trois étages

La détection ci-dessus est indispensable, mais elle intervient **une fois le
travail écrit**. Deux étages l'encadrent.

**Avant — la présence.** `PUT /api/presence` avec `{ ressource }` signale qu'on
ouvre un élément et renvoie **les autres** personnes qui l'ont ouvert, avec
leur nom et depuis combien de temps. Le panel bat toutes les 30 s ; le serveur
oublie une présence non rafraîchie au bout de 90 s. `DELETE /api/presence`
libère explicitement, et la déconnexion efface toutes les présences du compte.

La ressource s'écrit `article:<slug>` ou `contenu:<clé>`. Deux ressources
différentes sont indépendantes : deux personnes sur deux sections distinctes ne
se gênent pas.

Ce n'est **pas un verrou** : rien n'est bloqué, on peut écrire malgré
l'avertissement. Un verrou véritable demanderait de savoir le lever quand
personne ne revient — onglet fermé, réunion, panne de réseau — et une équipe de
trois personnes se retrouverait régulièrement devant un élément verrouillé par
quelqu'un qui n'y est plus.

Ces présences vivent **en mémoire** et non en base : elles durent quelques
minutes et n'ont aucune valeur le lendemain. Un redémarrage les efface, ce qui
est le comportement voulu. Le jour où l'API tournerait en plusieurs exemplaires,
il faudrait les déplacer dans un cache partagé.

Cette route est **hors du quota d'écriture** : battre toutes les 30 s
consommerait le quota d'une personne qui n'a fait que laisser un écran ouvert.

**Après — la résolution.** Le corps du `409` contient la version du serveur.
Le panel affiche les deux versions champ par champ (`src/admin/Conflit.tsx`) et
propose deux issues explicites : garder la sienne — ce qui relit l'étiquette
puis réécrit par-dessus — ou reprendre celle du serveur. **Aucune fusion
automatique** : prendre le titre de l'un et le corps de l'autre produit des
textes incohérents que personne ne relit.

---

## 7. Limitation de débit

| Route | Limite |
|---|---|
| `POST /api/connexion` | 5 tentatives / 15 min / IP **et** / e-mail |
| Écritures | 60 / min / session |
| Envoi de média | 20 / heure / session |

La double limite sur la connexion est nécessaire : par IP seule, un attaquant
réparti sur plusieurs adresses passe ; par e-mail seul, il suffit de viser
plusieurs comptes.

---

## 8. Journalisation

Le serveur écrit dans `journal` pour : connexion, connexion refusée,
déconnexion, création, modification, publication, dépublication, archivage,
suppression, restauration, ajout et suppression de média, modification de rôle,
et publication du contenu d'une page.

Une entrée contient toujours : la date, l'e-mail de l'acteur, l'action, la
cible et l'adresse IP. **L'e-mail est stocké en texte**, pas en référence vers
`utilisateurs` : la trace doit survivre à la suppression du compte, sans quoi
effacer un compte effacerait l'historique de ce qu'il a fait.

---

## 9. Première mise en service

Dans l'ordre, le jour où les accès sont connus :

1. Créer la base et exécuter `psql -f serveur/schema.sql`.
2. Créer le compte applicatif restreint (fin de `schema.sql`).
3. Copier `serveur/.env.example` en `serveur/.env` et remplacer les valeurs
   marquées « À REMPLACER ».
4. Créer le premier administrateur **par une commande du serveur**, qui
   demande le mot de passe et calcule l'empreinte. Jamais par un `INSERT`
   écrit à la main : un mot de passe tapé dans un terminal reste dans
   l'historique du shell.
5. Lancer le script d'extraction, qui remplit `contenu_pages` avec le contenu
   aujourd'hui codé en dur dans les composants.
6. Déclarer `VITE_API_URL` côté panel — c'est cette seule variable qui fait
   basculer le panel du stockage navigateur vers le serveur.
7. Vérifier la recette de bout en bout : écrire, publier, corriger,
   dépublier, restaurer, changer une image.

---

## 10. Ce que ce contrat ne couvre pas encore

À trancher quand le client aura communiqué ses informations :

- **Sauvegardes** : fréquence, rétention, et surtout **test de restauration**.
  Une sauvegarde jamais restaurée n'est pas une sauvegarde.
- ~~**Envoi d'e-mails**~~ — **fait le 6 septembre 2026.** Un seul message :
  l'invitation à la création d'un compte. Le service SMTP reste facultatif :
  sans `SMTP_HOTE`, le panel fonctionne entièrement et affiche le mot de passe
  provisoire à l'écran. Voir `serveur/.env.example`.
- **Parutions programmées** : la commande `npm run parutions` existe et fait
  paraître les articles dont la date est arrivée. Elle attend une tâche `cron`
  quotidienne chez l'hébergeur — le mode d'emploi est en fin de
  `src/outils/parutions.ts`.
- **Journal des builds** : la sortie de la reconstruction est déjà capturée
  (ses 1 500 derniers caractères en cas d'échec). Faut-il l'afficher au client
  dans le panel, ou la réserver au développeur ?
