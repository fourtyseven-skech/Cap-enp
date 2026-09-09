import { readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Server } from "node:http";
import EmbeddedPostgres from "embedded-postgres";

/**
 * ---------------------------------------------------------------------------
 * RECETTE DE BOUT EN BOUT
 * ---------------------------------------------------------------------------
 *
 *     npm run recette
 *
 * Démarre une VRAIE base PostgreSQL, y installe `schema.sql`, lance l'API et
 * exerce le contrat depuis l'extérieur — par des requêtes HTTP, comme le fera
 * le panel.
 *
 * POURQUOI UNE BASE EMBARQUÉE
 * ---------------------------
 * PostgreSQL n'est installé ni sur le poste de développement, ni forcément
 * chez le client au moment où l'on écrit ce code. Sans base, le serveur ne
 * pouvait être que compilé — ce qui ne prouve rien : un schéma peut être
 * syntaxiquement correct et refuser la première écriture.
 *
 * `embedded-postgres` télécharge un vrai binaire PostgreSQL et le lance sur un
 * port libre. Ce n'est pas un émulateur : les contraintes, les types énumérés
 * et les règles du journal sont réellement appliqués. Tout est effacé à la fin.
 *
 * CE QUE CETTE RECETTE VÉRIFIE
 * ----------------------------
 * Le parcours réel d'un éditeur, et les refus qui doivent l'accompagner :
 * connexion, écriture, publication, conflit d'édition, droits, redirection
 * automatique, journal inaltérable.
 */

const PORT_BD = 54_329;
const DOSSIER_BD = resolve(process.cwd(), ".pg-recette");

/**
 * Efface le dossier de la base.
 *
 * Tolérant à l'échec : sous Windows, PostgreSQL garde brièvement ses fichiers
 * ouverts après l'arrêt, et un `rm` immédiat échoue en EPERM. Un dossier
 * temporaire qui survit est sans conséquence -- il est ignoré par git et
 * réinitialisé au prochain lancement.
 */
const nettoyer = () => {
  try {
    rmSync(DOSSIER_BD, { recursive: true, force: true });
  } catch {
    /* fichiers encore verrouillés : sans conséquence */
  }
};
const ORIGINE = "http://localhost:8080";

/* ========================================================================= */
/* Petit cadre de test                                                       */
/* ========================================================================= */

let reussis = 0;
const echecs: string[] = [];

const verifier = (libelle: string, condition: boolean, detail?: string) => {
  if (condition) {
    reussis += 1;
    console.log(`  ✓ ${libelle}`);
  } else {
    echecs.push(libelle + (detail ? ` — ${detail}` : ""));
    console.log(`  ✗ ${libelle}${detail ? ` — ${detail}` : ""}`);
  }
};

const titre = (t: string) => console.log(`\n${t}`);

/* ========================================================================= */
/* Client HTTP avec bocal à biscuits                                         */
/* ========================================================================= */

/**
 * Le cookie de session est `HttpOnly` : `fetch` ne le gère pas tout seul hors
 * navigateur. On le conserve donc à la main — ce qui a l'avantage de vérifier
 * au passage que le serveur le pose bien.
 */
let cookie = "";

type Reponse = { statut: number; corps: any; etag: string | null };

const appeler = async (
  base: string,
  chemin: string,
  options: { methode?: string; corps?: unknown; etiquette?: string } = {}
): Promise<Reponse> => {
  const entetes: Record<string, string> = { Origin: ORIGINE };
  if (options.corps !== undefined) entetes["Content-Type"] = "application/json";
  if (options.etiquette) entetes["If-Match"] = options.etiquette;
  if (cookie) entetes["Cookie"] = cookie;

  const r = await fetch(`${base}${chemin}`, {
    method: options.methode ?? "GET",
    headers: entetes,
    body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
  });

  const pose = r.headers.getSetCookie?.() ?? [];
  for (const c of pose) {
    const valeur = c.split(";")[0] ?? "";
    if (valeur.startsWith("ms_session=")) cookie = valeur.endsWith("=") ? "" : valeur;
  }

  const texte = await r.text();
  let corps: unknown = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    corps = texte;
  }
  return { statut: r.status, corps, etag: r.headers.get("ETag") };
};

/**
 * Envoi d'un fichier, en `multipart/form-data`.
 *
 * `FormData` et `Blob` sont natifs depuis Node 18 : `fetch` compose l'en-tête
 * `Content-Type` et sa frontière tout seul. Le poser à la main -- réflexe
 * courant -- casse l'envoi, la frontière ne correspondant plus au corps.
 */
const envoyerFichier = async (
  base: string,
  octets: Buffer,
  nom: string,
  type: string,
  alt?: string,
  /** La phrase cochée pour un fichier au-delà du seuil rouge. */
  poidsAssume?: string
): Promise<Reponse> => {
  const f = new FormData();
  f.append("fichier", new Blob([new Uint8Array(octets)], { type }), nom);
  if (alt) f.append("alt", alt);
  if (poidsAssume) f.append("poids_assume", poidsAssume);

  const r = await fetch(`${base}/api/medias`, {
    method: "POST",
    headers: cookie ? { Origin: ORIGINE, Cookie: cookie } : { Origin: ORIGINE },
    body: f,
  });
  const texte = await r.text();
  let corps: unknown = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    corps = texte;
  }
  return { statut: r.status, corps, etag: null };
};

