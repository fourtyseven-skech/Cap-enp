import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { load } from "js-yaml";
import EmbeddedPostgres from "embedded-postgres";

/**
 * ---------------------------------------------------------------------------
 * RECETTE DU PONT BASE ↔ SITE
 * ---------------------------------------------------------------------------
 *
 *     npm run recette-pont
 *
 * Fait l'aller-retour complet sur les VRAIS articles du site :
 *
 *     content/blog/*.md  →  PostgreSQL  →  content/blog/*.md
 *
 * puis compare l'arrivée au départ, champ par champ.
 *
 * CE QU'ELLE PROUVE
 * -----------------
 * Qu'aucun contenu ne se perd ni ne se déforme en passant par la base. Un
 * accent mal encodé, une FAQ aplatie, une date décalée d'un jour par un fuseau
 * horaire : ce sont des pertes silencieuses, qui ne se voient qu'une fois
 * l'article en ligne et le fichier d'origine écrasé.
 *
 * ISOLATION
 * ---------
 * L'export écrit dans un dossier temporaire, jamais dans `content/blog/`. Le
 * script exercé EFFACE des fichiers : le tester sur le contenu réel du site
 * serait exactement le genre de raccourci qu'on regrette une fois.
 */

const PORT_BD = 54_331;
const DOSSIER_BD = resolve(process.cwd(), ".pg-pont");
const SITE = resolve(process.cwd(), "..");
const SOURCE = join(SITE, "content", "blog");
const SORTIE = resolve(process.cwd(), ".pont-sortie");

let reussis = 0;
const echecs: string[] = [];

const verifier = (libelle: string, ok: boolean, detail?: string) => {
  if (ok) {
    reussis += 1;
    console.log(`  ✓ ${libelle}`);
  } else {
    echecs.push(libelle + (detail ? ` — ${detail}` : ""));
    console.log(`  ✗ ${libelle}${detail ? ` — ${detail}` : ""}`);
  }
};

const nettoyer = () => {
  for (const d of [DOSSIER_BD, SORTIE]) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* fichiers encore verrouillés par PostgreSQL : sans conséquence */
    }
  }
};

/* ------------------------------------------------------------ comparaison */

type Article = { entete: Record<string, unknown>; corps: string };

const separer = (brut: string): Article => {
  const texte = brut.replace(/^﻿/, "");
  const fin = texte.indexOf("\n---", 3);
  if (!texte.startsWith("---") || fin === -1) return { entete: {}, corps: texte };
  return {
    entete: (load(texte.slice(texte.indexOf("\n") + 1, fin)) as Record<string, unknown>) ?? {},
    corps: texte.slice(fin + 4).replace(/^[^\n]*\r?\n?/, "").trim(),
  };
};

/**
 * Normalise une valeur avant comparaison.
 *
 * On compare le SENS, pas l'écriture : `js-yaml` peut citer une chaîne
 * autrement, réordonner les clés ou rendre une date en objet `Date`. Ces écarts
 * de forme n'ont aucune conséquence sur le site rendu — les signaler comme des
 * pertes ferait crier la recette pour rien, et un contrôle qui crie pour rien
 * finit ignoré.
 */
const normaliser = (v: unknown): unknown => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(normaliser);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== null && x !== undefined && x !== "")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, normaliser(x)])
    );
  }
  return v;
};

/** Champs comparés. `origine` est ajouté par l'export : il n'a pas d'original. */
const CHAMPS = [
  "titre", "slug", "chapeau", "categorie", "format", "reponse", "version",
  "etiquettes", "auteur", "publie_le", "statut", "maquette", "titre_fantome",
  "accent", "motif", "exergue", "meta_description", "faq",
];

/* ------------------------------------------------------------------ déroulé */

