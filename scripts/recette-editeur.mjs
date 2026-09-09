import { spawn, execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ---------------------------------------------------------------------------
 * RECETTE DE L'ÉDITEUR DE PAGE D'ACCUEIL, EN MODE LOCAL
 * ---------------------------------------------------------------------------
 *
 *     npm run recette-editeur
 *
 * Démarre le serveur de développement, ouvre le panel dans un navigateur, et
 * fait ce que ferait quelqu'un : choisir une section, changer un texte,
 * enregistrer, puis regarder si la page a suivi.
 *
 * POURQUOI EN MODE LOCAL
 * ----------------------
 * C'est le mode qui n'a besoin de rien — ni base, ni API. C'est aussi celui que
 * vous montrerez au client avant d'avoir le moindre accès, et celui qui vous
 * sert à travailler. Le mode serveur, lui, est exercé par
 * `serveur/npm run recette-panel`.
 *
 * PRUDENCE
 * --------
 * Le test MODIFIE un vrai fichier du dépôt : c'est justement ce qu'on veut
 * vérifier. Il en fait donc une copie avant, et la restaure quoi qu'il arrive —
 * y compris si le script échoue en cours de route.
 */

const PORT = 8097;
const PORT_CDP = 9335;
const ORIGINE = `http://localhost:${PORT}`;
const SECTION = "mega-erp";
const FICHIER = resolve("content/accueil", `${SECTION}.json`);
const COPIE = resolve("content/accueil", `.${SECTION}.recette`);

const CHROME =
  process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : "google-chrome";

let reussis = 0;
const echecs = [];

const verifier = (libelle, ok, detail) => {
  if (ok) {
    reussis += 1;
    console.log(`  ✓ ${libelle}`);
  } else {
    echecs.push(libelle + (detail ? ` — ${detail}` : ""));
    console.log(`  ✗ ${libelle}${detail ? ` — ${detail}` : ""}`);
  }
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tue un processus ET ses enfants : `npm` lance `node`, qui lance Vite. */
const arreterArbre = (p) => {
  if (!p?.pid) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-p.pid, "SIGKILL");
    }
  } catch {
    /* déjà mort */
  }
};

let vite = null;
let chrome = null;

const nettoyer = () => {
  arreterArbre(chrome);
  arreterArbre(vite);
  try {
    copyFileSync(COPIE, FICHIER);
    unlinkSync(COPIE);
    console.log(`\n  · ${SECTION}.json restauré`);
  } catch {
    /* la copie n'a pas été faite */
  }
  rmSync(resolve(".chrome-editeur"), { recursive: true, force: true });
};

/* ========================================================================= */

