import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Server } from "node:http";
import EmbeddedPostgres from "embedded-postgres";

/**
 * ---------------------------------------------------------------------------
 * RECETTE DU PANEL BRANCHÉ SUR LE SERVEUR
 * ---------------------------------------------------------------------------
 *
 *     npm run recette-panel
 *
 * La seule chose que les autres recettes ne prouvent pas : que le PANEL, dans
 * un vrai navigateur, sait parler au serveur.
 *
 * Tout le reste a été vérifié par des requêtes HTTP écrites à la main. Cela
 * démontre que l'API respecte son contrat — pas que l'interface l'appelle
 * correctement, ni que la session survit à un rechargement, ni que la
 * déconnexion ferme réellement l'accès.
 *
 * CE QUE LE SCRIPT MONTE
 * ----------------------
 *   1. une vraie base PostgreSQL, avec le schéma et deux comptes ;
 *   2. les cinq articles publiés du site, importés en base ;
 *   3. l'API, sur le port 3999 ;
 *   4. le serveur de développement Vite, sur le port 8099, en mode `recette`
 *      (voir `.env.recette` : `VITE_API_URL` et `VITE_ADMIN_AUTH=serveur`) ;
 *   5. un navigateur sans fenêtre, piloté par le protocole DevTools.
 *
 * Puis il fait ce que ferait la Direction : ouvrir /admin, se tromper de mot de
 * passe, se connecter, regarder ses articles, recharger la page, se déconnecter.
 */

const PORT_BD = 54_333;
const PORT_API = 3999;
const PORT_SITE = 8099;
const PORT_CDP = 9333;

const DOSSIER_BD = resolve(process.cwd(), ".pg-panel");
const SITE = resolve(process.cwd(), "..");
const ORIGINE = `http://localhost:${PORT_SITE}`;

const CHROME =
  process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : "google-chrome";

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

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ========================================================================= */
/* Pilotage du navigateur                                                    */
/* ========================================================================= */

type Navigateur = {
  aller: (url: string) => Promise<void>;
  evaluer: <T>(expression: string) => Promise<T>;
  deposerFichier: (selecteur: string, chemin: string) => Promise<void>;
  texte: () => Promise<string>;
  attendre: (motif: string, msMax?: number) => Promise<boolean>;
  requetes: () => string[];
  fermer: () => void;
};

