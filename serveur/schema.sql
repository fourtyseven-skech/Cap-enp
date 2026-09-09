-- ===========================================================================
--  MEGASOFT -- SCHÉMA DE LA BASE DE DONNÉES DU PANEL
--  PostgreSQL 13 ou supérieur
-- ===========================================================================
--
--  ÉTAT : PRÉPARATION
--  ------------------
--  Ce fichier est écrit AVANT d'avoir accès au serveur du client. Il ne
--  contient aucune information réelle : pas de mot de passe, pas d'hôte, pas
--  de nom de base. Tout ce qui devra être remplacé plus tard est signalé par
--  un commentaire « À REMPLACER ».
--
--  Il est exécutable tel quel sur une base PostgreSQL vide, y compris une base
--  locale de test -- c'est même recommandé : on saura que le schéma est correct
--  bien avant d'avoir les accès du client.
--
--      createdb megasoft_panel
--      psql -d megasoft_panel -f serveur/schema.sql
--
--  DEUX PRINCIPES QUI EXPLIQUENT LA PLUPART DES CHOIX CI-DESSOUS
--  ------------------------------------------------------------
--  1. Le site reste STATIQUE. La base n'est jamais lue par un visiteur : elle
--     est lue au moment de la reconstruction du site. C'est ce qui préserve la
--     pré-génération des pages, le llms.txt et les scores de performance.
--
--  2. Ce qui doit prouver quelque chose ne doit pas être modifiable. Le
--     journal d'activité est en AJOUT SEUL, garanti par la base elle-même et
--     non par la discipline du code -- voir la section « journal ».
--
-- ===========================================================================

BEGIN;

-- `gen_random_uuid()` vient de cette extension sur PostgreSQL 13.
-- À partir de PostgreSQL 14 elle est native, mais l'appel reste valide.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ===========================================================================
--  1. UTILISATEURS ET SESSIONS
-- ===========================================================================
--
--  L'authentification est faite par NOTRE serveur, avec les comptes de la
--  Direction -- c'est la décision retenue : le client se connecte avec son
--  adresse professionnelle, pas avec un compte GitHub.

CREATE TYPE role_utilisateur AS ENUM (
  'administrateur',  -- tout, y compris la gestion des comptes
  'redacteur',       -- écrit et soumet, ne publie pas
  'relecteur'        -- lit et commente, n'écrit pas
);

CREATE TABLE utilisateurs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  nom             text NOT NULL,
  role            role_utilisateur NOT NULL DEFAULT 'redacteur',

  -- Empreinte du mot de passe, JAMAIS le mot de passe.
  -- Algorithme imposé : bcrypt (coût 12) ou argon2id. Le code du serveur ne
  -- doit accepter aucune autre forme -- une empreinte MD5 ou SHA-1 qui se
  -- glisserait ici serait cassable en quelques heures.
  empreinte_mdp   text NOT NULL,

  actif           boolean NOT NULL DEFAULT true,
  cree_le         timestamptz NOT NULL DEFAULT now(),
  derniere_connexion timestamptz
);

-- La recherche se fait toujours sur l'e-mail, insensible à la casse :
-- « Directeur@... » et « directeur@... » sont la même personne.
CREATE UNIQUE INDEX utilisateurs_email_unique ON utilisateurs (lower(email));

-- Sessions en base plutôt que jetons JWT autoportants.
-- Raison : une session en base se RÉVOQUE. Un JWT signé reste valide jusqu'à
-- son expiration, même après un départ ou un vol de poste -- il n'existe aucun
-- moyen de le rappeler. Pour un panel à trois ou quatre personnes, le coût
-- d'une requête supplémentaire est négligeable face à ce gain.
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur   uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,

  -- On stocke l'EMPREINTE du jeton, pas le jeton. Si la base fuite, les
  -- sessions en cours ne sont pas utilisables pour autant.
  empreinte_jeton text NOT NULL UNIQUE,

  cree_le       timestamptz NOT NULL DEFAULT now(),
  expire_le     timestamptz NOT NULL,
  ip            inet,
  agent         text
);

CREATE INDEX sessions_utilisateur ON sessions (utilisateur);
CREATE INDEX sessions_expiration ON sessions (expire_le);