const principal = async () => {
  console.log("\n═══ RECETTE DE L'ÉDITEUR DE PAGE D'ACCUEIL ═══\n");

  copyFileSync(FICHIER, COPIE);
  const avant = JSON.parse(readFileSync(FICHIER, "utf8"));
  console.log(`  · copie de ${SECTION}.json faite`);

  /* Le port doit être libre : sinon on interrogerait le serveur de quelqu'un
     d'autre et la recette partirait sur une base fausse. */
  try {
    await fetch(`${ORIGINE}/`, { signal: AbortSignal.timeout(1500) });
    throw new Error(`Le port ${PORT} est déjà occupé.`);
  } catch (e) {
    if (e.message.includes("déjà occupé")) throw e;
  }

  vite = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    /*
     * `--mode editeur` impose `.env.editeur` : la recette vérifie le mode
     * LOCAL (écriture dans les fichiers) et ne doit pas dépendre du `.env` du
     * poste. Sans ce mode, un `.env` désignant une API faisait tomber la
     * recette sur un écran de connexion — un échec dû à la configuration de la
     * machine, pas au code.
     */
    ["run", "dev", "--", "--mode", "editeur", "--port", String(PORT), "--strictPort"],
    { stdio: "pipe", shell: process.platform === "win32", detached: process.platform !== "win32" }
  );

  const debut = Date.now();
  for (;;) {
    try {
      if ((await fetch(`${ORIGINE}/`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {
      /* pas encore prêt */
    }
    if (Date.now() - debut > 90_000) throw new Error("Vite n'a pas démarré en 90 s.");
    await dormir(700);
  }
  console.log(`  · serveur de développement sur ${ORIGINE}`);

  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT_CDP}`,
      `--user-data-dir=${resolve(".chrome-editeur")}`,
      "--no-first-run",
      "--window-size=1600,1000",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  await dormir(4000);

  /* ---------------------------------------------------- pilotage */

  const cibles = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json();
  const page = cibles.find((c) => c.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const attente = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attente.has(m.id)) {
      attente.get(m.id)(m.result);
      attente.delete(m.id);
    }
  });
  await new Promise((r) => ws.addEventListener("open", r));

  const envoyer = (methode, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      attente.set(n, r);
      ws.send(JSON.stringify({ id: n, method: methode, params }));
    });

  await envoyer("Page.enable");
  await envoyer("Runtime.enable");

  const evaluer = async (ex) => {
    const r = await envoyer("Runtime.evaluate", {
      expression: ex,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "erreur");
    return r.result?.value;
  };

  const texte = () => evaluer("document.body.innerText");

  const attendre = async (motif, msMax = 25_000) => {
    const t0 = Date.now();
    for (;;) {
      if ((await texte()).toLowerCase().includes(motif.toLowerCase())) return true;
      if (Date.now() - t0 > msMax) return false;
      await dormir(300);
    }
  };

  /* ---------------------------------------------------- déroulé */

  await envoyer("Page.navigate", { url: `${ORIGINE}/admin` });
  await attendre("administration", 40_000);

  // Mode atelier : n'importe quel identifiant, mot de passe d'au moins 4 signes.
  await evaluer(`
    (() => {
      const [e, m] = document.querySelectorAll('input');
      const poser = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      poser(e, 'test@megasoft-office.com'); poser(m, 'test1234');
      document.querySelector('form').requestSubmit();
      return 1;
    })()`);
  await attendre("diagnostic", 20_000);

  const ouvert = await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === "Page d'accueil");
      if (!b) return 0;
      b.click();
      return 1;
    })()`);
  verifier("l'onglet « Page d'accueil » existe", ouvert === 1);
  await attendre("sections", 20_000);

  let vue = await texte();
  verifier(
    "les douze sections sont listées",
    ["Hero", "Chiffres", "Solutions", "Pied de page"].every((s) => vue.includes(s)),
    vue.slice(0, 90).replace(/\n/g, " ")
  );
  /* Insensible à la casse : la pastille est mise en majuscules par la feuille
     de style, et `innerText` le reflète. */
  verifier(
    "le mode d'écriture est annoncé",
    vue.toLowerCase().includes("fichiers"),
    "l'éditeur ne dit pas où il écrit"
  );

  // On ouvre MEGA ERP et on change son badge.
  await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'MEGA ERP');
      b.click(); return 1;
    })()`);
  await dormir(1200);

  vue = await texte();
  verifier(
    "les champs sont déduits du schéma",
    vue.includes("Badge") && vue.includes("Accroche") && vue.includes("Bouton de la visite"),
    vue.slice(0, 120).replace(/\n/g, " ")
  );

  const NOUVEAU = "En images — recette";
  const pose = await evaluer(`
    (() => {
      const champs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
      const badge = champs.find(i => i.value === ${JSON.stringify(avant.badge)});
      if (!badge) return 0;
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(badge, ${JSON.stringify(NOUVEAU)});
      badge.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
  verifier("le champ « Badge » est trouvé et modifié", pose === 1);

  vue = await texte();
  verifier("le panel signale les modifications non enregistrées", vue.includes("non enregistrées"));

  const enregistre = await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Enregistrer');
      if (!b || b.disabled) return 0;
      b.click(); return 1;
    })()`);
  verifier("le bouton « Enregistrer » est actif", enregistre === 1);
  await attendre("enregistré dans le dépôt", 15_000);

  const apres = JSON.parse(readFileSync(FICHIER, "utf8"));
  verifier(
    "le fichier du dépôt a été réécrit",
    apres.badge === NOUVEAU,
    `badge = ${JSON.stringify(apres.badge)}`
  );
  verifier(
    "les autres champs n'ont pas bougé",
    apres.titre === avant.titre && apres.accroche === avant.accroche
  );

  /* La page elle-même doit suivre : c'est tout l'intérêt. */
  await envoyer("Page.navigate", { url: `${ORIGINE}/` });
  const surLaPage = await attendre(NOUVEAU, 25_000);
  verifier("la page d'accueil affiche le nouveau texte", surLaPage);

  /* Le schéma doit refuser une saisie invalide, avant d'écrire le fichier. */
  const refus = await fetch(`${ORIGINE}/__contenu/${SECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...apres, badge: "" }),
  });
  const corpsRefus = await refus.json();
  verifier(
    "une saisie invalide est refusée avant écriture",
    refus.status === 400,
    `reçu ${refus.status}`
  );
  verifier(
    "le refus nomme le champ fautif",
    corpsRefus.champ === "badge",
    JSON.stringify(corpsRefus)
  );
  verifier(
    "le fichier n'a pas été touché par la tentative",
    JSON.parse(readFileSync(FICHIER, "utf8")).badge === NOUVEAU
  );

  /* ---------------------------------------------------- les gabarits */

  /*
   * Les deux modèles de section libre : c'est ce que le client utilisera pour
   * ajouter quelque chose de nouveau. On vérifie qu'ils s'ajoutent, se
   * remplissent, et arrivent sur la page — puis on remet la liste à vide.
   */
  const LIBRES = resolve("content/accueil", "sections-libres.json");
  const COPIE_LIBRES = resolve("content/accueil", ".sections-libres.recette");
  copyFileSync(LIBRES, COPIE_LIBRES);

  await envoyer("Page.navigate", { url: `${ORIGINE}/admin` });
  await attendre("diagnostic", 30_000);
  await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === "Page d'accueil");
      b.click(); return 1;
    })()`);
  await attendre("sections", 20_000);

  await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Sections libres');
      if (!b) return 0;
      b.click(); return 1;
    })()`);
  await dormir(1200);

  vue = await texte();
  verifier(
    "les trois gabarits sont proposés",
    vue.includes("Texte et image") &&
      vue.includes("Trois points forts") &&
      vue.includes("Annonce"),
    vue.slice(0, 140).replace(/\s+/g, " ")
  );
  verifier(
    "l'absence de section libre est annoncée",
    vue.includes("Aucune section ajoutée")
  );

  const ajoute = await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '+ Trois points forts');
      if (!b) return 0;
      b.click(); return 1;
    })()`);
  verifier("un bloc « Trois points forts » s'ajoute", ajoute === 1);
  await dormir(900);

  vue = await texte();
  verifier(
    "les trois points imposés sont créés d'emblée",
    /points\s*3\s*—\s*nombre imposé/i.test(vue.replace(/\s+/g, " ")),
    vue.replace(/\s+/g, " ").match(/POINTS[^+]{0,30}/i)?.[0] ?? "introuvable"
  );
  /* ------------------------------------------------------- choix des icônes

     Le client a signalé que « la liste déroulante d'icônes ne marche pas ».
     Deux défauts distincts se cachaient derrière cette phrase, et les deux
     sont vérifiés ici.

       1. `Flottant` fermait le menu sur TOUT défilement capté au niveau de la
          fenêtre — y compris celui de son propre contenu. La liste des icônes,
          seule assez longue pour défiler, se refermait au moment de s'ouvrir.
       2. Même ouverte, elle n'affichait que des noms de code : « serveur »,
          « puzzle », « cartons ». On choisissait un pictogramme sans le voir.

     Les icônes se présentent désormais en grille dessinée. */

  const icones = await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button[aria-label]')]
        .filter(x => x.querySelector('svg'));
      return b.length;
    })()`);
  verifier(
    "les icônes sont proposées en grille dessinée, pas en noms de code",
    icones >= 15,
    `boutons d'icône trouvés : ${icones}`
  );

  const choix = await evaluer(`
    (() => {
      const cible = document.querySelector('button[aria-label="nuage"]');
      if (!cible) return 'icône « nuage » absente';
      cible.click();
      return 'ok';
    })()`);
  await dormir(500);
  const retenue = await evaluer(`
    (() => {
      const a = document.querySelector('button[aria-pressed="true"][aria-label]');
      return a ? a.getAttribute('aria-label') : 'aucune';
    })()`);
  verifier(
    "cliquer une icône la retient réellement",
    choix === "ok" && retenue === "nuage",
    `${choix} → ${retenue}`
  );

  /* Le menu déroulant ordinaire ne doit plus se fermer sur son propre
     défilement. On ouvre le premier venu et on fait défiler SON contenu : il
     doit rester ouvert. Avant correction, l'écouteur en phase de capture
     recevait cet événement et fermait le menu. */
  await evaluer(`
    (() => {
      const b = document.querySelector('button[aria-haspopup="listbox"]');
      if (b) b.click();
      return 1;
    })()`);
  await dormir(600);
  const avantDefilement = await evaluer(`document.querySelectorAll('[role="listbox"]').length`);
  await evaluer(`
    (() => {
      const m = document.querySelector('[role="listbox"]');
      if (!m) return 0;
      const p = m.closest('.ms-menu') || m.parentElement;
      p.scrollTop += 40;
      p.dispatchEvent(new Event('scroll', { bubbles: true }));
      return 1;
    })()`);
  await dormir(600);
  const apresDefilement = await evaluer(`document.querySelectorAll('[role="listbox"]').length`);
  verifier(
    "un menu ouvert le reste quand c'est lui qui défile",
    avantDefilement >= 1 && apresDefilement >= 1,
    `ouvert avant : ${avantDefilement}, après : ${apresDefilement}`
  );
  // On referme pour ne pas gêner les vérifications suivantes.
  await evaluer(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return 1; })()`);
  await dormir(400);

  verifier(
    "ses champs apparaissent, et seulement les siens",
    /* Insensible à la casse : les libellés de liste sont mis en majuscules par
       la feuille de style, et `innerText` le reflète. */
    vue.toLowerCase().includes("surtitre") &&
      vue.toLowerCase().includes("points") &&
      !vue.toLowerCase().includes("description de l'image"),
    "les champs de l'autre gabarit sont visibles"
  );

  // Trois points sont exigés par le schéma : le bloc vierge n'en a aucun, donc
  // l'enregistrement doit être refusé. C'est le garde-fou qu'on veut voir.
  await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Enregistrer');
      if (b && !b.disabled) b.click();
      return 1;
    })()`);
  await dormir(1500);
  vue = await texte();
  /* Les trois points existent mais sont vides : le schéma refuse, et le
     message doit nommer ce qui manque. */
  verifier(
    "un gabarit incomplet est refusé, avec une phrase claire",
    /ne peut pas être vide|exactement trois points/i.test(vue),
    vue.slice(0, 200).replace(/\s+/g, " ")
  );

  /* --------------------------------- le gabarit « Annonce », et son fichier

     Le cas demandé par le client : annoncer un prix remporté, avec l'image ou
     la vidéo de l'événement. C'est le seul gabarit qui accepte les deux.

     Ce qu'on vérifie ici n'est pas le gabarit lui-même — le schéma s'en charge
     — mais que son champ de fichier s'affiche comme un SÉLECTEUR et non comme
     une zone où taper un chemin. C'était la demande : « au lieu de mettre des
     chemins, que le client voie l'image ». */
  const ajouteAnnonce = await evaluer(`
    (() => {
      const b = [...document.querySelectorAll('button')]
        .find(x => x.textContent.trim().startsWith('+ Annonce'));
      if (!b) return 0;
      b.click(); return 1;
    })()`);
  verifier("le gabarit « Annonce » s'ajoute", ajouteAnnonce === 1);
  await dormir(900);

  const selecteur = await evaluer(`
    (() => {
      const envoi = [...document.querySelectorAll('button')]
        .find(x => /Envoyer une image ou une vid/i.test(x.textContent));
      const fichier = document.querySelector('input[type="file"][accept*="video/mp4"]');
      return (envoi ? 1 : 0) + (fichier ? 2 : 0);
    })()`);
  verifier(
    "son champ de fichier est un sélecteur, pas une zone de saisie",
    selecteur === 3,
    `bouton d'envoi : ${selecteur & 1 ? "oui" : "non"}, ` +
      `champ acceptant la vidéo : ${selecteur & 2 ? "oui" : "non"}`
  );

  copyFileSync(COPIE_LIBRES, LIBRES);
  unlinkSync(COPIE_LIBRES);

  /* Une section inconnue ne doit rien créer. */
  const inventee = await fetch(`${ORIGINE}/__contenu/section-inventee`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ a: 1 }),
  });
  verifier("une section inconnue est refusée", inventee.status === 404, `reçu ${inventee.status}`);

  /* ------------------------------------------------- l'envoi d'une image */

  /*
   * La vignette d'article : le point de la demande.
   *
   * On envoie une vraie image par la route du serveur de développement, on
   * vérifie qu'elle est convertie, écrite dans `content/medias/`, puis servie
   * sous `/medias/…` — l'adresse qu'elle aura une fois le site construit.
   */
  console.log("\n  — Envoi d'une image —");

  const sharp = (await import("sharp")).default;
  const largeur = 2400;
  const hauteur = 1600;
  const pixels = Buffer.alloc(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = (y * largeur + x) * 3;
      pixels[i] = Math.round(128 + 120 * Math.sin(x / 90) * Math.cos(y / 130));
      pixels[i + 1] = Math.round(120 + 110 * Math.sin((x + y) / 160));
      pixels[i + 2] = Math.round(140 + 100 * Math.cos(y / 70));
    }
  }
  const png = await sharp(pixels, { raw: { width: largeur, height: hauteur, channels: 3 } })
    .png()
    .toBuffer();

  const envoi = await fetch(`${ORIGINE}/__medias`, { method: "POST", body: png });
  const image = await envoi.json();

  verifier("l'image est acceptée", envoi.status === 201, `reçu ${envoi.status}`);
  verifier(
    "elle est convertie et réduite à 2 000 px",
    image.largeur === 2000 && image.hauteur === 1333,
    `${image.largeur}x${image.hauteur}`
  );
  verifier(
    "elle est nettement allégée",
    image.taille < png.length / 2,
    `${Math.round(png.length / 1024)} Ko vers ${Math.round(image.taille / 1024)} Ko`
  );
  verifier(
    "son adresse est celle qu'elle aura sur le site",
    image.url === `/medias/${image.id}.webp`,
    String(image.url)
  );

  const surDisque = resolve("content/medias", `${image.id}.webp`);
  verifier("le fichier est écrit dans le dépôt", existsSync(surDisque));

  const servie = await fetch(`${ORIGINE}${image.url}`);
  const octets = Buffer.from(await servie.arrayBuffer());
  verifier(
    "elle est servie sous /medias/ dès le développement",
    servie.status === 200 && octets.subarray(8, 12).toString("ascii") === "WEBP",
    `reçu ${servie.status}`
  );

  const refusImage = await fetch(`${ORIGINE}/__medias`, {
    method: "POST",
    body: Buffer.from("ceci n'est pas une image"),
  });
  verifier("un fichier qui n'est pas une image est refusé", refusImage.status === 400);

  /* La vignette devient celle de l'article : on l'écrit et on regarde la page. */
  const ARTICLE = resolve("content/blog", "couts-de-revient-faux.md");
  const COPIE_ARTICLE = resolve("content/blog", ".couts-de-revient-faux.recette");
  copyFileSync(ARTICLE, COPIE_ARTICLE);

  const markdown = readFileSync(ARTICLE, "utf8");
  writeFileSync(
    ARTICLE,
    markdown.replace(/^statut:/m, `image: "${image.url}"\nstatut:`),
    "utf8"
  );
  await dormir(1500);

  const pageBlog = await (await fetch(`${ORIGINE}/blog/couts-de-revient-faux/`)).text();
  verifier(
    "l'article accepte la vignette dans son en-tête",
    readFileSync(ARTICLE, "utf8").includes(image.url),
    "le fichier n'a pas été écrit"
  );
  verifier(
    "la page de l'article n'est pas cassée par le nouveau champ",
    pageBlog.length > 1000,
    `${pageBlog.length} octets`
  );

  copyFileSync(COPIE_ARTICLE, ARTICLE);
  unlinkSync(COPIE_ARTICLE);
  unlinkSync(surDisque);

  /* ------------------------------------------ l'envoi d'une vidéo, et son poids

     Le client veut pouvoir remplacer les vidéos du Hero depuis le panel. Sans
     `ffmpeg` sur l'hébergement, aucune conversion n'est possible : le poids
     envoyé est le poids que téléchargera un visiteur. D'où les seuils de
     `src/contenu/poids.ts`, vérifiés ici de bout en bout.

     La vidéo est FACTICE : elle porte la signature `ftyp` qu'un lecteur de
     fichiers reconnaît, sans être lisible. C'est exactement ce que cette
     recette contrôle — le routage, le rangement et les seuils — et non la
     lecture, qui relève du navigateur. */
  console.log("\n  — Envoi d'une vidéo —");

  /** Une pseudo-vidéo MP4 de la taille demandée. */
  const videoDe = (octets) => {
    const b = Buffer.alloc(octets);
    b.write("ftyp", 4, "ascii");
    return b;
  };

  const petite = videoDe(200 * 1024);
  const envoiVideo = await fetch(`${ORIGINE}/__medias`, { method: "POST", body: petite });
  const video = await envoiVideo.json();

  verifier("une vidéo est acceptée", envoiVideo.status === 201, `reçu ${envoiVideo.status}`);
  verifier(
    "son adresse porte son extension, sans sous-dossier",
    video.url === `/medias/${video.id}.mp4`,
    String(video.url)
  );
  verifier(
    "le fichier est écrit dans le dépôt",
    existsSync(resolve("content/medias", `${video.id}.mp4`))
  );

  const videoServie = await fetch(`${ORIGINE}${video.url}`);
  verifier(
    "elle est servie sous /medias/ avec le bon type",
    videoServie.status === 200 &&
      videoServie.headers.get("content-type") === "video/mp4",
    `${videoServie.status} · ${videoServie.headers.get("content-type")}`
  );
  await videoServie.arrayBuffer();

  /* Au-delà du seuil rouge — 10 Mo — l'envoi doit ÉCHOUER tant que la case
     n'est pas cochée. C'est la vérification qui discrimine : sans elle, un
     seuil pourrait être affiché sans être appliqué. */
  const lourde = videoDe(11 * 1024 * 1024);
  const refusPoids = await fetch(`${ORIGINE}/__medias`, { method: "POST", body: lourde });
  const messagePoids = await refusPoids.json();
  verifier(
    "une vidéo de 11 Mo est refusée sans acceptation explicite",
    refusPoids.status === 413,
    `reçu ${refusPoids.status}`
  );
  verifier(
    "le refus nomme la taille réelle du fichier",
    /11[.,]0 Mo/.test(messagePoids.message ?? ""),
    String(messagePoids.message).slice(0, 120)
  );

  const acceptee = await fetch(`${ORIGINE}/__medias`, {
    method: "POST",
    headers: { "X-Poids-Assume": "Je comprends que cette vidéo de 11,0 Mo ralentira le site." },
    body: lourde,
  });
  const videoLourde = await acceptee.json();
  verifier(
    "la même vidéo passe une fois la responsabilité prise",
    acceptee.status === 201,
    `reçu ${acceptee.status}`
  );

  /* La suppression, qui doit vraiment retirer le fichier — c'est le geste
     irréversible annoncé au client. */
  const suppression = await fetch(`${ORIGINE}/__medias/${videoLourde.id}`, { method: "DELETE" });
  verifier(
    "la suppression retire réellement le fichier du dépôt",
    suppression.status === 200 &&
      !existsSync(resolve("content/medias", `${videoLourde.id}.mp4`)),
    `reçu ${suppression.status}`
  );

  unlinkSync(resolve("content/medias", `${video.id}.mp4`));

  ws.close();
};

principal()
  .then(() => {
    nettoyer();
    console.log(`\n═══ ${reussis} vérification(s) réussie(s), ${echecs.length} échec(s) ═══\n`);
    if (echecs.length) {
      echecs.forEach((e) => console.log(`  ✗ ${e}`));
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n✖ La recette de l'éditeur s'est interrompue :", e);
    nettoyer();
    process.exit(1);
  });