/* ========================================================================= */
/* Article de démonstration                                                  */
/* ========================================================================= */

const articleType = (slug: string, statut = "brouillon") => ({
  titre: "Un article de recette",
  slug,
  chapeau: "Écrit par la recette automatique.",
  corps: "# Titre\n\nDu contenu.",
  categorie: "infrastructure",
  format: "info",
  accent: null,
  motif: null,
  titre_fantome: "",
  reponse: "",
  version: "",
  exergue: "",
  meta_description: "Article produit par la recette.",
  auteur: "Recette",
  etiquettes: "erp, test",
  faq: [{ q: "Une question ?", r: "Une réponse." }],
  statut,
  publie_le: statut === "brouillon" ? "" : "2026-09-05",
  maquette: true,
});

/* ========================================================================= */
/* Déroulé                                                                   */
/* ========================================================================= */

const principal = async () => {
  console.log("\n═══ RECETTE DE L'API DU PANEL ═══");

  nettoyer();

  const bd = new EmbeddedPostgres({
    databaseDir: DOSSIER_BD,
    user: "recette",
    password: "recette",
    port: PORT_BD,
    persistent: false,
  });

  titre("Préparation");
  console.log("  · démarrage de PostgreSQL (téléchargement au premier lancement)…");
  await bd.initialise();
  await bd.start();

  /*
   * Base créée explicitement en UTF8.
   *
   * Sous Windows, PostgreSQL prend l'encodage de la session -- WIN1252 ici --
   * et refuse alors tout caractère qui n'y existe pas, y compris dans un
   * commentaire. Le schéma en contenait : le fichier entier était rejeté.
   * `TEMPLATE template0` est obligatoire pour imposer un encodage différent de
   * celui du modèle par défaut.
   */
  {
    const pgBrut = (await import("pg")).default;
    const client = new pgBrut.Client({
      connectionString: `postgres://recette:recette@localhost:${PORT_BD}/postgres`,
    });
    await client.connect();
    await client.query(
      // `LC_COLLATE`/`LC_CTYPE` en 'C' : c'est le seul couple compatible avec
      // n'importe quel encodage. Laisser la locale du système ferait échouer la
      // création, PostgreSQL refusant un encodage qui ne correspond pas.
      `CREATE DATABASE megasoft_recette
         ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`
    );
    await client.end();
  }
  console.log("  · base prête (UTF8)");

  /*
   * La configuration est lue à l'import du module `config`. On la pose donc
   * AVANT, et l'on charge les modules du serveur par import dynamique — un
   * import statique serait hissé en haut du fichier et lirait un environnement
   * encore vide.
   */
  process.env.DATABASE_URL = `postgres://recette:recette@localhost:${PORT_BD}/megasoft_recette`;
  process.env.PGSSLMODE = "disable";
  process.env.SECRET_SESSION = "recette-secret-de-test-suffisamment-long-0123456789";
  process.env.ORIGINE_AUTORISEE = ORIGINE;
  process.env.ENVIRONNEMENT = "developpement";
  // Bcrypt à coût réduit : la recette fait plusieurs connexions, et 12 y
  // ajouterait des secondes sans rien prouver de plus.
  process.env.COUT_BCRYPT = "4";

  /*
   * ⚠️ AUCUNE RECONSTRUCTION. Ces deux lignes protègent le contenu du site.
   *
   * La recette publie des articles pour vérifier la route de publication.
   * Chaque publication demande une reconstruction — et tant que
   * `COMMANDE_RECONSTRUCTION` était vide, il ne se passait rien.
   *
   * Le jour où `serveur/.env` a reçu ses vraies valeurs, la recette s'est mise
   * à lancer `npm run build` DANS LE VRAI DÉPÔT, avec sa base jetable pour
   * source. Le `prebuild` a fait son travail : il a écrit les articles de la
   * base de test dans `content/blog/` et SUPPRIMÉ les cinq vrais articles,
   * qui portent `origine: base` et n'existaient pas dans cette base. Même
   * chose pour `content/accueil/`, ramené aux seules sections que la recette
   * avait remplies.
   *
   * Autrement dit : la recette détruisait le contenu du site, et d'autant plus
   * sûrement que la configuration était PROCHE de la production. Le défaut
   * dormait depuis le premier jour, invisible tant que rien n'était configuré.
   *
   * Une recette ne touche jamais au dépôt. Les ponts sont vérifiés par
   * `recette-pont`, qui exporte dans ses propres dossiers temporaires.
   */
  process.env.COMMANDE_RECONSTRUCTION = "";
  process.env.REPERTOIRE_SITE = "";

  const { pool, requete } = await import("../bd.js");
  const { hacher } = await import("../session.js");
  const { creerApp } = await import("../app.js");

  await pool.query(readFileSync(resolve(process.cwd(), "schema.sql"), "utf8"));
  console.log("  · schéma installé");

  await requete(
    `INSERT INTO utilisateurs (nom, email, role, empreinte_mdp) VALUES
       ($1, $2, 'administrateur', $3), ($4, $5, 'redacteur', $6)`,
    [
      "Patronne", "admin@megasoft-office.com", await hacher("motdepasse-admin"),
      "Rédacteur", "redac@megasoft-office.com", await hacher("motdepasse-redac"),
    ]
  );

  const serveur: Server = await new Promise((r) => {
    const s = creerApp().listen(0, () => r(s));
  });
  const adresse = serveur.address();
  const base = `http://127.0.0.1:${typeof adresse === "object" && adresse ? adresse.port : 0}`;
  console.log(`  · API sur ${base}`);

  /* ------------------------------------------------------------ schéma --- */

  titre("Schéma");
  const tables = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema='public'`
  );
  /* Le compte est écrit en toutes lettres, et c'est voulu : une table ajoutée
     sans intention le fait échouer. */
  verifier("les 10 tables sont installées", Number(tables[0]?.n) === 10, `trouvé ${tables[0]?.n}`);

  const statuts = await requete<{ enumlabel: string }>(
    `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'statut_article' ORDER BY e.enumsortorder`
  );
  verifier(
    "les 4 statuts d'article existent",
    statuts.map((s) => s.enumlabel).join(",") === "brouillon,relecture,programme,publie",
    statuts.map((s) => s.enumlabel).join(",")
  );

  /*
   * Le compte vient du MODÈLE, pas d'un nombre écrit ici.
   *
   * Il valait 12 en dur ; ajouter « sections-libres » au schéma a fait échouer
   * la recette sur un changement voulu. Le contrôle utile n'est pas « il y en a
   * douze » mais « la base connaît exactement les sections que le site attend ».
   *
   * On compte les fichiers plutôt que d'importer le modèle : celui-ci vit dans
   * `src/` du site, hors du `rootDir` du serveur, et l'importer casse la
   * compilation. Les fichiers sont la même vérité, vue de l'extérieur.
   */
  const attendues = readdirSync(resolve(process.cwd(), "..", "content", "accueil")).filter(
    (f) => f.endsWith(".json") && !f.startsWith(".")
  ).length;
  const sections = await requete<{ n: string }>(`SELECT count(*)::text AS n FROM contenu_pages`);
  verifier(
    `les ${attendues} sections de page sont amorcées`,
    Number(sections[0]?.n) === attendues,
    `${sections[0]?.n} en base`
  );

  /* --------------------------------------------------------- connexion --- */

  titre("Connexion");

  let r = await appeler(base, "/api/session");
  verifier("sans session, /api/session renvoie 401", r.statut === 401, `reçu ${r.statut}`);

  r = await appeler(base, "/api/articles");
  verifier("sans session, les articles sont refusés", r.statut === 401, `reçu ${r.statut}`);

  r = await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "admin@megasoft-office.com", motDePasse: "mauvais" },
  });
  verifier("mot de passe faux : refusé", r.statut === 401);
  verifier(
    "le message ne dit pas si le compte existe",
    r.corps?.message === "Identifiant ou mot de passe incorrect.",
    String(r.corps?.message)
  );

  r = await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "inconnu@megasoft-office.com", motDePasse: "mauvais" },
  });
  verifier("compte inconnu : message identique", r.corps?.message === "Identifiant ou mot de passe incorrect.");

  r = await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "admin@megasoft-office.com", motDePasse: "motdepasse-admin" },
  });
  verifier("connexion administrateur", r.statut === 200 && r.corps?.role === "administrateur");
  verifier("le cookie de session est posé", cookie.startsWith("ms_session="));

  r = await appeler(base, "/api/session");
  verifier("la session est reconnue", r.statut === 200 && r.corps?.email === "admin@megasoft-office.com");

  /* --------------------------------------------------------- articles --- */

  titre("Articles");

  r = await appeler(base, "/api/articles", { methode: "POST", corps: articleType("recette-un") });
  verifier("création d'un article", r.statut === 201 && r.corps?.slug === "recette-un");
  verifier(
    "les étiquettes « erp, test » deviennent un tableau",
    Array.isArray(r.corps?.etiquettes) && r.corps.etiquettes.length === 2,
    JSON.stringify(r.corps?.etiquettes)
  );

  r = await appeler(base, "/api/articles", { methode: "POST", corps: articleType("recette-un") });
  verifier("un slug déjà pris est refusé (409)", r.statut === 409, `reçu ${r.statut}`);

  r = await appeler(base, "/api/articles", {
    methode: "POST",
    corps: { ...articleType("recette-deux"), titre: "" },
  });
  verifier("un titre vide est refusé (400)", r.statut === 400, `reçu ${r.statut}`);

  r = await appeler(base, "/api/articles", {
    methode: "POST",
    corps: { ...articleType("Slug Invalide!"), slug: "Slug Invalide!" },
  });
  verifier("une adresse invalide est refusée", r.statut === 400);

  r = await appeler(base, "/api/articles", {
    methode: "POST",
    corps: { ...articleType("recette-trois"), statut: "publie", publie_le: "" },
  });
  verifier("un article publié sans date est refusé", r.statut === 400);

  /* ------------------------------------------------------- concurrence --- */

  titre("Modifications simultanées");

  const lu = await appeler(base, "/api/articles/recette-un");
  verifier("la lecture renvoie une étiquette de version", !!lu.etag, String(lu.etag));

  r = await appeler(base, "/api/articles/recette-un", {
    methode: "PUT",
    corps: { ...articleType("recette-un"), titre: "Sans étiquette" },
  });
  verifier("une écriture sans If-Match est refusée", r.statut === 400, `reçu ${r.statut}`);

  r = await appeler(base, "/api/articles/recette-un", {
    methode: "PUT",
    corps: { ...articleType("recette-un"), titre: "Titre modifié" },
    etiquette: lu.etag!,
  });
  verifier("écriture avec la bonne étiquette", r.statut === 200 && r.corps?.titre === "Titre modifié");

  r = await appeler(base, "/api/articles/recette-un", {
    methode: "PUT",
    corps: { ...articleType("recette-un"), titre: "Deuxième rédacteur" },
    etiquette: lu.etag!,
  });
  verifier("réécrire avec l'étiquette périmée donne 409", r.statut === 409, `reçu ${r.statut}`);
  verifier("le conflit renvoie la version du serveur", !!r.corps?.distant);

  /* ------------------------------------------------------- publication --- */

  titre("Publication");

  r = await appeler(base, "/api/articles/recette-un/publier", { methode: "POST" });
  verifier("publication acceptée", r.statut === 200);
  verifier(
    "une reconstruction est enregistrée",
    ["demandee", "en_cours", "reussie"].includes(String(r.corps?.etat)),
    String(r.corps?.etat)
  );

  const publie = await appeler(base, "/api/articles/recette-un");
  verifier("l'article est publié", publie.corps?.statut === "publie");
  verifier("une date de parution a été posée d'office", !!publie.corps?.publie_le);

  /* ------------------------------------------------------ redirection --- */

  titre("Changement d'adresse");

  r = await appeler(base, "/api/articles/recette-un", {
    methode: "PUT",
    corps: { ...articleType("recette-un-renomme", "publie"), titre: "Renommé" },
    etiquette: publie.etag!,
  });
  verifier("renommage accepté", r.statut === 200 && r.corps?.slug === "recette-un-renomme");

  const redir = await requete<{ depuis: string; vers: string; code: number }>(
    `SELECT depuis, vers, code FROM redirections`
  );
  verifier(
    "une redirection 301 est créée automatiquement",
    redir.length === 1 && redir[0]?.depuis === "/blog/recette-un/" &&
      redir[0]?.vers === "/blog/recette-un-renomme/" && redir[0]?.code === 301,
    JSON.stringify(redir)
  );

  /* --------------------------------------------------------- versions --- */

  titre("Historique");
  r = await appeler(base, "/api/articles/recette-un-renomme/versions");
  verifier("l'historique contient plusieurs versions", Array.isArray(r.corps) && r.corps.length >= 3,
    `${Array.isArray(r.corps) ? r.corps.length : "?"} version(s)`);

  /* ---------------------------------------------------------- contenu --- */

  titre("Contenu des pages");

  const section = await appeler(base, "/api/contenu/chiffres");
  verifier("une section se lit", section.statut === 200 && section.corps?.cle === "chiffres");
  verifier("elle n'a pas encore de brouillon", section.corps?.brouillon === null);

  r = await appeler(base, "/api/contenu/chiffres", {
    methode: "PUT",
    corps: { chiffres: [{ valeur: 300, libelle: "Clients accompagnés" }] },
    etiquette: section.etag!,
  });
  verifier("le brouillon s'enregistre", r.statut === 200 && r.corps?.brouillon !== null);
  verifier("la version publiée n'a pas bougé", JSON.stringify(r.corps?.donnees) === "{}");

  r = await appeler(base, "/api/contenu/chiffres/publier", { methode: "POST" });
  verifier("publication de la section", r.statut === 200);

  const apres = await appeler(base, "/api/contenu/chiffres");
  verifier("le brouillon est passé en publié", Array.isArray(apres.corps?.donnees?.chiffres));
  verifier("le brouillon est vidé", apres.corps?.brouillon === null);

  /* ------------------------------------------------------------ médias --- */

  titre("Médias");

  const sharp = (await import("sharp")).default;

  /*
   * Deux images, parce qu'elles se comportent a l'oppose :
   *
   *  · une PHOTOGRAPHIE -- des degrades continus. Le WebP avec perte y gagne
   *    beaucoup ;
   *  · une CAPTURE D'ECRAN -- des aplats et des bords nets. Le PNG la
   *    compresse deja tres bien, et le WebP avec perte y produit un fichier
   *    plus gros. C'est le cas qui a fait ajouter le repli sans perte.
   */
  const largeur = 2400;
  const hauteur = 1600;

  const photo = Buffer.alloc(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = (y * largeur + x) * 3;
      photo[i] = Math.round(128 + 120 * Math.sin(x / 90) * Math.cos(y / 130));
      photo[i + 1] = Math.round(120 + 110 * Math.sin((x + y) / 160));
      photo[i + 2] = Math.round(140 + 100 * Math.cos(y / 70));
    }
  }
  const png = await sharp(photo, { raw: { width: largeur, height: hauteur, channels: 3 } })
    .png()
    .toBuffer();

  const aplats = Buffer.alloc(largeur * hauteur * 3, 245);
  for (let y = 200; y < 900; y += 1) {
    for (let x = 200; x < 1400; x += 1) {
      const i = (y * largeur + x) * 3;
      aplats[i] = 47;
      aplats[i + 1] = 107;
      aplats[i + 2] = 255;
    }
  }
  const capture = await sharp(aplats, { raw: { width: largeur, height: hauteur, channels: 3 } })
    .png()
    .toBuffer();

  r = await envoyerFichier(base, png, "photo-atelier.png", "image/png", "Un atelier");
  verifier("envoi d'une image PNG", r.statut === 201, `reçu ${r.statut}`);
  verifier("elle est convertie en WebP", r.corps?.type_mime === "image/webp", String(r.corps?.type_mime));
  verifier("le format d'origine est conservé", r.corps?.type_origine === "image/png");
  verifier("elle est stockée en base", r.corps?.en_base === true);
  verifier("aucun chemin sur disque", r.corps?.chemin === null);
  verifier(
    "elle est réduite à 2000 px de large",
    r.corps?.largeur === 2000 && r.corps?.hauteur === 1333,
    `${r.corps?.largeur}x${r.corps?.hauteur}`
  );
  verifier(
    "une photographie est nettement allégée",
    r.corps?.taille < png.length / 2,
    `${Math.round(png.length / 1024)} Ko vers ${Math.round((r.corps?.taille ?? 0) / 1024)} Ko`
  );
  verifier(
    "son adresse publique est /medias/<id>.webp",
    typeof r.corps?.url === "string" && r.corps.url === `/medias/${r.corps.id}.webp`,
    String(r.corps?.url)
  );
  verifier("le texte alternatif est enregistré", r.corps?.alt === "Un atelier");

  const idImage = String(r.corps?.id);

  // Les octets se relisent : c'est ce dont l'aperçu du panel a besoin.
  const fichier = await fetch(`${base}/api/medias/${idImage}/fichier`, {
    headers: { Origin: ORIGINE, Cookie: cookie },
  });
  const relu = Buffer.from(await fichier.arrayBuffer());
  verifier("les octets se relisent", fichier.status === 200 && relu.length > 0);
  verifier(
    "le type servi est image/webp",
    fichier.headers.get("content-type") === "image/webp",
    String(fichier.headers.get("content-type"))
  );
  verifier(
    "les octets relus sont bien du WebP",
    relu.subarray(0, 4).toString("ascii") === "RIFF" &&
      relu.subarray(8, 12).toString("ascii") === "WEBP"
  );

  // La liste ne doit pas transporter les octets : trente images en base64
  // feraient plusieurs mégaoctets pour afficher une grille de vignettes.
  r = await appeler(base, "/api/medias");
  verifier("la liste ne transporte pas les octets", !("contenu" in (r.corps?.[0] ?? {})));

  // Le cas qui a fait ajouter le repli sans perte : sans lui, cette capture
  // ressortait plus lourde qu'a l'envoi.
  const avantCapture = capture.length;
  r = await envoyerFichier(base, capture, "capture-ecran.png", "image/png", "Capture");
  verifier("envoi d'une capture d'écran", r.statut === 201, `reçu ${r.statut}`);
  verifier(
    "une capture d'écran n'est jamais alourdie",
    (r.corps?.taille ?? Infinity) <= avantCapture,
    `${Math.round(avantCapture / 1024)} Ko vers ${Math.round((r.corps?.taille ?? 0) / 1024)} Ko`
  );

  r = await envoyerFichier(base, Buffer.from("ceci n'est pas une image"), "faux.png", "image/png");
  verifier("un fichier déguisé en PNG est refusé", r.statut === 400, `reçu ${r.statut}`);

  // Un média référencé par un article ne doit pas pouvoir disparaître.
  await appeler(base, "/api/articles", {
    methode: "POST",
    corps: {
      ...articleType("recette-avec-image"),
      corps: `Une image : ![atelier](/medias/${idImage}.webp)`,
    },
  });
  r = await appeler(base, `/api/medias/${idImage}`, { methode: "DELETE" });
  verifier("un média encore utilisé ne se supprime pas", r.statut === 409, `reçu ${r.statut}`);

  /* ------------------------------------------------- le poids des fichiers

     Le client peut publier une vidéo lourde — c'est son site. Mais le choix
     doit être explicite et laisser une trace : sans `ffmpeg` sur
     l'hébergement, aucune conversion n'allègera le fichier, et le poids envoyé
     est celui que téléchargera un visiteur en 3G.

     La vidéo est FACTICE : elle porte la signature `ftyp`, ce que le serveur
     lit pour reconnaître un MP4. Ce sont les seuils qu'on vérifie ici, pas la
     lecture d'une vidéo. */
  const videoDe = (octets: number) => {
    const b = Buffer.alloc(octets);
    b.write("ftyp", 4, "ascii");
    return b;
  };

  const videoLegere = videoDe(200 * 1024);
  r = await envoyerFichier(base, videoLegere, "demo.mp4", "video/mp4", "Une démonstration");
  verifier("une vidéo légère passe sans question", r.statut === 201, `reçu ${r.statut}`);
  verifier("elle est rangée sur le disque, pas en base", r.corps?.en_base === false);
  verifier(
    "son adresse publique ne montre pas le rangement interne",
    typeof r.corps?.url === "string" && r.corps.url === `/medias/${r.corps.id}.mp4`,
    String(r.corps?.url)
  );

  const videoLourde = videoDe(11 * 1024 * 1024);
  r = await envoyerFichier(base, videoLourde, "gala.mp4", "video/mp4", "Le gala");
  verifier(
    "une vidéo de 11 Mo est refusée sans acceptation",
    r.statut === 413,
    `reçu ${r.statut}`
  );
  verifier(
    "le refus nomme la taille réelle",
    /11[.,]0 Mo/.test(String(r.corps?.message ?? "")),
    String(r.corps?.message).slice(0, 120)
  );

  const phrase = "Je comprends que cette vidéo de 11,0 Mo ralentira le site pour les visiteurs mobiles, et j'assume ce choix.";
  r = await envoyerFichier(base, videoLourde, "gala.mp4", "video/mp4", "Le gala", phrase);
  verifier("la même vidéo passe une fois la responsabilité prise", r.statut === 201, `reçu ${r.statut}`);

  /* Et la trace, qui est tout l'intérêt : le journal est inaltérable, donc
     cette acceptation ne peut plus disparaître. */
  const journalPoids = await requete<{ acteur: string; detail: string }>(
    `SELECT acteur, detail FROM journal
      WHERE action = 'media-ajout' AND detail LIKE '%POIDS ASSUMÉ%'
      ORDER BY date DESC LIMIT 1`
  );
  verifier(
    "l'acceptation est inscrite au journal avec le compte et la taille",
    journalPoids.length === 1 &&
      journalPoids[0]!.acteur === "admin@megasoft-office.com" &&
      journalPoids[0]!.detail.includes("11,0 Mo"),
    journalPoids[0]?.detail ?? "aucune entrée"
  );

  /* ------------------------------------------------------ mots de passe --- */

  titre("Mots de passe");

  /*
   * Ce qui manquait avant le déploiement : un compte créé recevait un mot de
   * passe provisoire qu'il n'avait AUCUN moyen de remplacer. « Provisoire »
   * était un mot sans suite.
   */
  r = await appeler(base, "/api/mot-de-passe", {
    methode: "POST",
    corps: { actuel: "motdepasse-admin", nouveau: "court" },
  });
  verifier("un mot de passe trop court est refusé", r.statut === 400, `reçu ${r.statut}`);

  r = await appeler(base, "/api/mot-de-passe", {
    methode: "POST",
    corps: { actuel: "ce-n-est-pas-le-bon", nouveau: "une phrase de passe correcte" },
  });
  verifier(
    "le mot de passe actuel est exigé pour en changer",
    r.statut === 400,
    `reçu ${r.statut}`
  );

  const NOUVEAU = "une phrase de passe bien assez longue";
  r = await appeler(base, "/api/mot-de-passe", {
    methode: "POST",
    corps: { actuel: "motdepasse-admin", nouveau: NOUVEAU },
  });
  verifier("le changement est accepté", r.statut === 204, `reçu ${r.statut}`);

  /* La session courante doit SURVIVRE : le serveur la rouvre dans la même
     réponse. Sans cela, changer son mot de passe déconnecterait — un
     comportement que personne n'attend et qui ferait croire à un échec. */
  r = await appeler(base, "/api/session");
  verifier("la session en cours survit au changement", r.statut === 200, `reçu ${r.statut}`);

  /* Et l'ancien mot de passe ne vaut plus rien. */
  const cookieAvant = cookie;
  cookie = "";
  r = await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "admin@megasoft-office.com", motDePasse: "motdepasse-admin" },
  });
  verifier("l'ancien mot de passe ne fonctionne plus", r.statut === 401, `reçu ${r.statut}`);

  r = await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "admin@megasoft-office.com", motDePasse: NOUVEAU },
  });
  verifier("le nouveau fonctionne", r.statut === 200, `reçu ${r.statut}`);

  /*
   * ⚠️ ON REMET LE MOT DE PASSE D'ORIGINE.
   *
   * Les sections suivantes se reconnectent avec « motdepasse-admin ». Sans ce
   * retour à l'état initial, cette section-ci passe au vert et fait échouer
   * toutes les suivantes — sur un défaut du test, jamais nommé comme tel dans
   * les messages d'échec. Une recette ne doit pas laisser le décor dans un
   * autre état qu'elle ne l'a trouvé.
   */
  r = await appeler(base, "/api/mot-de-passe", {
    methode: "POST",
    corps: { actuel: NOUVEAU, nouveau: "motdepasse-admin" },
  });
  verifier("le mot de passe d'origine est remis pour la suite", r.statut === 204, `reçu ${r.statut}`);
  void cookieAvant;

  /* ----------------------------------------------------------- présence --- */

  titre("Présence");

  /*
   * L'étage qui manquait à la gestion des écritures concurrentes.
   *
   * `If-Match` empêche déjà d'écraser le travail d'autrui — mais il le fait au
   * moment d'enregistrer, c'est-à-dire une fois le travail écrit. La présence
   * prévient avant : « quelqu'un a cet article ouvert ».
   */
  const RESSOURCE = "article:recette-un";

  r = await appeler(base, "/api/presence", { methode: "PUT", corps: { ressource: RESSOURCE } });
  verifier("on peut signaler sa présence", r.statut === 200, `reçu ${r.statut}`);
  verifier(
    "on ne se voit pas soi-même dans la liste",
    Array.isArray(r.corps?.autres) && r.corps.autres.length === 0,
    JSON.stringify(r.corps?.autres)
  );

  r = await appeler(base, "/api/presence", {
    methode: "PUT",
    corps: { ressource: "ceci n'est pas une ressource" },
  });
  verifier("une ressource mal formée est refusée", r.statut === 400, `reçu ${r.statut}`);

  /* Un second compte ouvre la même ressource : chacun doit voir l'autre. */
  const cookieAdmin = cookie;
  cookie = "";
  await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "redac@megasoft-office.com", motDePasse: "motdepasse-redac" },
  });

  r = await appeler(base, "/api/presence", { methode: "PUT", corps: { ressource: RESSOURCE } });
  verifier(
    "le second voit le premier, avec son nom",
    r.corps?.autres?.length === 1 && r.corps.autres[0].nom === "Patronne",
    JSON.stringify(r.corps?.autres)
  );
  verifier(
    "et depuis combien de temps il est là",
    typeof r.corps?.autres?.[0]?.depuisMs === "number",
    JSON.stringify(r.corps?.autres?.[0])
  );

  /* Deux ressources différentes ne se gênent pas : c'est ce qui permet à deux
     personnes de travailler en même temps sur deux sections distinctes. */
  r = await appeler(base, "/api/presence", {
    methode: "PUT",
    corps: { ressource: "contenu:hero" },
  });
  verifier(
    "une autre ressource est indépendante",
    r.corps?.autres?.length === 0,
    JSON.stringify(r.corps?.autres)
  );

  r = await appeler(base, "/api/presence", { methode: "DELETE", corps: { ressource: RESSOURCE } });
  verifier("on peut quitter une ressource", r.statut === 204, `reçu ${r.statut}`);

  const cookieRedac = cookie;
  cookie = cookieAdmin;
  r = await appeler(base, "/api/presence", { methode: "PUT", corps: { ressource: RESSOURCE } });
  verifier(
    "celui qui est parti n'apparaît plus",
    r.corps?.autres?.length === 0,
    JSON.stringify(r.corps?.autres)
  );

  /* La déconnexion éteint les présences : afficher « X a cet article ouvert »
     alors que X vient de partir ferait douter de toute l'indication. */
  cookie = cookieRedac;
  await appeler(base, "/api/presence", { methode: "PUT", corps: { ressource: "contenu:hero" } });
  await appeler(base, "/api/deconnexion", { methode: "POST" });

  cookie = cookieAdmin;
  r = await appeler(base, "/api/presence", { methode: "PUT", corps: { ressource: "contenu:hero" } });
  verifier(
    "la déconnexion efface les présences",
    r.corps?.autres?.length === 0,
    JSON.stringify(r.corps?.autres)
  );

  /* ------------------------------------------------------------ droits --- */

  titre("Droits");

  await appeler(base, "/api/deconnexion", { methode: "POST" });
  verifier("la déconnexion vide le cookie", cookie === "");

  await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "redac@megasoft-office.com", motDePasse: "motdepasse-redac" },
  });

  r = await appeler(base, "/api/articles", { methode: "POST", corps: articleType("recette-redac") });
  verifier("un rédacteur peut créer un article", r.statut === 201, `reçu ${r.statut}`);

  r = await appeler(base, "/api/articles/recette-redac/publier", { methode: "POST" });
  verifier("un rédacteur ne peut PAS publier (403)", r.statut === 403, `reçu ${r.statut}`);

  r = await appeler(base, "/api/utilisateurs");
  verifier("un rédacteur ne voit pas les comptes (403)", r.statut === 403, `reçu ${r.statut}`);

  r = await appeler(base, "/api/journal");
  verifier("un rédacteur ne lit pas le journal (403)", r.statut === 403, `reçu ${r.statut}`);

  r = await appeler(base, "/api/articles/recette-redac", { methode: "DELETE" });
  verifier("un rédacteur ne peut pas jeter un article (403)", r.statut === 403, `reçu ${r.statut}`);

  /* ----------------------------------------------------------- journal --- */

  titre("Journal");

  await appeler(base, "/api/deconnexion", { methode: "POST" });
  await appeler(base, "/api/connexion", {
    methode: "POST",
    corps: { email: "admin@megasoft-office.com", motDePasse: "motdepasse-admin" },
  });

  r = await appeler(base, "/api/journal");
  const actions = Array.isArray(r.corps) ? r.corps.map((e: { action: string }) => e.action) : [];
  verifier("le journal est alimenté par le serveur", actions.length > 5, `${actions.length} entrées`);
  verifier("les connexions refusées sont tracées", actions.includes("connexion-refusee"));
  verifier("les publications sont tracées", actions.includes("publication"));
  verifier("la redirection automatique est tracée", actions.includes("redirection"));

  const avant = await requete<{ n: string }>(`SELECT count(*)::text AS n FROM journal`);
  await requete(`DELETE FROM journal`);
  await requete(`UPDATE journal SET acteur = 'falsifié'`);
  const apresTentative = await requete<{ n: string }>(`SELECT count(*)::text AS n FROM journal`);
  const falsifie = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM journal WHERE acteur = 'falsifié'`
  );
  verifier(
    "le journal résiste à une suppression directe en SQL",
    avant[0]?.n === apresTentative[0]?.n,
    `${avant[0]?.n} → ${apresTentative[0]?.n}`
  );
  verifier("le journal résiste à une modification directe en SQL", Number(falsifie[0]?.n) === 0);

  /* ------------------------------------------------------------ comptes --- */

  titre("Comptes");

  r = await appeler(base, "/api/utilisateurs", {
    methode: "POST",
    corps: { nom: "Nouvelle", email: "nouvelle@megasoft-office.com", role: "relecteur" },
  });
  verifier("création d'un compte", r.statut === 201);
  verifier("un mot de passe provisoire est généré", typeof r.corps?.motDePasseProvisoire === "string");

  const moi = await appeler(base, "/api/session");
  const comptes = await appeler(base, "/api/utilisateurs");
  const monId = (comptes.corps as { id: string; email: string }[]).find(
    (u) => u.email === moi.corps.email
  )?.id;

  r = await appeler(base, `/api/utilisateurs/${monId}`, {
    methode: "PATCH",
    corps: { role: "redacteur" },
  });
  verifier("on ne peut pas se retirer son propre rôle d'administrateur", r.statut === 400, `reçu ${r.statut}`);

  r = await appeler(base, `/api/utilisateurs/${monId}`, { methode: "DELETE" });
  verifier("on ne peut pas supprimer son propre compte", r.statut === 400, `reçu ${r.statut}`);

  /* -------------------------------------------------------- corbeille --- */

  titre("Corbeille");

  r = await appeler(base, "/api/articles/recette-redac", { methode: "DELETE" });
  verifier("mise à la corbeille", r.statut === 204);

  r = await appeler(base, "/api/articles");
  verifier(
    "l'article ne figure plus dans la liste",
    !(r.corps as { slug: string }[]).some((a) => a.slug === "recette-redac")
  );

  r = await appeler(base, "/api/articles?corbeille=1");
  verifier(
    "il est dans la corbeille",
    (r.corps as { slug: string }[]).some((a) => a.slug === "recette-redac")
  );

  const reste = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM articles WHERE slug = 'recette-redac'`
  );
  verifier("la ligne existe toujours en base — rien n'est détruit", Number(reste[0]?.n) === 1);

  r = await appeler(base, "/api/articles/recette-redac/restaurer", { methode: "POST" });
  verifier("restauration depuis la corbeille", r.statut === 204);

  /* --------------------------------------------------------- quotas --- */

  titre("Limitation de débit");

  cookie = "";
  let refuse = 0;
  for (let i = 0; i < 8; i += 1) {
    const t = await appeler(base, "/api/connexion", {
      methode: "POST",
      corps: { email: "cible@megasoft-office.com", motDePasse: `essai${i}` },
    });
    if (t.statut === 429) refuse += 1;
  }
  verifier("les tentatives de connexion répétées sont bloquées", refuse >= 2, `${refuse} refus sur 8`);

  /* ------------------------------------------------------------- fin --- */

  await new Promise<void>((r2) => serveur.close(() => r2()));
  await pool.end();
  await bd.stop();
  nettoyer();

  console.log(`\n═══ ${reussis} vérification(s) réussie(s), ${echecs.length} échec(s) ═══\n`);
  if (echecs.length) {
    echecs.forEach((e) => console.log(`  ✗ ${e}`));
    console.log("");
    process.exit(1);
  }
};

principal().catch(async (e) => {
  console.error("\n✖ La recette s'est interrompue :", e);
  rmSync(DOSSIER_BD, { recursive: true, force: true });
  process.exit(1);
});