const ouvrirNavigateur = async (): Promise<Navigateur> => {
  const cibles = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json();
  const page = (cibles as { type: string; webSocketDebuggerUrl: string }[]).find(
    (c) => c.type === "page"
  );
  if (!page) throw new Error("Aucun onglet ouvert dans le navigateur.");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const attente = new Map<number, (v: unknown) => void>();
  const urls: string[] = [];

  ws.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && attente.has(m.id)) {
      attente.get(m.id)!(m.result);
      attente.delete(m.id);
    }
    if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url);
  });
  await new Promise((r) => ws.addEventListener("open", r));

  const envoyer = (methode: string, params: unknown = {}) =>
    new Promise<Record<string, unknown>>((r) => {
      const n = ++id;
      attente.set(n, r as (v: unknown) => void);
      ws.send(JSON.stringify({ id: n, method: methode, params }));
    });

  await envoyer("Page.enable");
  await envoyer("Runtime.enable");
  await envoyer("Network.enable");
  // `DOM.setFileInputFiles` exige que le document ait été parcouru au moins une
  // fois : sans `DOM.enable`, la requête échoue sur un nœud « introuvable ».
  await envoyer("DOM.enable");

  const evaluer = async <T>(expression: string): Promise<T> => {
    const r = (await envoyer("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as { exceptionDetails?: { exception?: { description?: string } }; result?: { value: T } };
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "erreur dans la page");
    }
    return r.result?.value as T;
  };

  /**
   * Dépose un vrai fichier dans un champ `<input type="file">`.
   *
   * On ne peut pas le faire depuis la page : le contenu d'un champ de fichier
   * n'est pas modifiable par script, précisément pour qu'un site ne puisse pas
   * envoyer un fichier à l'insu de son visiteur. Il faut passer par le
   * navigateur lui-même, ce que permet le protocole DevTools.
   *
   * C'est aussi ce qui rend ce test crédible : le fichier suit exactement le
   * chemin qu'il suivrait si quelqu'un le choisissait dans la boîte de dialogue.
   */
  const deposerFichier = async (selecteur: string, chemin: string) => {
    const doc = (await envoyer("DOM.getDocument", { depth: -1 })) as {
      root: { nodeId: number };
    };
    const trouve = (await envoyer("DOM.querySelector", {
      nodeId: doc.root.nodeId,
      selector: selecteur,
    })) as { nodeId: number };
    if (!trouve.nodeId) throw new Error(`Champ de fichier introuvable : ${selecteur}`);
    await envoyer("DOM.setFileInputFiles", { nodeId: trouve.nodeId, files: [chemin] });
  };

  const texte = () => evaluer<string>("document.body.innerText");

  /**
   * Attend qu'un mot apparaisse à l'écran, plutôt que de dormir un temps fixe.
   *
   * Une attente fixe est un pari sur la machine : le premier chargement de Vite
   * compile des centaines de modules, les suivants non. La première version de
   * cette recette dormait 3,5 s et échouait un lancement sur trois sur
   * « le panel s'ouvre sur l'écran de connexion » — un défaut du test, pas du
   * panel, mais qui suffit à faire douter de tous les autres résultats.
   */
  const attendre = async (motif: string, msMax = 20_000): Promise<boolean> => {
    const debut = Date.now();
    for (;;) {
      const t = (await texte()).toLowerCase();
      if (t.includes(motif.toLowerCase())) return true;
      if (Date.now() - debut > msMax) return false;
      await dormir(300);
    }
  };

  return {
    aller: async (url) => {
      await envoyer("Page.navigate", { url });
      // Le panel charge ses vues en différé ; l'appelant attend ensuite ce
      // qu'il cherche.
      await dormir(800);
    },
    evaluer,
    deposerFichier,
    texte,
    attendre,
    requetes: () => [...urls],
    fermer: () => ws.close(),
  };
};

/** Remplit les deux champs du formulaire et le soumet. */
const seConnecter = (nav: Navigateur, email: string, mdp: string) =>
  nav.evaluer<number>(`
    (() => {
      const champs = [...document.querySelectorAll('input')];
      const poser = (el, v) => {
        // React n'écoute pas une affectation directe de \`value\` : il faut
        // passer par le setter natif puis émettre l'événement qu'il attend.
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      poser(champs[0], ${JSON.stringify(email)});
      poser(champs[1], ${JSON.stringify(mdp)});
      document.querySelector('form').requestSubmit();
      return 1;
    })()`);

/* ========================================================================= */

const nettoyer = () => {
  try {
    rmSync(DOSSIER_BD, { recursive: true, force: true });
  } catch {
    /* fichiers encore verrouillés par PostgreSQL : sans conséquence */
  }
};

let vite: ChildProcess | null = null;
let chrome: ChildProcess | null = null;

/**
 * Tue un processus ET ses enfants.
 *
 * Sur Windows, `npm run dev` lance `npm.cmd`, qui lance `node`, qui lance Vite.
 * `kill()` ne s'adresse qu'au premier : Vite survit, garde le port 8099, et le
 * lancement suivant de cette recette croit avoir un site alors qu'il parle à un
 * orphelin sur le point de mourir. Symptôme observé : « localhost refused to
 * connect » un lancement sur deux, sans qu'aucun code applicatif soit en cause.
 */
const arreterArbre = (p: ChildProcess | null) => {
  if (!p?.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      /* déjà mort */
    }
  } else {
    try {
      process.kill(-p.pid, "SIGKILL");
    } catch {
      p.kill("SIGKILL");
    }
  }
};

const arreterTout = async (api?: Server, pool?: { end: () => Promise<void> }, bd?: EmbeddedPostgres) => {
  arreterArbre(chrome);
  arreterArbre(vite);
  if (api) await new Promise<void>((r) => api.close(() => r()));
  await pool?.end().catch(() => undefined);
  await bd?.stop().catch(() => undefined);
  nettoyer();
};

/* ========================================================================= */