-- ===========================================================================
--  2. ARTICLES
-- ===========================================================================
--
--  Les colonnes reprennent EXACTEMENT les noms des champs du panel
--  (`src/admin/depot.ts`, type `ArticleLocal`). C'est volontaire : aucune
--  table de correspondance à maintenir, et une erreur de nommage se voit
--  immédiatement plutôt qu'au premier enregistrement.

-- Quatre valeurs, et non deux.
--
-- La première version de ce fichier n'en déclarait que 'brouillon' et
-- 'publie'. L'écart a été trouvé en écrivant le client HTTP du panel :
-- l'éditeur manipule aussi 'relecture' et 'programme' (type `Brouillon`,
-- src/admin/brouillon.ts). Un article soumis à relecture aurait été refusé
-- par la base, en production, sur un texte déjà rédigé.
CREATE TYPE statut_article AS ENUM ('brouillon', 'relecture', 'programme', 'publie');

CREATE TABLE articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Le slug est l'adresse publique : /blog/<slug>/. Il est unique et ne
  -- devrait jamais changer après publication -- d'où la table `redirections`.
  slug            text NOT NULL UNIQUE,

  titre           text NOT NULL,
  chapeau         text NOT NULL DEFAULT '',
  corps           text NOT NULL DEFAULT '',

  categorie       text NOT NULL DEFAULT '',
  format          text NOT NULL DEFAULT '',
  accent          text,
  motif           text,

  titre_fantome   text NOT NULL DEFAULT '',
  reponse         text NOT NULL DEFAULT '',
  version         text NOT NULL DEFAULT '',   -- version du produit citée, pas du schéma
  exergue         text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  auteur          text NOT NULL DEFAULT 'Équipe Megasoft',

  -- Étiquettes : un vrai tableau PostgreSQL, pas une chaîne « a, b, c ».
  -- Le panel les saisit séparées par des virgules ; la conversion se fait
  -- côté serveur, une fois, plutôt que dans chaque requête de lecture.
  etiquettes      text[] NOT NULL DEFAULT '{}',

  -- Questions/réponses de fin d'article, alimentant aussi le JSON-LD FAQPage.
  -- jsonb et non json : indexable, et normalisé à l'écriture.
  faq             jsonb NOT NULL DEFAULT '[]'::jsonb,

  statut          statut_article NOT NULL DEFAULT 'brouillon',
  publie_le       date,
  maj_le          timestamptz NOT NULL DEFAULT now(),

  -- Archivé n'est pas supprimé. Une page déjà indexée qui disparaît fait perdre le
  -- référencement acquis et laisse des liens morts sur le web : on la retire
  -- des listes sans la détruire.
  archive         boolean NOT NULL DEFAULT false,

  -- Corbeille, réversible.
  supprime        boolean NOT NULL DEFAULT false,

  -- Article de démonstration, non validé par la Direction. Le drapeau fait
  -- afficher un bandeau sur la page ; il ne l'empêche pas de paraître.
  maquette        boolean NOT NULL DEFAULT false,

  -- Vignette de l'article : « /medias/<identifiant>.webp », ou vide.
  --
  -- Vide, l'article garde sa couverture VECTORIELLE, construite a partir du
  -- motif et de l'accent. Ce n'est pas un repli au rabais : ces couvertures
  -- pesent quelques kilo-octets et sont nettes a toute taille.
  --
  -- Remplie, l'image prend leur place : liste du blog, tete d'article, et image
  -- de partage sur les reseaux.
  image           text NOT NULL DEFAULT '',

  cree_par        uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le         timestamptz NOT NULL DEFAULT now(),

  -- Un article publié OU programmé a forcément une date de parution : sans
  -- elle, la reconstruction du site ne saurait ni où le classer, ni quand le
  -- faire paraître. Le contrôle appartient à la base et non au code, pour
  -- qu'il tienne quel que soit le chemin d'écriture emprunté.
  CONSTRAINT date_si_datee CHECK (statut NOT IN ('publie', 'programme') OR publie_le IS NOT NULL)
);