const principal = async () => {
  console.log("\n═══ RECETTE DU PONT BASE ↔ SITE ═══");
  nettoyer();

  const bd = new EmbeddedPostgres({
    databaseDir: DOSSIER_BD,
    user: "pont",
    password: "pont",
    port: PORT_BD,
    persistent: false,
  });

  console.log("\nPréparation");
  await bd.initialise();
  await bd.start();

  const pgBrut = (await import("pg")).default;
  {
    const c = new pgBrut.Client({
      connectionString: `postgres://pont:pont@localhost:${PORT_BD}/postgres`,
    });
    await c.connect();
    await c.query(
      `CREATE DATABASE megasoft_pont
         ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`
    );
    await c.end();
  }

  const URL_BD = `postgres://pont:pont@localhost:${PORT_BD}/megasoft_pont`;
  process.env.DATABASE_URL = URL_BD;
  process.env.PGSSLMODE = "disable";
  process.env.SECRET_SESSION = "recette-pont-secret-suffisamment-long-0123456789";
  process.env.ORIGINE_AUTORISEE = "http://localhost:8080";
  process.env.ENVIRONNEMENT = "developpement";

  const { pool } = await import("../bd.js");
  await pool.query(readFileSync(resolve(process.cwd(), "schema.sql"), "utf8"));
  console.log("  · base prête, schéma installé");

  const tousLesFichiers = readdirSync(SOURCE).filter((f) => f.endsWith(".md"));

  /*
   * Seuls les articles PUBLIÉS traversent le pont dans le sens base → site.
   *
   * `content/blog/` contient aussi des brouillons : ils sont bien lus par le
   * chargeur, mais écartés du site construit. Les attendre en sortie ferait
   * échouer la recette sur un comportement correct -- et c'est arrivé.
   */
  const publies = tousLesFichiers.filter((f) => {
    const { entete } = separer(readFileSync(join(SOURCE, f), "utf8"));
    return entete.statut === "publie" || entete.statut === "programme";
  });
  const brouillons = tousLesFichiers.filter((f) => !publies.includes(f));

  console.log(
    `  · ${tousLesFichiers.length} fichier(s) : ${publies.length} publié(s), ${brouillons.length} brouillon(s)`
  );

  /* ---------------------------------------------------- aller : → base --- */

  console.log("\nAller : fichiers → base");

  const importer = () =>
    execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/outils/importer-fichiers.ts"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });

  importer();

  const enBase = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM articles`);
  verifier(
    `les ${tousLesFichiers.length} fichiers sont en base, brouillons compris`,
    Number(enBase.rows[0]?.n) === tousLesFichiers.length,
    `trouvé ${enBase.rows[0]?.n}`
  );

  const accents = await pool.query<{ titre: string }>(
    `SELECT titre FROM articles WHERE titre LIKE '%é%' OR titre LIKE '%è%' OR titre LIKE '%ê%'`
  );
  verifier("les accents ont survécu à l'insertion", accents.rows.length > 0);

  const faq = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM articles WHERE jsonb_array_length(faq) > 0`
  );
  verifier("les FAQ sont enregistrées en jsonb", Number(faq.rows[0]?.n) > 0, `${faq.rows[0]?.n} article(s)`);

  // Relancer l'import ne doit rien écraser : c'est ce qui rend la migration
  // rejouable sans crainte.
  importer();
  const apresDeux = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM articles`);
  verifier(
    "relancer l'import ne crée pas de doublon",
    Number(apresDeux.rows[0]?.n) === tousLesFichiers.length,
    `trouvé ${apresDeux.rows[0]?.n}`
  );

  /* --------------------------------------------------- retour : → site --- */

  console.log("\nRetour : base → fichiers");

  mkdirSync(SORTIE, { recursive: true });

  // Un article écrit à la main, absent de la base : il ne doit pas être touché.
  writeFileSync(
    join(SORTIE, "ecrit-a-la-main.md"),
    `---\ntitre: "Article hors base"\nslug: "ecrit-a-la-main"\nstatut: "publie"\npublie_le: 2026-01-01\n---\n\nDu contenu.\n`,
    "utf8"
  );

  // Un résidu d'export précédent, absent de la base : il doit disparaître.
  writeFileSync(
    join(SORTIE, "article-depublie.md"),
    `---\ntitre: "Dépublié"\nslug: "article-depublie"\nstatut: "publie"\npublie_le: 2026-01-01\norigine: base\n---\n\nDu contenu.\n`,
    "utf8"
  );

  execFileSync("node", ["scripts/exporter-articles.mjs"], {
    cwd: SITE,
    env: { ...process.env, DOSSIER_ARTICLES: SORTIE },
    stdio: "pipe",
  });

  const produits = readdirSync(SORTIE).filter((f) => f.endsWith(".md"));

  verifier(
    `les ${publies.length} articles publiés sont réécrits`,
    publies.every((f) => produits.includes(f)),
    produits.join(", ")
  );
  verifier(
    `les ${brouillons.length} brouillon(s) ne partent pas sur le site`,
    brouillons.every((f) => !produits.includes(f) || !readFileSync(join(SORTIE, f), "utf8").includes("origine: base"))
  );
  verifier(
    "un article écrit à la main est conservé",
    produits.includes("ecrit-a-la-main.md")
  );
  verifier(
    "un article dépublié portant la marque est retiré",
    !produits.includes("article-depublie.md")
  );

  /* ------------------------------------------------------- comparaison --- */

  console.log("\nComparaison champ par champ");

  let identiques = 0;
  const ecarts: string[] = [];

  for (const nom of publies) {
    const avant = separer(readFileSync(join(SOURCE, nom), "utf8"));
    const apres = separer(readFileSync(join(SORTIE, nom), "utf8"));

    for (const champ of CHAMPS) {
      const a = normaliser(avant.entete[champ]);
      const b = normaliser(apres.entete[champ]);
      const vide = (v: unknown) => v === undefined || v === "" || v === null;
      if (vide(a) && vide(b)) continue;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        ecarts.push(`${nom} · ${champ} : ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
      }
    }

    if (avant.corps !== apres.corps) {
      ecarts.push(`${nom} · corps : ${avant.corps.length} → ${apres.corps.length} caractères`);
    } else {
      identiques += 1;
    }
  }

  verifier(
    "aucun écart de métadonnées après aller-retour",
    ecarts.length === 0,
    ecarts.slice(0, 4).join(" | ")
  );
  verifier(
    `les ${publies.length} corps d'article sont identiques au caractère près`,
    identiques === publies.length,
    `${identiques}/${publies.length}`
  );

  const marques = produits.filter((f) =>
    readFileSync(join(SORTIE, f), "utf8").includes("origine: base")
  );
  verifier(
    "les fichiers produits portent la marque `origine: base`",
    marques.length === publies.length,
    `${marques.length}/${publies.length}`
  );

  /* -------------------------------------------------------- idempotence --- */

  console.log("\nStabilité");

  /*
   * Empreinte du dossier, calculée deux fois sur le MEME ensemble de fichiers.
   *
   * La premiere version comparait `produits` (qui inclut l'article ecrit a la
   * main) a une liste qui l'excluait : la recette echouait sur sa propre
   * comparaison, pas sur un defaut de l'export.
   */
  const empreinte = () =>
    readdirSync(SORTIE)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => `${f}
${readFileSync(join(SORTIE, f), "utf8")}`)
      .join("");

  const empreinteAvant = empreinte();
  execFileSync("node", ["scripts/exporter-articles.mjs"], {
    cwd: SITE,
    env: { ...process.env, DOSSIER_ARTICLES: SORTIE },
    stdio: "pipe",
  });
  verifier("un second export ne change aucun fichier", empreinte() === empreinteAvant);

  /* -------------------------------------------- publication d'un nouvel --- */

  /*
   * LE CAS QUI INQUIÈTE, ET À JUSTE TITRE.
   *
   * L'export EFFACE des fichiers. Publier un nouvel article ne doit surtout pas
   * emporter les anciens : le blog perdrait tout son référencement d'un coup, et
   * personne ne s'en apercevrait avant d'aller voir le site.
   */
  console.log("\nPublication d'un nouvel article");

  const avantAjout = new Map(
    readdirSync(SORTIE)
      .filter((f) => f.endsWith(".md"))
      .map((f) => [f, readFileSync(join(SORTIE, f), "utf8")] as const)
  );

  await pool.query(
    `INSERT INTO articles
       (slug, titre, chapeau, corps, categorie, format, auteur, etiquettes,
        faq, statut, publie_le, meta_description)
     VALUES ('tout-nouvel-article', 'Tout nouvel article',
             'Publié après les autres.', '# Nouveau', 'infrastructure', 'info',
             'Recette', ARRAY['nouveau'], '[]'::jsonb, 'publie', CURRENT_DATE,
             'Un article publié après les autres.')`
  );

  execFileSync("node", ["scripts/exporter-articles.mjs"], {
    cwd: SITE,
    env: { ...process.env, DOSSIER_ARTICLES: SORTIE },
    stdio: "pipe",
  });

  const apresAjout = readdirSync(SORTIE).filter((f) => f.endsWith(".md"));

  verifier("le nouvel article est créé", apresAjout.includes("tout-nouvel-article.md"));
  verifier(
    `les ${avantAjout.size} fichiers précédents sont toujours là`,
    [...avantAjout.keys()].every((f) => apresAjout.includes(f)),
    [...avantAjout.keys()].filter((f) => !apresAjout.includes(f)).join(", ") || "aucun manquant"
  );

  const modifies = [...avantAjout.entries()].filter(
    ([f, contenu]) => readFileSync(join(SORTIE, f), "utf8") !== contenu
  );
  verifier(
    "aucun article existant n'a été réécrit",
    modifies.length === 0,
    modifies.map(([f]) => f).join(", ")
  );
  verifier(
    "le dossier compte exactement un fichier de plus",
    apresAjout.length === avantAjout.size + 1,
    `${avantAjout.size} vers ${apresAjout.length}`
  );

  /* ------------------------------------------------------- redirections --- */

  /*
   * Le renommage plus haut a écrit une 301 en base. Rien ne l'appliquait : les
   * anciennes adresses répondaient 404 pendant que la table se remplissait,
   * exactement le défaut que la redirection automatique devait éviter.
   */
  console.log("\nRedirections");

  const HTACCESS = resolve(process.cwd(), ".pont-htaccess");
  copyFileSync(join(SITE, "public", ".htaccess"), HTACCESS);

  /*
   * La redirection est posée à la main ici.
   *
   * C'est l'API qui la crée en vrai, au renommage d'un article publié — mais
   * cette recette n'ouvre pas de serveur : elle n'exerce que les deux ponts.
   * Le comportement de l'API, lui, est vérifié par `npm run recette`.
   */
  await pool.query(
    `INSERT INTO redirections (depuis, vers, code)
     VALUES ('/blog/recette-un/', '/blog/recette-un-renomme/', 301)`
  );

  const exporterRedirections = () =>
    execFileSync("node", ["scripts/exporter-redirections.mjs"], {
      cwd: SITE,
      env: { ...process.env, FICHIER_HTACCESS: HTACCESS },
      stdio: "pipe",
    });

  exporterRedirections();
  const regles = readFileSync(HTACCESS, "utf8");

  verifier(
    "la redirection 301 est écrite dans le .htaccess",
    regles.includes("Redirect 301 /blog/recette-un/ /blog/recette-un-renomme/"),
    regles.split("\n").filter((l) => l.startsWith("Redirect")).join(" | ") || "aucune règle"
  );
  verifier(
    "les règles écrites à la main sont conservées",
    regles.includes("RewriteEngine On") && regles.includes("X-Frame-Options")
  );
  verifier(
    "elle est posée entre les deux marques",
    regles.indexOf("REDIRECTIONS GENEREES — DEBUT") <
      regles.indexOf("Redirect 301 /blog/recette-un/") &&
      regles.indexOf("Redirect 301 /blog/recette-un/") <
        regles.indexOf("REDIRECTIONS GENEREES — FIN")
  );

  // Une adresse inattendue ne doit pas se retrouver dans un fichier de
  // configuration du serveur : une ligne mal formée peut empêcher Apache de
  // démarrer, ce qui rendrait le site entier indisponible.
  await pool.query(
    `INSERT INTO redirections (depuis, vers, code)
     VALUES ('/blog/x/', '/blog/y/" && rm -rf /', 301)`
  );
  exporterRedirections();
  const apresInjection = readFileSync(HTACCESS, "utf8");
  verifier(
    "une adresse malformée est écartée du fichier",
    !apresInjection.includes("rm -rf")
  );

  const stable = readFileSync(HTACCESS, "utf8");
  exporterRedirections();
  verifier("un second passage ne change rien", readFileSync(HTACCESS, "utf8") === stable);

  rmSync(HTACCESS, { force: true });

  /* ------------------------------------------------------------- médias --- */

  console.log("\nMédias");

  const sharp = (await import("sharp")).default;
  const image = await sharp({
    create: { width: 60, height: 40, channels: 3, background: "#2F6BFF" },
  })
    .webp()
    .toBuffer();

  const idMedia = "11111111-2222-3333-4444-555555555555";
  await pool.query(
    `INSERT INTO medias (id, nom, type_mime, type_origine, taille, largeur,
                         hauteur, contenu, chemin, alt)
     VALUES ($1, 'visuel.webp', 'image/webp', 'image/png', $2, 60, 40, $3, NULL, 'Un visuel')`,
    [idMedia, image.length, image]
  );

  const SORTIE_MEDIAS = resolve(process.cwd(), ".pont-medias");
  rmSync(SORTIE_MEDIAS, { recursive: true, force: true });

  const exporterMedias = () =>
    execFileSync("node", ["scripts/exporter-medias.mjs"], {
      cwd: SITE,
      env: { ...process.env, DOSSIER_MEDIAS: SORTIE_MEDIAS },
      stdio: "pipe",
    });

  exporterMedias();

  const fichiersMedias = readdirSync(SORTIE_MEDIAS).filter((f) => f.endsWith(".webp"));
  verifier("l'image de la base est recopiée pour le site", fichiersMedias.length === 1);
  verifier(
    "elle porte le nom attendu par l'adresse publique",
    fichiersMedias[0] === `${idMedia}.webp`,
    String(fichiersMedias[0])
  );
  verifier(
    "les octets sont identiques à ceux de la base",
    readFileSync(join(SORTIE_MEDIAS, `${idMedia}.webp`)).equals(image)
  );

  /* ------------------------------------------- une vidéo, qui vit sur le disque

     Le pont manquant, découvert au lot 3 : ce script ne transportait que les
     fichiers stockés EN BASE. Une vidéo envoyée depuis le panel s'affichait
     dans l'aperçu, puis renvoyait un 404 sur le site construit.

     Elle est facticement rangée comme le fait le serveur — un sous-dossier de
     deux caractères — et doit ressortir À PLAT, sous le nom que porte son
     adresse publique. */
  const idVideo = "66666666-7777-8888-9999-000000000000";
  const RACINE_DISQUE = resolve(process.cwd(), ".pont-disque");
  const octetsVideo = Buffer.alloc(2048);
  octetsVideo.write("ftyp", 4, "ascii");

  rmSync(RACINE_DISQUE, { recursive: true, force: true });
  mkdirSync(join(RACINE_DISQUE, "66"), { recursive: true });
  writeFileSync(join(RACINE_DISQUE, "66", `${idVideo}.mp4`), octetsVideo);

  await pool.query(
    `INSERT INTO medias (id, nom, type_mime, type_origine, taille, contenu, chemin, alt)
     VALUES ($1, 'gala.mp4', 'video/mp4', 'video/mp4', $2, NULL, $3, 'Le gala')`,
    [idVideo, octetsVideo.length, `66/${idVideo}.mp4`]
  );

  /* Sans CHEMIN_MEDIAS, le build doit S'ARRÊTER plutôt que de publier une page
     dont la vidéo manque. */
  let arret = false;
  try {
    exporterMedias();
  } catch {
    arret = true;
  }
  verifier("sans CHEMIN_MEDIAS, la construction s'arrête au lieu de publier un trou", arret);

  execFileSync("node", ["scripts/exporter-medias.mjs"], {
    cwd: SITE,
    env: { ...process.env, DOSSIER_MEDIAS: SORTIE_MEDIAS, CHEMIN_MEDIAS: RACINE_DISQUE },
    stdio: "pipe",
  });

  verifier(
    "la vidéo du disque est recopiée à plat, sous le nom de son adresse",
    existsSync(join(SORTIE_MEDIAS, `${idVideo}.mp4`))
  );
  verifier(
    "ses octets sont intacts",
    existsSync(join(SORTIE_MEDIAS, `${idVideo}.mp4`)) &&
      readFileSync(join(SORTIE_MEDIAS, `${idVideo}.mp4`)).equals(octetsVideo)
  );

  await pool.query(`DELETE FROM medias WHERE id = $1`, [idVideo]);
  rmSync(RACINE_DISQUE, { recursive: true, force: true });

  // Un média supprimé en base doit disparaître du site à la reconstruction
  // suivante, sans quoi le dossier grossit indéfiniment.
  await pool.query(`DELETE FROM medias WHERE id = $1`, [idMedia]);
  exporterMedias();
  verifier(
    "un média supprimé en base disparaît du site",
    readdirSync(SORTIE_MEDIAS).filter((f) => f !== ".genere-depuis-la-base").length === 0
  );

  rmSync(SORTIE_MEDIAS, { recursive: true, force: true });

  /* ------------------------------------------------ parutions programmées --- */

  console.log("\nParutions programmées");

  await pool.query(
    `INSERT INTO articles
       (slug, titre, chapeau, corps, categorie, format, auteur, etiquettes,
        faq, statut, publie_le, meta_description)
     VALUES
       ('parution-du-jour', 'Sa date est arrivée', 'Programmé pour hier.',
        '# Hier', 'infrastructure', 'info', 'Recette', ARRAY['test'], '[]'::jsonb,
        'programme', CURRENT_DATE - 1, 'Article dont la date est passée.'),
       ('parution-plus-tard', 'Sa date est à venir', 'Programmé pour dans trois jours.',
        '# Plus tard', 'infrastructure', 'info', 'Recette', ARRAY['test'], '[]'::jsonb,
        'programme', CURRENT_DATE + 3, 'Article dont la date est à venir.')`
  );

  /*
   * ⚠️ `COMMANDE_RECONSTRUCTION` est vidée pour l'enfant.
   *
   * Sans cela, la tâche lancerait un VRAI `npm run build` dans le dépôt, avec
   * cette base jetable pour source — et le pont réécrirait `content/blog/` avec
   * les articles de la recette. C'est exactement l'accident du 5 septembre, et
   * il ne se reproduira pas ici. Le chargeur de `.env` du serveur ne remplace
   * jamais une variable déjà posée : une chaîne vide suffit à le neutraliser.
   */
  const lancerParutions = () =>
    /*
     * Node lancé directement, et `tsx` chargé en greffon.
     *
     * Ni `npx` (introuvable sans passer par un shell sous Windows) ni
     * `shell: true` (qui concatène les arguments au lieu de les échapper, ce
     * que Node signale à juste titre). `process.execPath` est le Node qui fait
     * tourner cette recette : la tâche s'exécute donc avec la même version.
     */
    execFileSync(process.execPath, [
      "--import",
      "tsx",
      "src/outils/parutions.ts",
    ], {
      cwd: process.cwd(),
      env: { ...process.env, COMMANDE_RECONSTRUCTION: "" },
      stdio: "pipe",
    }).toString();

  const sortieParutions = lancerParutions();

  const statuts = await pool.query<{ slug: string; statut: string }>(
    `SELECT slug, statut FROM articles
      WHERE slug IN ('parution-du-jour', 'parution-plus-tard') ORDER BY slug`
  );
  const statutDe = (slug: string) => statuts.rows.find((r) => r.slug === slug)?.statut;

  verifier(
    "un article dont la date est arrivée passe en publié",
    statutDe("parution-du-jour") === "publie",
    String(statutDe("parution-du-jour"))
  );
  verifier(
    "un article daté du futur n'est pas touché",
    statutDe("parution-plus-tard") === "programme",
    String(statutDe("parution-plus-tard"))
  );

  const traceParution = await pool.query<{ acteur: string; detail: string }>(
    `SELECT acteur, detail FROM journal
      WHERE action = 'publication' AND cible = 'parution-du-jour'`
  );
  verifier(
    "la parution est tracée au nom de la tâche, pas d'une personne",
    traceParution.rows.length === 1 && traceParution.rows[0]!.acteur === "tâche programmée",
    traceParution.rows[0]?.acteur ?? "aucune trace"
  );

  const publications = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM publications`
  );
  verifier(
    "une seule reconstruction est demandée pour la journée",
    publications.rows[0]?.n === "1",
    `${publications.rows[0]?.n} publication(s)`
  );

  /* Relancée le lendemain sans rien de nouveau : la tâche ne doit RIEN faire.
     Une reconstruction quotidienne inutile userait le serveur pour rien. */
  const secondPassage = lancerParutions();
  const publicationsApres = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM publications`
  );
  verifier(
    "relancée sans article à publier, elle ne reconstruit rien",
    publicationsApres.rows[0]?.n === "1" && /aucun article/i.test(secondPassage),
    `${publicationsApres.rows[0]?.n} publication(s) · ${secondPassage.trim().slice(0, 60)}`
  );

  await pool.query(
    `DELETE FROM articles WHERE slug IN ('parution-du-jour', 'parution-plus-tard')`
  );
  void sortieParutions;

  /* --------------------------------------------------------- garde-fou --- */

  /* --------------------------------------------- contenu de l'accueil --- */

  console.log("\nContenu de la page d'accueil");

  const DOSSIER_CONTENU = join(SITE, "content", "accueil");
  const SORTIE_CONTENU = resolve(process.cwd(), ".pont-contenu");
  rmSync(SORTIE_CONTENU, { recursive: true, force: true });
  mkdirSync(SORTIE_CONTENU, { recursive: true });

  const sections = readdirSync(DOSSIER_CONTENU).filter(
    (f) => f.endsWith(".json") && !f.startsWith(".")
  );
  for (const f of sections) copyFileSync(join(DOSSIER_CONTENU, f), join(SORTIE_CONTENU, f));

  /* `spawnSync` : les avertissements partent par `console.warn`, donc sur la
     sortie d'erreur, qu'`execFileSync` ne rend pas. */
  const exporterContenu = () => {
    const r = spawnSync("node", ["scripts/exporter-contenu.mjs"], {
      cwd: SITE,
      env: { ...process.env, DOSSIER_CONTENU: SORTIE_CONTENU },
      encoding: "utf8",
    });
    return `${r.stdout ?? ""}${r.stderr ?? ""}`;
  };

  /*
   * LE PIÈGE PROPRE À CE PONT.
   *
   * Le schéma crée les douze sections avec `{}`. Si l'export ne les écartait
   * pas, la toute première construction remplacerait le contenu du site par des
   * objets vides -- et le build échouerait douze fois de suite, sur des
   * messages parlant de champs manquants, sans jamais dire d'où vient le vide.
   */
  const avantVide = readFileSync(join(SORTIE_CONTENU, "hero.json"), "utf8");
  const sortieVide = exporterContenu();
  verifier(
    "une section vide en base ne touche pas au fichier",
    readFileSync(join(SORTIE_CONTENU, "hero.json"), "utf8") === avantVide
  );
  verifier(
    "l'export dit combien de sections sont encore vides",
    sortieVide.includes("encore vide"),
    sortieVide.trim().split("\n").pop() ?? ""
  );

  /* L'aller : les fichiers remplissent la base. */
  const importerContenu = (args: string[] = []) =>
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "src/outils/importer-contenu.ts", ...args],
      { cwd: process.cwd(), env: process.env, stdio: "pipe", encoding: "utf8" }
    );

  importerContenu();

  const remplies = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM contenu_pages WHERE donnees <> '{}'::jsonb`
  );
  verifier(
    `les ${sections.length} sections sont en base`,
    Number(remplies.rows[0]?.n) === sections.length,
    `${remplies.rows[0]?.n} remplie(s)`
  );

  const solutionsEnBase = await pool.query<{ donnees: { poles?: unknown[] } }>(
    `SELECT donnees FROM contenu_pages WHERE cle = 'solutions'`
  );
  verifier(
    "les structures imbriquées survivent au passage en jsonb",
    Array.isArray(solutionsEnBase.rows[0]?.donnees.poles) &&
      solutionsEnBase.rows[0].donnees.poles.length === 3
  );

  /* Relancer ne doit rien écraser. */
  await pool.query(`UPDATE contenu_pages SET donnees = '{"titre":"modifié"}'::jsonb WHERE cle = 'hero'`);
  importerContenu();
  const apresDeuxieme = await pool.query<{ donnees: { titre?: string } }>(
    `SELECT donnees FROM contenu_pages WHERE cle = 'hero'`
  );
  verifier(
    "relancer l'import n'écrase pas ce qui est déjà en base",
    apresDeuxieme.rows[0]?.donnees.titre === "modifié"
  );

  importerContenu(["--ecraser"]);
  const apresForce = await pool.query<{ donnees: { titre?: string } }>(
    `SELECT donnees FROM contenu_pages WHERE cle = 'hero'`
  );
  verifier(
    "« --ecraser » remplace bien le contenu",
    apresForce.rows[0]?.donnees.titre?.startsWith("Éditeur de logiciels") === true,
    String(apresForce.rows[0]?.donnees.titre)
  );

  /* Le retour : la base réécrit les fichiers, à l'identique. */
  for (const f of sections) writeFileSync(join(SORTIE_CONTENU, f), "{}\n", "utf8");
  exporterContenu();

  /*
   * On compare le SENS, pas l'écriture.
   *
   * PostgreSQL ne conserve pas l'ordre des clés d'un `jsonb` : il les range par
   * longueur puis par octets. Un aller-retour réordonne donc les champs à
   * l'intérieur des objets -- sept sections sur douze le montraient.
   *
   * C'est sans conséquence : aucun composant ne dépend de l'ordre des clés, et
   * un second export ne rebouge plus rien (vérifié juste après). Le seul effet
   * visible est un remaniement des fichiers à la première migration.
   *
   * `normaliser` trie déjà les clés en profondeur : il sert aussi bien ici que
   * pour l'en-tête des articles.
   */
  const sectionsDivergentes: string[] = [];
  for (const f of sections) {
    const attendu = normaliser(JSON.parse(readFileSync(join(DOSSIER_CONTENU, f), "utf8")));
    const obtenu = normaliser(JSON.parse(readFileSync(join(SORTIE_CONTENU, f), "utf8")));
    if (JSON.stringify(attendu) !== JSON.stringify(obtenu)) sectionsDivergentes.push(f);
  }
  verifier(
    `les ${sections.length} sections reviennent identiques`,
    sectionsDivergentes.length === 0,
    sectionsDivergentes.join(", ")
  );

  verifier(
    "un manifeste signale les sections issues de la base",
    existsSync(join(SORTIE_CONTENU, ".genere-depuis-la-base.json"))
  );

  const stableContenu = sections
    .map((f) => readFileSync(join(SORTIE_CONTENU, f), "utf8"))
    .join("");
  exporterContenu();
  verifier(
    "un second export ne change aucun fichier",
    sections.map((f) => readFileSync(join(SORTIE_CONTENU, f), "utf8")).join("") === stableContenu
  );

  /* Une clé en base sans fichier ne doit rien créer. */
  await pool.query(
    `INSERT INTO contenu_pages (cle, libelle, donnees)
     VALUES ('section-inventee', 'Inventée', '{"a":1}'::jsonb)`
  );
  const sortieInventee = exporterContenu();
  verifier(
    "une clé sans fichier correspondant est ignorée",
    !existsSync(join(SORTIE_CONTENU, "section-inventee.json")) &&
      sortieInventee.includes("section-inventee")
  );

  rmSync(SORTIE_CONTENU, { recursive: true, force: true });

  /* --------------------------------------------------------- garde-fou --- */

  console.log("\nGarde-fou : base vide");

  await pool.query(`UPDATE articles SET supprime = true`);
  // `spawnSync` et non `execFileSync` : l'avertissement part par `console.warn`,
  // donc sur la sortie d'erreur, qu'`execFileSync` ne rend pas. Le controle
  // echouait alors que le script prevenait bien.
  const lance = spawnSync("node", ["scripts/exporter-articles.mjs"], {
    cwd: SITE,
    env: { ...process.env, DOSSIER_ARTICLES: SORTIE },
    encoding: "utf8",
  });
  const sortie = `${lance.stdout ?? ""}${lance.stderr ?? ""}`;
  const restants = readdirSync(SORTIE).filter((f) => f.endsWith(".md"));
  verifier(
    "une base sans article ne supprime rien",
    restants.length === publies.length + 2,
    `${restants.length} fichier(s), ${publies.length + 2} attendu(s)`
  );
  verifier("le script prévient explicitement", sortie.includes("Aucun article publié en base"));

  /* -------------------------------------------------------------- fin --- */

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

principal().catch((e) => {
  console.error("\n✖ La recette du pont s'est interrompue :", e);
  nettoyer();
  process.exit(1);
});
