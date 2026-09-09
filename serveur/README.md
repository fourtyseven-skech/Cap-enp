# Serveur du panel Megasoft

API du panel d'administration. Node.js, Express 5, PostgreSQL.
Implémente [`CONTRAT.md`](./CONTRAT.md) — qui fait autorité en cas de désaccord.

**Le site public ne parle jamais à ce serveur.** Le site reste statique et
pré-généré ; cette API ne sert que le panel. C'est ce qui préserve les pages
générées au build, le `llms.txt` et les scores de performance.

---

## Essayer maintenant, sans rien installer

```bash
cd serveur
npm install
npm run recette
```

Deux recettes existent : `npm run recette` (l'API) et `npm run recette-pont`
(le pont base ↔ site, décrit plus bas).

La première démarre une **vraie base PostgreSQL** (binaire téléchargé au premier
lancement), y installe le schéma, lance l'API et l'exerce par des requêtes HTTP
— exactement comme le fera le panel. Tout est effacé à la fin.

C'est le moyen le plus rapide de vérifier que le serveur fonctionne avant
d'avoir le moindre accès du client. Elle couvre 58 points : connexion,
verrouillage après tentatives répétées, création et publication d'articles,
conflits d'édition, rôles, redirections automatiques, corbeille, et le caractère
inaltérable du journal.

---

## Mise en service réelle

### 1. La base

```bash
createdb megasoft_panel
psql -d megasoft_panel -f schema.sql
```

Sans `psql` sur la machine — courant sous Windows et sur beaucoup
d'hébergements mutualisés :

```bash
npm run installer-schema
```

Puis créer le compte applicatif restreint (instructions en fin de `schema.sql`).
Le serveur ne doit **pas** se connecter en tant que propriétaire de la base.

### 2. La configuration

```bash
cp .env.example .env
```

Remplacer chaque valeur marquée **« À REMPLACER »**. Le fichier indique pour
chacune qui doit la fournir : le client (base, stockage, reconstruction) ou vous
(clés de session, à générer).

Le serveur **refuse de démarrer** si une valeur d'exemple subsiste, si le secret
de session fait moins de 32 caractères, ou si l'origine autorisée vaut `*`. Un
réglage dangereux doit empêcher le démarrage, pas se manifester trois heures
plus tard.

### 3. Les articles existants

```bash
npm run importer-fichiers
```

Lit `content/blog/*.md` et les installe en base. **À faire avant de brancher le
panel** : une fois `VITE_API_URL` déclarée, le panel n'affiche plus que ce que
le serveur lui renvoie. Sans cette migration, la Direction ouvrirait un panel
vide alors que cinq articles sont en ligne — et la première publication les
effacerait tous du site.

Sans effet si relancée : un slug déjà présent est ignoré, jamais écrasé.

### 4. Le premier administrateur

```bash
npm run creer-admin
```

Le mot de passe est saisi à l'écran, sans écho. Jamais en argument de ligne de
commande : il resterait dans l'historique du shell et se lirait dans la liste
des processus.

### 5. Démarrage

```bash
npm run build
npm start
```

### 6. Brancher le panel et le site

Deux variables, dans le `.env` **du site** (pas celui-ci) :

```
VITE_API_URL=https://api.megasoft-office.com
DATABASE_URL=postgres://…            # la même que ce serveur
```

`VITE_API_URL` fait basculer le PANEL du navigateur vers le serveur.
`DATABASE_URL` fait lire les articles depuis la base au moment du BUILD.

Les deux sont nécessaires, et pour des raisons différentes : sans la première le
client écrit dans son navigateur, sans la seconde ce qu'il publie reste en base
sans jamais atteindre le site.

Absentes, tout continue comme aujourd'hui : panel local, articles lus dans les
fichiers versionnés.

---

## Le pont base ↔ site

Le panel écrit dans PostgreSQL. Le blog, lui, lit `content/blog/*.md` par
`import.meta.glob`, **résolu à la compilation**. Deux scripts relient les deux.

| Sens | Script | Quand |
|---|---|---|
| fichiers → base | `npm run importer-fichiers` | une fois, à la migration |
| articles : base → fichiers | `scripts/exporter-articles.mjs` (site) | avant chaque build |
| médias : base → `public/medias/` | `scripts/exporter-medias.mjs` (site) | avant chaque build |
| redirections : base → `.htaccess` | `scripts/exporter-redirections.mjs` (site) | avant chaque build |

Les trois sont branchés sur le `prebuild` du site : `npm run build` les lance
seul. Sans `DATABASE_URL`, ils ne font rien et le build lit les fichiers
versionnés.

Le troisième mérite une mention : renommer un article publié écrit une
redirection 301 en base, mais **rien ne l'appliquait**. Les anciennes adresses
continuaient de répondre 404 pendant que la table se remplissait. Le script
écrit désormais les règles dans `public/.htaccess`, entre deux marques.

**Il efface des fichiers.** Trois règles l'encadrent :

1. il ne touche que les fichiers portant `origine: base` dans leur en-tête —
   un article écrit à la main dans le dépôt n'est jamais supprimé ;
2. si la base ne renvoie aucun article, il ne supprime rien et prévient : une
   base vide est presque toujours une erreur de configuration, et le blog
   entier disparaîtrait ;
3. une base injoignable **interrompt le build** — publier un site amputé de ses
   articles serait pire qu'un build en échec.

```bash
npm run recette-pont
```

Fait l'aller-retour complet sur les vrais articles du site, dans un dossier
temporaire, et compare l'arrivée au départ champ par champ. 14 vérifications.

---

## Reconstruction du site

Publier ne change pas une page en direct : cela reconstruit le site. Deux modes,
selon l'hébergement.

Le site est hébergé **chez PlanetHoster, sur le serveur du client**. Ni Netlify
ni Cloudflare ni GitHub n'interviennent : le panneau N0C fournit SSH, Node et
npm, et la reconstruction a lieu sur place, dans le dossier du site.

```
COMMANDE_RECONSTRUCTION=npm ci && npm run build
REPERTOIRE_SITE=/home/compte/megasoft-site
```

Pas de `git pull` : les sources sont déjà sur le serveur, elles n'y arrivent pas
par un dépôt distant.

Si la commande n'est pas configurée, la publication est **quand même
enregistrée**, avec un message explicite dans le panel. Le contenu est en base
et partira à la prochaine reconstruction. Laisser croire à une mise en ligne qui
n'a pas eu lieu serait pire que d'annoncer un réglage manquant.

---

## Organisation

| Fichier | Rôle |
|---|---|
| `src/app.ts` | Construction de l'application — l'ordre des middlewares **est** la sécurité |
| `src/index.ts` | Démarrage, arrêt propre |
| `src/config.ts` | Lecture et **vérification** de la configuration |
| `src/bd.ts` | Accès PostgreSQL, transactions |
| `src/session.ts` | Cookies, mots de passe, rôles |
| `src/securite.ts` | Origine, en-têtes, limitation de débit |
| `src/validation.ts` | Schémas Zod des entrées |
| `src/journal.ts` | Journal en ajout seul |
| `src/publication.ts` | Déclenchement des reconstructions |
| `src/routes/` | Articles, contenu des pages, médias, comptes |
| `src/outils/` | `creer-admin`, `installer-schema`, `recette` |

---

## Décisions à connaître avant de modifier

**Sessions en base, pas de JWT.** Une session en base se révoque ; un JWT signé
reste valide jusqu'à son expiration, même après un départ ou un vol de poste.

**Le journal est inaltérable, garanti par PostgreSQL.** Deux règles
`DO INSTEAD NOTHING` neutralisent `UPDATE` et `DELETE` sur la table — y compris
depuis un `psql` ouvert à la main. Un journal que l'on peut effacer ne prouve
rien. La recette le vérifie en tentant réellement de le falsifier.

**Aucune route ne détruit un article.** La suppression est une corbeille. Une
page déjà indexée qui disparaît fait perdre le référencement acquis et laisse
des liens morts.

**Renommer un article publié crée une redirection 301, sans demander.** Ce n'est
pas une case à cocher : personne n'y penserait, et chaque oubli casse les liens
déjà partagés.

**Les valeurs ne se concatènent jamais dans une requête SQL.** Toutes passent
par `$1`, `$2`… Aucune exception, y compris « juste pour ce cas-là ».

**Le rôle est revérifié à chaque requête, côté serveur.** Le panel masque des
boutons pour le confort ; un bouton masqué reste appelable à la main.

---

## Reste à faire

- **Déclinaisons des médias** — WebP pour les images, MP4 480p/720p pour les
  vidéos. Demande `sharp` (module natif) et `ffmpeg` (binaire système) : à
  trancher une fois connu ce que fournit réellement l'hébergement. Les
  originaux sont stockés et servis en attendant, et le champ `declinaisons`
  reste vide plutôt que de lister des chemins qui ne mèneraient nulle part.
- **Envoi d'e-mails** — invitation d'un compte, réinitialisation de mot de
  passe. Nécessite un service SMTP fourni par le client. En attendant, la
  création d'un compte renvoie un mot de passe provisoire à transmettre de vive
  voix.
- **Publication des articles programmés** — une tâche `cron` devra relancer une
  reconstruction quand la date d'un article programmé est atteinte. L'index
  `articles_programmes` est déjà en place pour cela.