CREATE INDEX articles_statut ON articles (statut) WHERE NOT supprime;
-- Les articles programmés sont relus à chaque reconstruction pour savoir
-- lesquels doivent désormais paraître : l'index évite un parcours complet.
CREATE INDEX articles_programmes ON articles (publie_le) WHERE statut = 'programme';
CREATE INDEX articles_categorie ON articles (categorie);
CREATE INDEX articles_publie_le ON articles (publie_le DESC NULLS LAST);


-- Historique. Une ligne par enregistrement, jamais écrasée.
CREATE TABLE article_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article       uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

  -- L'article complet au moment de l'enregistrement. On stocke tout plutôt
  -- qu'un écart : restaurer une version doit rester une simple copie, sans
  -- rejouer une chaîne de modifications qui pourrait être incomplète.
  contenu       jsonb NOT NULL,

  acteur        uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX article_versions_article ON article_versions (article, cree_le DESC);


-- Redirections : quand un slug change, l'ancienne adresse doit continuer à
-- répondre. Sans cela, chaque correction de titre casse un lien déjà partagé
-- et fait perdre le référencement de la page.
CREATE TABLE redirections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depuis      text NOT NULL UNIQUE,   -- /blog/ancien-slug/
  vers        text NOT NULL,          -- /blog/nouveau-slug/
  code        smallint NOT NULL DEFAULT 301,
  cree_le     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT code_de_redirection CHECK (code IN (301, 302, 308))
);


-- ===========================================================================
--  3. CONTENU DES PAGES
-- ===========================================================================
--
--  C'est ce qui rendra la page d'accueil éditable. Chaque section du site
--  devient une ligne : « accueil.hero », « accueil.chiffres », etc.
--
--  Pourquoi du jsonb et non une table par section : les sections n'ont rien
--  en commun (le Hero a trois vidéos, les Chiffres ont quatre nombres, les
--  Solutions ont trois pôles imbriqués). Une table par section ferait douze
--  tables et douze migrations à chaque évolution. Le jsonb laisse la forme au
--  schéma Zod, qui est déjà partagé entre le panel et le site.