const principal = async () => {
  console.log("\n═══ RECETTE DU PANEL BRANCHÉ SUR LE SERVEUR ═══");
  nettoyer();

  /* ---------------------------------------------------------- 1. la base */

  console.log("\nPréparation");
  const bd = new EmbeddedPostgres({
    databaseDir: DOSSIER_BD,
    user: "panel",
    password: "panel",
    port: PORT_BD,
    persistent: false,
  });
  await bd.initialise();
  await bd.start();

  const pgBrut = (await import("pg")).default;
  {
    const c = new pgBrut.Client({
      connectionString: `postgres://panel:panel@localhost:${PORT_BD}/postgres`,
    });
    await c.connect();
    await c.query(
      `CREATE DATABASE megasoft_panel
         ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`
    );
    await c.end();
  }

  process.env.DATABASE_URL = `postgres://panel:panel@localhost:${PORT_BD}/megasoft_panel`;
  process.env.PGSSLMODE = "disable";
  process.env.SECRET_SESSION = "recette-panel-secret-suffisamment-long-0123456789";
  process.env.ORIGINE_AUTORISEE = ORIGINE;
  process.env.ENVIRONNEMENT = "developpement";
  process.env.COUT_BCRYPT = "4";
  process.env.PORT = String(PORT_API);

  /*
   * Aucune reconstruction — même raison que dans `recette.ts` : sans ces deux
   * lignes, une publication déclenchée pendant la recette lance `npm run build`
   * dans le vrai dépôt et y écrase `content/` avec la base jetable.
   */
  process.env.COMMANDE_RECONSTRUCTION = "";
  process.env.REPERTOIRE_SITE = "";

  const { pool, requete } = await import("../bd.js");
  const { hacher } = await import("../session.js");
  const { creerApp } = await import("../app.js");

  await pool.query(readFileSync(resolve(process.cwd(), "schema.sql"), "utf8"));

  await requete(
    `INSERT INTO utilisateurs (nom, email, role, empreinte_mdp) VALUES ($1, $2, 'administrateur', $3)`,
    ["Direction Megasoft", "direction@megasoft-office.com", await hacher("motdepasse-direction")]
  );
  console.log("  · base prête, compte administrateur créé");

  /* ------------------------------------------------- 2. les vrais articles */

  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "src/outils/importer-fichiers.ts"],
    { cwd: process.cwd(), env: process.env, stdio: "pipe" }
  );
  const enBase = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM articles WHERE statut = 'publie'`
  );
  console.log(`  · ${enBase[0]?.n} articles publiés importés`);

  /* ------------------------------------------------------------- 3. l'API */

  const api: Server = await new Promise((r) => {
    const s = creerApp().listen(PORT_API, () => r(s));
  });
  console.log(`  · API sur http://localhost:${PORT_API}`);

  /* --------------------------------------------------- 4. le site en dev */

  /*
   * Le port doit être libre AVANT de démarrer.
   *
   * Sinon la boucle d'attente ci-dessous interroge un serveur qui n'est pas le
   * nôtre — un reste d'un lancement précédent, ou le serveur de développement
   * ouvert pour travailler — et la recette part sur une base fausse.
   */
  try {
    await fetch(`${ORIGINE}/`, { signal: AbortSignal.timeout(1500) });
    throw new Error(
      `Le port ${PORT_SITE} est déjà occupé. Fermez le serveur qui l'utilise, ` +
        "puis relancez la recette."
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("déjà occupé")) throw e;
    /* personne ne répond : c'est ce qu'on veut */
  }

  vite = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--mode", "recette", "--port", String(PORT_SITE), "--strictPort"],
    {
      cwd: SITE,
      stdio: "pipe",
      shell: process.platform === "win32",
      // Un groupe de processus à part, pour pouvoir tuer Vite et ses enfants
      // d'un seul geste sur les systèmes qui le permettent.
      detached: process.platform !== "win32",
    }
  );

  // On attend que Vite réponde vraiment, plutôt que de dormir un temps fixe :
  // la première compilation dure beaucoup plus longtemps que les suivantes.
  const debut = Date.now();
  for (;;) {
    try {
      const r = await fetch(`${ORIGINE}/`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) break;
    } catch {
      /* pas encore prêt */
    }
    if (Date.now() - debut > 90_000) throw new Error("Vite n'a pas démarré en 90 s.");
    await dormir(700);
  }
  console.log(`  · site de développement sur ${ORIGINE}`);

  /* ------------------------------------------------------ 5. le navigateur */

  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT_CDP}`,
      `--user-data-dir=${resolve(process.cwd(), ".chrome-panel")}`,
      "--no-first-run",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  await dormir(4000);
  const nav = await ouvrirNavigateur();
  console.log("  · navigateur prêt");

  /* ==================================================================== */

  console.log("\nÉcran de connexion");

  await nav.aller(`${ORIGINE}/admin`);
  const ouvert = await nav.attendre("administration", 30_000);
  let texte = await nav.texte();

  verifier(
    "le panel s'ouvre sur l'écran de connexion",
    ouvert,
    texte.slice(0, 80).split("\n").join(" ")
  );
  verifier(
    "le mode atelier n'est PAS proposé",
    !texte.toLowerCase().includes("mode atelier"),
    "le formulaire accepterait n'importe quel mot de passe"
  );
  verifier(
    "l'accès n'est pas annoncé comme fermé",
    !texte.toLowerCase().includes("accès fermé"),
    "le fournisseur « serveur » n'est pas actif"
  );

  console.log("\nRefus");

  await seConnecter(nav, "direction@megasoft-office.com", "mauvais-mot-de-passe");
  await nav.attendre("incorrect", 10_000);
  texte = await nav.texte();

  verifier(
    "un mauvais mot de passe est refusé par le serveur",
    texte.includes("Identifiant ou mot de passe incorrect"),
    texte.split("\n").find((l) => l.includes("incorrect")) ?? "aucun message"
  );
  verifier("on reste sur l'écran de connexion", !texte.includes("Diagnostic"));

  const refus = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM journal WHERE action = 'connexion-refusee'`
  );
  verifier(
    "le refus est tracé dans le journal du serveur",
    Number(refus[0]?.n) >= 1,
    `${refus[0]?.n} entrée(s)`
  );

  console.log("\nConnexion");

  await seConnecter(nav, "direction@megasoft-office.com", "motdepasse-direction");
  await nav.attendre("diagnostic", 20_000);
  texte = await nav.texte();

  verifier(
    "la connexion ouvre le panel",
    texte.includes("Articles") && texte.includes("Diagnostic"),
    texte.slice(0, 80).replace(/\n/g, " ")
  );
  verifier(
    "l'adresse de la personne connectée est affichée",
    texte.includes("direction@megasoft-office.com")
  );
  verifier(
    "la pastille « Stockage local » a disparu",
    !texte.toLowerCase().includes("stockage local"),
    "le panel croit encore écrire dans le navigateur"
  );

  const sessions = await requete<{ n: string }>(`SELECT count(*)::text AS n FROM sessions`);
  verifier("une session existe en base", Number(sessions[0]?.n) === 1, `${sessions[0]?.n}`);

  console.log("\nLes données viennent bien du serveur");

  const appels = nav.requetes().filter((u) => u.includes("/api/"));
  verifier(
    "le panel a réellement appelé l'API",
    appels.some((u) => u.includes("/api/articles")),
    `${appels.length} appel(s)`
  );
  verifier(
    "la session a été vérifiée au chargement",
    appels.some((u) => u.endsWith("/api/session"))
  );

  const titres = await requete<{ titre: string }>(
    `SELECT titre FROM articles WHERE statut = 'publie' ORDER BY titre LIMIT 3`
  );

  /*
   * On attend un TITRE, pas seulement l'ossature du panel.
   *
   * `demarrer()` remplit le cache après le premier rendu : les onglets sont
   * déjà là quand la liste est encore vide. Attendre « Diagnostic » ne prouvait
   * donc rien sur les articles, et la vérification échouait un lancement sur
   * deux — sur un défaut du test, pas du panel.
   */
  await nav.attendre((titres[0]?.titre ?? "").slice(0, 25), 20_000);
  texte = await nav.texte();

  const affiches = titres.filter((t) => texte.includes(t.titre.slice(0, 30)));
  verifier(
    "les articles de la base sont affichés",
    affiches.length === titres.length,
    `${affiches.length}/${titres.length}`
  );

  console.log("\nEnvoi d'une image depuis le panel");

  /*
   * Une photographie, pas un aplat : le WebP avec perte n'a d'intérêt que sur
   * des dégradés continus, et une image unie se compresserait si bien que le
   * gain ne prouverait rien.
   */
  const sharp = (await import("sharp")).default;
  const largeurSource = 2400;
  const hauteurSource = 1600;
  const pixels = Buffer.alloc(largeurSource * hauteurSource * 3);
  for (let y = 0; y < hauteurSource; y += 1) {
    for (let x = 0; x < largeurSource; x += 1) {
      const i = (y * largeurSource + x) * 3;
      pixels[i] = Math.round(128 + 120 * Math.sin(x / 90) * Math.cos(y / 130));
      pixels[i + 1] = Math.round(120 + 110 * Math.sin((x + y) / 160));
      pixels[i + 2] = Math.round(140 + 100 * Math.cos(y / 70));
    }
  }
  const CHEMIN_IMAGE = resolve(process.cwd(), ".image-recette.png");
  await sharp(pixels, { raw: { width: largeurSource, height: hauteurSource, channels: 3 } })
    .png()
    .toFile(CHEMIN_IMAGE);
  const poidsOrigine = statSync(CHEMIN_IMAGE).size;

  await nav.evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Médias');
      if (!b) return 0;
      b.click();
      return 1;
    })()`);
  await nav.attendre("ce que l'outil impose", 10_000);

  texte = await nav.texte();
  verifier(
    "les règles affichées sont celles du serveur",
    texte.includes("2 000 px") && texte.includes("dans la base"),
    "l'écran annonce encore les règles du traitement navigateur"
  );

  // Le texte alternatif est bloquant : le panel refuse l'import sans lui.
  const altPose = await nav.evaluer<number>(`
    (() => {
      const champ = [...document.querySelectorAll('input, textarea')]
        .find(e => e.type !== 'file' && e.offsetParent !== null);
      if (!champ) return 0;
      const proto = champ.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(champ, 'Vue de l atelier');
      champ.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
  verifier("le champ de texte alternatif est trouvé", altPose === 1);
  await dormir(500);

  await nav.deposerFichier('input[type="file"]', CHEMIN_IMAGE);
  // La conversion a lieu sur le serveur : on lui laisse le temps.
  await dormir(7000);

  const medias = await requete<{
    nom: string;
    type_mime: string;
    type_origine: string;
    taille: string;
    largeur: number;
    hauteur: number;
    alt: string;
    en_base: boolean;
  }>(
    `SELECT nom, type_mime, type_origine, taille::text, largeur, hauteur, alt,
            (contenu IS NOT NULL) AS en_base
       FROM medias`
  );

  verifier("l'image est arrivée en base", medias.length === 1, `${medias.length} média(s)`);

  const img = medias[0];
  verifier(
    "elle a été convertie en WebP par le serveur",
    img?.type_mime === "image/webp" && img?.type_origine === "image/png",
    `${img?.type_mime} depuis ${img?.type_origine}`
  );
  verifier("elle est stockée dans la base, pas sur le disque", img?.en_base === true);
  verifier(
    "elle est réduite à 2 000 px de large",
    img?.largeur === 2000 && img?.hauteur === 1333,
    `${img?.largeur}x${img?.hauteur}`
  );
  verifier(
    "elle est nettement allégée",
    Number(img?.taille) < poidsOrigine / 2,
    `${Math.round(poidsOrigine / 1024)} Ko vers ${Math.round(Number(img?.taille) / 1024)} Ko`
  );
  verifier(
    "le texte alternatif saisi est enregistré",
    img?.alt === "Vue de l atelier",
    String(img?.alt)
  );

  const journalMedia = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM journal WHERE action = 'media-ajout'`
  );
  verifier("l'envoi est tracé par le serveur", Number(journalMedia[0]?.n) >= 1);

  /*
   * L'aperçu doit s'afficher DANS le panel.
   *
   * Les octets viennent de l'API : le fichier public `/medias/<id>.webp`
   * n'existe pas tant que le site n'a pas été reconstruit. Une vignette cassée
   * ici signifierait que le panel montre au rédacteur une adresse qui ne
   * répondra qu'après publication.
   */
  const apercu = await nav.evaluer<{ trouvees: number; chargees: number }>(`
    (async () => {
      await new Promise(r => setTimeout(r, 1500));
      const imgs = [...document.querySelectorAll('img')]
        .filter(i => i.src.includes('/api/medias/'));
      return {
        trouvees: imgs.length,
        chargees: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      };
    })()`);
  verifier(
    "l'aperçu pointe vers l'API et s'affiche",
    apercu.trouvees > 0 && apercu.chargees === apercu.trouvees,
    `${apercu.chargees}/${apercu.trouvees} image(s) chargée(s)`
  );

  rmSync(CHEMIN_IMAGE, { force: true });

  /* --------------------------------------- publier demande une reconstruction

     LE DÉFAUT QUE CETTE VÉRIFICATION EXISTE POUR EMPÊCHER.

     Le panel enregistrait « publié » en base, l'article apparaissait dans la
     liste avec le bon statut… et le site ne changeait pas. Le blog est resté
     figé sur ses cinq articles pendant une demi-journée, sans message d'erreur :
     personne ne demandait jamais au serveur de reconstruire.

     C'est le genre de panne qu'aucune relecture n'attrape — tout a l'air
     correct, des deux côtés. Seule cette vérification de bout en bout la voit :
     on publie DEPUIS L'INTERFACE, et on regarde si une reconstruction a été
     demandée. */
  console.log("\nPublier demande une reconstruction");

  await requete(`DELETE FROM publications`);

  await nav.evaluer(`
    (() => {
      const b = document.querySelector('[data-cle="articles"]');
      if (b) b.click();
      return 1;
    })()`);
  await nav.attendre("modifier", 20_000);

  /*
   * On DÉPUBLIE un article depuis la liste.
   *
   * Pourquoi dépublier plutôt que publier : le jeu de données de cette recette
   * ne contient que des articles DÉJÀ publiés — il n'y a aucun brouillon à
   * mettre en ligne. « Dépublier » éprouve exactement le même chemin : une
   * écriture qui change ce que voit un visiteur doit demander une
   * reconstruction. Sans elle, la page resterait en ligne alors que le panel
   * afficherait « brouillon ».
   */
  const retire = await nav.evaluer<string>(`
    (async () => {
      const attendre = (ms) => new Promise(r => setTimeout(r, ms));

      /* La liste se remplit depuis le cache du panel, lui-même alimenté par
         l'API : elle n'est pas là à l'instant du clic sur l'onglet. On attend
         qu'une ligne existe VRAIMENT plutôt que de parier sur un délai — c'est
         ce qui a fait échouer la première version de cette vérification. */
      let menus = [];
      for (let i = 0; i < 40 && menus.length === 0; i += 1) {
        menus = [...document.querySelectorAll('button[aria-haspopup="menu"]')];
        if (!menus.length) await attendre(500);
      }
      if (!menus.length) return 'aucune ligne d article après 20 s';

      menus[0].click();
      await attendre(800);

      const action = [...document.querySelectorAll('button, [role="menuitem"]')]
        .find((x) => /^d.publier$/i.test((x.textContent || '').trim()));
      if (!action) {
        const vus = [...document.querySelectorAll('[role="menuitem"], button')]
          .map((x) => (x.textContent || '').trim())
          .filter((t) => t && t.length < 30)
          .slice(0, 12);
        return 'action Dépublier introuvable — vus : ' + vus.join(' | ');
      }
      action.click();
      return 'ok';
    })()`);
  verifier("l'action « Dépublier » est accessible depuis la liste", retire === "ok", retire);
  await dormir(4000);

  const demandes = await requete<{ n: string }>(
    `SELECT count(*)::text AS n FROM publications`
  );
  verifier(
    "mettre le site à jour DEMANDE une reconstruction",
    Number(demandes[0]?.n) >= 1,
    `${demandes[0]?.n} reconstruction(s) demandée(s) — 0 signifie que le site ne changera jamais`
  );

  const traceParution = await requete<{ action: string }>(
    `SELECT action FROM journal WHERE action IN ('publication', 'depublication')`
  );
  verifier(
    "et le journal dit « depublication », pas « modification »",
    traceParution.some((t) => t.action === "depublication"),
    traceParution.map((t) => t.action).join(", ") || "aucune"
  );

  /* ------------------------------------------------- création d'un compte

     Le défaut que cette vérification existe pour empêcher : le serveur génère
     un mot de passe provisoire et ne le renvoie QU'UNE FOIS — il n'en garde
     que l'empreinte. L'adaptateur du panel jetait cette réponse. Un
     administrateur créait donc un compte parfaitement valide dont personne ne
     pouvait se servir, sans le moindre message d'erreur. */
  console.log("\nCréation d'un compte");

  /* L'onglet porte `data-cle` : plus sûr qu'un libellé, que la feuille de
     style met en majuscules. */
  /* On installe un collecteur d'erreurs AVANT de cliquer : une vue qui ne
     s'affiche pas est presque toujours une erreur de rendu, et sans cela le
     message d'échec ne dit que « rien à l'écran ». */
  await nav.evaluer(`
    (() => {
      window.__erreurs = [];
      window.addEventListener('error', (e) => window.__erreurs.push(String(e.message)));
      const reel = console.error;
      console.error = (...a) => { window.__erreurs.push(a.map(String).join(' ')); reel(...a); };
      return 1;
    })()`);

  const clicOutils = await nav.evaluer<string>(`
    (() => {
      const b = document.querySelector('[data-cle="outils"]');
      if (!b) {
        const cles = [...document.querySelectorAll('[data-cle]')].map(e => e.getAttribute('data-cle'));
        return 'onglet absent — onglets presents : ' + (cles.join(', ') || 'aucun');
      }
      b.click();
      return 'ok';
    })()`);

  /* La vue est chargée en différé : on attend son contenu, pas une durée.
     Elle s'ouvre sur « Sauvegarde » et porte sa propre navigation interne —
     les comptes sont derrière un second onglet. */
  await nav.attendre("zone sensible", 25_000);
  await nav.evaluer(`
    (() => {
      const b = document.querySelector('[data-cle="comptes"]');
      if (b) b.click();
      return 1;
    })()`);

  const outilsOuverts = await nav.attendre("créer un compte", 20_000);

  verifier(
    "l'onglet Outils s'ouvre",
    outilsOuverts,
    clicOutils !== "ok"
      ? clicOutils
      : await nav.evaluer<string>(`
          (() => {
            const err = (window.__erreurs || []).join(' | ').slice(0, 400);
            const bas = document.body.innerText.trim().split(String.fromCharCode(10)).slice(-6).join(' / ');
            return err ? ('erreur : ' + err) : ('bas de page : ' + bas);
          })()`)
  );

  await dormir(600);

  const saisieCompte = await nav.evaluer<number>(`
    (() => {
      const poser = (element, valeur) => {
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(element, valeur);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const champs = [...document.querySelectorAll('input')];
      const nom = champs.find(i => i.placeholder === 'Amel');
      const mail = champs.find(i => i.placeholder === 'amel@megasoft-office.com');
      if (!nom || !mail) return 0;
      poser(nom, 'Nabil');
      poser(mail, 'nabil@megasoft-office.com');
      return 1;
    })()`);
  verifier("le formulaire de création est accessible", saisieCompte === 1);
  await dormir(600);

  await nav.evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Créer le compte');
      if (b && !b.disabled) b.click();
      return 1;
    })()`);
  await dormir(2500);

  const compteEnBase = await requete<{ email: string; role: string }>(
    `SELECT email, role FROM utilisateurs WHERE email = 'nabil@megasoft-office.com'`
  );
  verifier(
    "le compte est réellement créé en base",
    compteEnBase.length === 1,
    `${compteEnBase.length} ligne(s)`
  );

  /* Le mot de passe doit être LISIBLE À L'ÉCRAN. On le relève dans le <code>
     prévu pour lui, puis on s'en sert pour se connecter : c'est la seule
     preuve qui vaille qu'il est utilisable. */
  const motDePasseAffiche = await nav.evaluer<string>(`
    (() => {
      const c = [...document.querySelectorAll('code')]
        .map(e => e.textContent.trim())
        .filter(t => /^[A-Za-z0-9_-]{12,}$/.test(t));
      return c[0] || '';
    })()`);
  verifier(
    "le mot de passe provisoire est affiché à l'administrateur",
    motDePasseAffiche.length >= 12,
    motDePasseAffiche ? `${motDePasseAffiche.length} caractères` : "aucun mot de passe à l'écran"
  );

  const connexionNouveau = await fetch(`http://localhost:${PORT_API}/api/connexion`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGINE },
    body: JSON.stringify({
      email: "nabil@megasoft-office.com",
      motDePasse: motDePasseAffiche,
    }),
  });
  verifier(
    "ce mot de passe ouvre réellement le compte",
    connexionNouveau.status === 200,
    `reçu ${connexionNouveau.status}`
  );

  /*
   * On REFERME cette session.
   *
   * Elle vient d'être ouverte par la vérification ci-dessus, et la recette
   * contrôle plus bas qu'il ne reste AUCUNE session après la déconnexion.
   * Sans ce nettoyage, ce contrôle échouait — sur un défaut du test, pas du
   * panel. Une recette ne doit pas laisser le décor dans un autre état
   * qu'elle ne l'a trouvé.
   */
  const cookieNouveau = (connexionNouveau.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0] ?? "")
    .find((c) => c.startsWith("ms_session="));

  if (cookieNouveau) {
    await fetch(`http://localhost:${PORT_API}/api/deconnexion`, {
      method: "POST",
      headers: { Origin: ORIGINE, Cookie: cookieNouveau },
    });
  }

  console.log("\nLa session survit au rechargement");

  await nav.aller(`${ORIGINE}/admin`);
  const encoreConnecte = await nav.attendre("diagnostic", 15_000);
  texte = await nav.texte();
  verifier(
    "on reste connecté après un rechargement",
    encoreConnecte,
    "l'écran de connexion est réapparu"
  );
  verifier(
    "aucun formulaire de connexion ne clignote",
    !texte.includes("Mot de passe")
  );

  console.log("\nDéconnexion");

  await nav.evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => /déconnecter/i.test(x.textContent));
      if (!b) return 0;
      b.click();
      return 1;
    })()`);
  await nav.attendre("mot de passe", 15_000);
  texte = await nav.texte();

  verifier("la déconnexion ramène à l'écran de connexion", texte.includes("Mot de passe"));

  const restantes = await requete<{ n: string }>(`SELECT count(*)::text AS n FROM sessions`);
  verifier(
    "la session est SUPPRIMÉE en base, pas seulement oubliée",
    Number(restantes[0]?.n) === 0,
    `${restantes[0]?.n} session(s) restante(s)`
  );

  await nav.aller(`${ORIGINE}/admin`);
  await nav.attendre("mot de passe", 15_000);
  texte = await nav.texte();
  verifier(
    "un rechargement ne rouvre pas le panel",
    !texte.includes("Diagnostic"),
    "le cookie donne encore accès"
  );

  const trace = await requete<{ action: string }>(
    `SELECT action FROM journal ORDER BY date`
  );
  const actions = trace.map((t) => t.action);
  verifier(
    "le journal du serveur retrace la séance",
    actions.includes("connexion-refusee") &&
      actions.includes("connexion") &&
      actions.includes("deconnexion"),
    actions.join(", ")
  );

  /* ==================================================================== */

  nav.fermer();
  await arreterTout(api, pool, bd);
  rmSync(resolve(process.cwd(), ".chrome-panel"), { recursive: true, force: true });

  console.log(`\n═══ ${reussis} vérification(s) réussie(s), ${echecs.length} échec(s) ═══\n`);
  if (echecs.length) {
    echecs.forEach((e) => console.log(`  ✗ ${e}`));
    console.log("");
    process.exit(1);
  }
  process.exit(0);
};

principal().catch(async (e) => {
  console.error("\n✖ La recette du panel s'est interrompue :", e);
  await arreterTout();
  process.exit(1);
});