CREATE TABLE contenu_pages (
  -- Identifiant lisible et stable : « accueil.qui-sommes-nous ».
  cle             text PRIMARY KEY,

  -- Libellé affiché dans le panel, pour éviter que l'éditeur ne lise des clés.
  libelle         text NOT NULL,

  -- Version publiée : c'est elle que lit la reconstruction du site.
  donnees         jsonb NOT NULL,

  -- Version en cours d'édition. NULL = aucune modification en attente.
  -- Deux colonnes plutôt que deux lignes : l'écart entre les deux est ce que
  -- le panel affiche avant publication, et il se calcule sans jointure.
  brouillon       jsonb,

  -- Numéro de version du schéma Zod ayant produit ces données. Sans lui, une
  -- évolution du modèle rendrait illisible tout le contenu déjà en base.
  schema_version  integer NOT NULL DEFAULT 1,

  maj_le          timestamptz NOT NULL DEFAULT now(),
  maj_par         uuid REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- Historique du contenu des pages, même principe que pour les articles.
CREATE TABLE contenu_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle         text NOT NULL REFERENCES contenu_pages(cle) ON DELETE CASCADE,
  donnees     jsonb NOT NULL,
  acteur      uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contenu_versions_cle ON contenu_versions (cle, cree_le DESC);


-- ===========================================================================
--  4. MÉDIAS
-- ===========================================================================
--
--  La base ne stocke QUE les métadonnées. Les fichiers eux-mêmes vont sur un
--  stockage d'objets ou un dossier du serveur -- mettre des vidéos dans une
--  colonne PostgreSQL fonctionnerait, mais rendrait les sauvegardes énormes et
--  la livraison lente.

CREATE TABLE medias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           text NOT NULL,
  type_mime     text NOT NULL,            -- ce qui est REELLEMENT stocke
  type_origine  text,                     -- ce qui a ete envoye, avant conversion
  taille        bigint NOT NULL,          -- en octets, apres conversion
  largeur       integer,                  -- images et videos
  hauteur       integer,
  duree         numeric(8,2),             -- videos, en secondes

  -- LES IMAGES SONT DANS LA BASE, LES VIDEOS SUR LE DISQUE
  -- -----------------------------------------------------
  -- Les images sont converties en WebP a l'envoi puis stockees ici meme. Le
  -- site etant reconstruit depuis le depot Git, un fichier depose sur le disque
  -- du serveur ne survit pas forcement a un redeploiement ni a un changement de
  -- machine : la base est le seul endroit dont on sait qu'il persiste et qu'il
  -- est sauvegarde. Une image WebP pese quelques dizaines de kilo-octets, ce
  -- que PostgreSQL gere sans difficulte.
  --
  -- Les videos, elles, restent sur le disque : plusieurs mega-octets par
  -- fichier en `bytea` alourdiraient chaque sauvegarde de la base et
  -- ralentiraient les requetes qui n'en ont pas besoin.
  contenu       bytea,                    -- images : les octets WebP
  chemin        text UNIQUE,              -- videos et PDF : chemin relatif au stockage

  -- Texte alternatif. Obligatoire pour une image de contenu : c'est une
  -- exigence d'accessibilité, et le panel doit refuser l'enregistrement sans.
  -- La base ne peut pas l'imposer (une vidéo décorative n'en a pas besoin),
  -- donc ce contrôle appartient au serveur.
  alt           text,

  -- Déclinaisons produites à l'import : WebP pour les images, MP4 480p et
  -- 720p pour les vidéos -- exactement ce que contient public/videos/.
  -- Forme : [{"profil":"720","chemin":"...","taille":123456}]
  declinaisons  jsonb NOT NULL DEFAULT '[]'::jsonb,

  ajoute_par    uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  ajoute_le     timestamptz NOT NULL DEFAULT now(),

  -- Un media est soit en base, soit sur le disque -- jamais les deux, jamais
  -- aucun des deux. Sans cette contrainte, une erreur de code produirait une
  -- ligne qui ne pointe vers rien, et l'image cassee ne se verrait qu'en ligne.
  CONSTRAINT contenu_ou_chemin CHECK ((contenu IS NULL) <> (chemin IS NULL))
);

CREATE INDEX medias_type ON medias (type_mime);


-- ===========================================================================
--  5. JOURNAL D'ACTIVITÉ -- EN AJOUT SEUL
-- ===========================================================================
--
--  Un journal modifiable par celui qu'il devrait tracer ne prouve rien. Le
--  journal actuel du panel vit dans le navigateur et se vide d'un clic : il
--  n'a aucune valeur.
--
--  L'interdiction est posée ICI, dans la base, et non dans le code du serveur.
--  Une consigne dans le code se contourne en écrivant une autre requête ; une
--  règle PostgreSQL s'applique à toute connexion, y compris un psql ouvert à
--  la main par un administrateur.

CREATE TABLE journal (
  id          bigserial PRIMARY KEY,
  date        timestamptz NOT NULL DEFAULT now(),
  acteur      text NOT NULL,              -- e-mail, conservé même si le compte est supprimé
  action      text NOT NULL,
  cible       text NOT NULL,
  detail      text,
  ip          inet
);

CREATE INDEX journal_date ON journal (date DESC);
CREATE INDEX journal_acteur ON journal (acteur, date DESC);

-- Ces deux règles transforment toute tentative de modification ou de
-- suppression en opération vide. Elles ne lèvent pas d'erreur : une erreur
-- indiquerait à un attaquant que la protection existe.
CREATE RULE journal_pas_de_modification AS ON UPDATE TO journal DO INSTEAD NOTHING;
CREATE RULE journal_pas_de_suppression  AS ON DELETE TO journal DO INSTEAD NOTHING;


-- ===========================================================================
--  6. PUBLICATIONS
-- ===========================================================================
--
--  Chaque publication déclenche une reconstruction du site. Cette table permet
--  au panel d'afficher « publication en cours... » puis « en ligne », au lieu de
--  laisser l'éditeur devant un écran muet pendant deux minutes.

CREATE TYPE etat_publication AS ENUM ('demandee', 'en_cours', 'reussie', 'echouee');

CREATE TABLE publications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etat          etat_publication NOT NULL DEFAULT 'demandee',
  demandee_par  uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  demandee_le   timestamptz NOT NULL DEFAULT now(),
  terminee_le   timestamptz,

  -- Identifiant renvoyé par l'hébergeur, pour retrouver le journal du build.
  reference     text,
  message       text
);

CREATE INDEX publications_date ON publications (demandee_le DESC);


-- ===========================================================================
--  7. DONNÉES DE DÉPART
-- ===========================================================================
--
--  /!\ À REMPLACER -- valeurs génériques de préparation.
--
--  Le premier compte administrateur doit être créé par le serveur, avec une
--  vraie empreinte bcrypt, et JAMAIS par ce fichier : une empreinte écrite en
--  dur dans un fichier versionné est un mot de passe public.
--
--  La commande à exécuter le jour de la mise en service figure dans
--  serveur/CONTRAT.md, section « Première mise en service ».

-- Les clés des sections de la page d'accueil, dans l'ordre réel de la page.
-- Les données sont vides : elles seront remplies par le script d'extraction
-- qui lira le contenu actuellement codé en dur dans les composants.
-- La CLE est exactement le nom du fichier dans `content/accueil/`, sans son
-- extension. Une premiere version prefixait les cles (`accueil.hero`,
-- `commun.entete`) : il fallait alors une table de correspondance entre la base
-- et les fichiers, donc un endroit de plus ou les deux pouvaient diverger.
--
-- Les donnees sont vides a l'installation : elles sont remplies par
-- `npm run importer-contenu`, qui lit les fichiers du depot. Tant qu'une
-- section est vide, l'export la laisse tranquille -- sans quoi la premiere
-- construction ecraserait le contenu du site par des objets vides.
INSERT INTO contenu_pages (cle, libelle, donnees) VALUES
  ('hero',            'Hero',            '{}'::jsonb),
  ('chiffres',        'Chiffres',        '{}'::jsonb),
  ('qui-sommes-nous', 'Qui sommes-nous', '{}'::jsonb),
  ('solutions',       'Solutions',       '{}'::jsonb),
  ('mega-erp',        'MEGA ERP',        '{}'::jsonb),
  ('pourquoi-nous',   'Pourquoi nous',   '{}'::jsonb),
  ('partenaires',     'Partenaires',     '{}'::jsonb),
  ('avis',            'Avis',            '{}'::jsonb),
  ('references',      'Références',      '{}'::jsonb),
  ('contact',         'Contact',         '{}'::jsonb),
  ('entete',          'En-tête',         '{}'::jsonb),
  ('pied',            'Pied de page',    '{}'::jsonb),
  -- Les sections que le client ajoute lui-meme, a partir des gabarits. Vide au
  -- depart : la page reste exactement telle qu'elle est.
  ('sections-libres', 'Sections libres', '{}'::jsonb);

COMMIT;

-- ===========================================================================
--  APRÈS L'INSTALLATION -- À FAIRE PAR L'ADMINISTRATEUR DE LA BASE
-- ===========================================================================
--
--  Le serveur applicatif ne doit PAS se connecter en tant que propriétaire de
--  la base. Un compte applicatif restreint limite les dégâts d'une injection
--  SQL ou d'une erreur de code : il peut lire et écrire, mais ne peut pas
--  supprimer une table.
--
--  /!\ À REMPLACER -- « mot_de_passe_a_definir » n'est pas un mot de passe.
--      Générer une chaîne aléatoire d'au moins 32 caractères et la placer
--      dans serveur/.env, jamais dans ce fichier.
--
--    CREATE USER megasoft_app WITH PASSWORD 'mot_de_passe_a_definir';
--    GRANT CONNECT ON DATABASE megasoft_panel TO megasoft_app;
--    GRANT USAGE ON SCHEMA public TO megasoft_app;
--    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
--      TO megasoft_app;
--    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO megasoft_app;
--
--  Le compte applicatif reçoit UPDATE et DELETE sur `journal` comme sur le
--  reste -- c'est sans effet : les deux règles ci-dessus les neutralisent au
--  niveau de la table, quel que soit le compte utilisé.
-- ===========================================================================
