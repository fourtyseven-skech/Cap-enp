import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FORMATS, nombreEtapes, type Diapositive, type Document, type Element } from "@/blog/deck/modele";
import { RenduDiapositive, STYLES_RENDU } from "@/blog/deck/Rendu";
import { Graphique } from "@/blog/deck/graphique";
import { brouillonVide, slugDepuisTitre, type Brouillon } from "../brouillon";

/**
 * ---------------------------------------------------------------------------
 * SORTIES D'UNE PRÉSENTATION
 * ---------------------------------------------------------------------------
 *
 * Deux destinations, qui ne servent pas le même public.
 *
 *  1. LE FICHIER AUTONOME — l'idée centrale de `nyblnet/bento` : « deck,
 *     polices, images et lecteur voyagent ensemble ». Un seul .html, ouvrable
 *     hors ligne, sans installation ni compte. C'est ce qu'on envoie à un
 *     client avant un rendez-vous, ce qu'on met sur une clé pour une salle sans
 *     réseau.
 *
 *  2. L'ARTICLE — ce que bento ne fait pas, et qui compte le plus ici. Une
 *     présentation n'est pas indexable : des blocs positionnés en absolu ne
 *     forment aucune structure de texte exploitable par un moteur. La convertir
 *     en Markdown la fait entrer dans le circuit du blog, avec son
 *     référencement, son sommaire et ses données structurées.
 */

/* =========================================================================
 * 1. FICHIER AUTONOME
 * ======================================================================= */

/**
 * Rassemble les feuilles de style de la page courante.
 *
 * Deux formes selon le contexte, et il faut les deux : en développement, Vite
 * injecte le style dans des balises `<style>` ; en production, c'est un `<link>`
 * vers un fichier haché. Ne traiter qu'un cas donnait un export parfait sur le
 * poste du développeur et entièrement dénudé en ligne — l'écart qu'on ne
 * découvre qu'en le montrant à un client.
 */
const collecterStyles = async (doc: globalThis.Document): Promise<string> => {
  const morceaux: string[] = [];
  for (const n of Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]'))) {
    if (n.tagName === "STYLE") {
      morceaux.push(n.textContent ?? "");
      continue;
    }
    const href = (n as HTMLLinkElement).href;
    if (!href) continue;
    try {
      const r = await fetch(href);
      if (r.ok) morceaux.push(await r.text());
    } catch {
      /* feuille inaccessible — l'export sera moins fidèle, mais restera lisible */
    }
  }
  return morceaux.join("\n");
};

const enDataURI = (blob: Blob): Promise<string> =>
  new Promise((ok, ko) => {
    const l = new FileReader();
    l.onload = () => ok(String(l.result));
    l.onerror = () => ko(l.error);
    l.readAsDataURL(blob);
  });

/**
 * Remplace chaque `url(...)` du CSS par le fichier lui-même, encodé.
 *
 * Sans cela, le fichier exporté retomberait sur une police système dès qu'il
 * quitte le site : les `@font-face` pointent vers `/fonts/…`, adresse qui
 * n'existe plus une fois le fichier sur une clé. C'est exactement ce que bento
 * appelle « les polices voyagent avec le document ».
 */
const incorporerCss = async (css: string, base: string): Promise<string> => {
  const adresses = new Set<string>();
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const u = m[1].trim();
    if (u.startsWith("data:") || u.startsWith("#")) continue;
    adresses.add(u);
  }

  let sortie = css;
  for (const adresse of adresses) {
    try {
      const absolue = new URL(adresse, base);
      // Même origine seulement : une ressource tierce échouerait sur la
      // politique d'origine, et l'attendre pour rien ralentirait chaque export.
      if (absolue.origin !== new URL(base).origin) continue;
      const r = await fetch(absolue.href);
      if (!r.ok) continue;
      sortie = sortie.split(adresse).join(await enDataURI(await r.blob()));
    } catch {
      /* ressource absente — la règle restera sans effet, sans casser le reste */
    }
  }
  return sortie;
};

/** Incorpore les images du document, pour la même raison que les polices. */
const incorporerImages = async (doc: Document, base: string): Promise<Document> => {
  const cache = new Map<string, string>();

  const resoudre = async (src?: string) => {
    if (!src || src.startsWith("data:")) return src;
    if (cache.has(src)) return cache.get(src);
    try {
      const absolue = new URL(src, base);
      if (absolue.origin !== new URL(base).origin) return src;
      const r = await fetch(absolue.href);
      if (!r.ok) return src;
      const data = await enDataURI(await r.blob());
      cache.set(src, data);
      return data;
    } catch {
      return src;
    }
  };

  const diapositives = await Promise.all(
    doc.diapositives.map(async (d) => ({
      ...d,
      fond: { ...d.fond, image: await resoudre(d.fond.image) },
      elements: await Promise.all(
        d.elements.map(async (e) =>
          e.type === "image" ? { ...e, src: (await resoudre(e.src)) ?? "" } : e
        )
      ),
    }))
  );

  return { ...doc, diapositives };
};

/**
 * Le lecteur embarqué.
 *
 * Volontairement en JavaScript nu, sans React ni bibliothèque : le fichier doit
 * s'ouvrir sur le poste d'un client qu'on ne connaît pas, éventuellement ancien
 * et sans réseau. Embarquer un environnement d'exécution complet pour piloter
 * un compteur d'index reviendrait à payer cent cinquante kilooctets pour trente
 * lignes de logique.
 *
 * Il reproduit les gestes du présentateur du site — mêmes touches, mêmes
 * apparitions, même morphing FLIP — pour que personne n'ait à réapprendre
 * l'outil selon l'endroit où il regarde.
 */
const lecteur = (largeur: number, hauteur: number) => `
(function () {
  var scenes = [].slice.call(document.querySelectorAll('.ms-diapo'));
  var etapesMax = JSON.parse(document.getElementById('ms-etapes').textContent);
  var i = 0, etape = 0, positions = {};
  var barre = document.getElementById('ms-barre'), compteur = document.getElementById('ms-compteur');
  var reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mesurer() {
    positions = {};
    var n = scenes[i].querySelectorAll('[data-morph]');
    for (var k = 0; k < n.length; k++) positions[n[k].getAttribute('data-morph')] = n[k].getBoundingClientRect();
  }

  /* Rejoue le trajet à l'envers : l'élément est déjà à sa place définitive,
     seule sa peinture est ramenée en arrière puis relâchée. */
  function morpher() {
    if (reduit) return;
    var n = scenes[i].querySelectorAll('[data-morph]');
    for (var k = 0; k < n.length; k++) {
      var el = n[k], avant = positions[el.getAttribute('data-morph')];
      if (!avant || !el.animate) continue;
      var apres = el.getBoundingClientRect();
      var dx = avant.left - apres.left, dy = avant.top - apres.top;
      var sx = apres.width > 1 ? avant.width / apres.width : 1;
      var sy = apres.height > 1 ? avant.height / apres.height : 1;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
      el.animate(
        [{ transformOrigin: 'top left', transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' },
         { transformOrigin: 'top left', transform: 'none' }],
        { duration: 520, easing: 'cubic-bezier(0.22,1,0.36,1)' }
      );
    }
  }

  function peindre() {
    for (var n = 0; n < scenes.length; n++) scenes[n].hidden = n !== i;
    var app = scenes[i].querySelectorAll('.ms-appar');
    for (var a = 0; a < app.length; a++) {
      var e = parseInt(app[a].getAttribute('data-etape') || '0', 10);
      app[a].setAttribute('data-vu', e <= etape ? '1' : '0');
    }
    if (barre) barre.style.width = ((i + 1) / scenes.length * 100) + '%';
    if (compteur) compteur.textContent = (i + 1) + ' / ' + scenes.length;
    history.replaceState(null, '', '#diapo-' + (i + 1));
  }

  function aller(n, tout) {
    if (n < 0 || n >= scenes.length) return;
    mesurer();
    i = n;
    etape = tout ? etapesMax[i] : 0;
    peindre();
    morpher();
  }
  function suivant() { if (etape < etapesMax[i]) { etape++; peindre(); } else aller(i + 1, false); }
  function precedent() { if (etape > 0) { etape--; peindre(); } else aller(i - 1, true); }

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); suivant(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); precedent(); }
    else if (k === 'Home') aller(0, false);
    else if (k === 'End') aller(scenes.length - 1, true);
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
    }
  });

  var hote = document.getElementById('ms-scene');
  hote.addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    if ((e.clientX - r.left) / r.width < 0.28) precedent(); else suivant();
  });

  /* Balayage tactile : le geste n'est décidé qu'au relâché, ce qui évite de
     déclencher sur un appui tremblé. */
  var dep = null;
  document.addEventListener('pointerdown', function (e) { dep = { x: e.clientX, y: e.clientY }; });
  document.addEventListener('pointerup', function (e) {
    if (!dep) return;
    var dx = e.clientX - dep.x, dy = e.clientY - dep.y;
    dep = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) suivant(); else precedent();
  });

  function ajuster() {
    var k = Math.min(hote.clientWidth / ${largeur}, hote.clientHeight / ${hauteur});
    document.getElementById('ms-pile').style.transform = 'scale(' + k + ')';
  }
  addEventListener('resize', ajuster);
  ajuster();

  var arrivee = parseInt((location.hash || '').replace('#diapo-', ''), 10);
  aller(isNaN(arrivee) ? 0 : arrivee - 1, false);
})();
`;

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Produit le fichier autonome complet.
 *
 * Asynchrone parce qu'il télécharge les feuilles de style, les polices et les
 * images pour les incorporer : c'est ce téléchargement qui rend le résultat
 * réellement autonome, et il ne peut pas être instantané.
 */
export const fichierAutonome = async (
  doc: Document,
  hote: globalThis.Document = document
): Promise<string> => {
  const base = hote.location.href;
  const complet = await incorporerImages(doc, base);
  const { largeur, hauteur } = FORMATS[complet.format];

  let css = "";
  try {
    css = await incorporerCss(await collecterStyles(hote), base);
  } catch {
    /* l'export doit aboutir même si une ressource manque */
  }

  const visibles = complet.diapositives.filter((d) => !d.masque);

  const scenes = visibles
    .map((d, n) => {
      const html = renderToStaticMarkup(
        createElement(RenduDiapositive, {
          d,
          doc: complet,
          // Tout est rendu dévoilé puis re-masqué par le lecteur : le HTML reste
          // complet même si le JavaScript ne s'exécute pas, et le fichier se lit
          // encore — en une seule page, mais il se lit.
          etape: Infinity,
          graphique: Graphique,
        })
      );
      return `<div class="ms-diapo"${n === 0 ? "" : " hidden"}>${html}</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(complet.titre)}</title>
<meta name="robots" content="noindex">
<style>
${css}
${STYLES_RENDU}
html,body { margin:0; height:100%; background:#0B1120; overflow:hidden; }
#ms-scene { position:fixed; inset:0 0 42px 0; display:flex; align-items:center; justify-content:center; }
#ms-pile { position:relative; width:${largeur}px; height:${hauteur}px; flex:none; }
.ms-diapo { position:absolute; inset:0; overflow:hidden; }
.ms-diapo[hidden] { display:none; }
#ms-pied { position:fixed; left:0; right:0; bottom:0; height:42px; display:flex; align-items:center; gap:14px;
           padding:0 16px; border-top:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4);
           font:700 12px/1 'Inter Tight',system-ui,sans-serif; }
#ms-rail { flex:1; height:3px; border-radius:99px; background:rgba(255,255,255,0.1); overflow:hidden; }
#ms-barre { height:100%; width:0; border-radius:99px; background:#3B82F6; transition:width 300ms ease-out; }
</style>
</head>
<body>
<div id="ms-scene"><div id="ms-pile">
${scenes}
</div></div>
<div id="ms-pied">
  <span>${echapper(complet.titre)}</span>
  <span id="ms-rail"><span id="ms-barre"></span></span>
  <span id="ms-compteur">1 / ${visibles.length}</span>
</div>
<script type="application/json" id="ms-etapes">${JSON.stringify(visibles.map(nombreEtapes))}</script>
<script>${lecteur(largeur, hauteur)}</script>
</body>
</html>
`;
};

/* =========================================================================
 * 2. ARTICLE MARKDOWN
 * ======================================================================= */

const nu = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

const cellule = (s: string) => nu(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

/**
 * Traduit une diapositive en Markdown.
 *
 * L'ORDRE DE LECTURE est reconstruit par la géométrie : de haut en bas, puis de
 * gauche à droite. Une présentation n'a pas d'ordre intrinsèque — les éléments
 * sont posés librement — alors qu'un article en exige un. C'est la géométrie
 * qui porte cette information, et c'est la seule source disponible.
 *
 * LE PLUS GROS TEXTE DEVIENT LE TITRE. Là encore, c'est la seule structure
 * disponible : rien ne dit « ceci est un titre » dans le modèle. La taille de
 * police le dit, et elle le dit fidèlement — c'est ainsi qu'un lecteur humain
 * le comprend aussi.
 */
const diapoEnMarkdown = (d: Diapositive, images: { ignorees: number }): string => {
  const ordre = [...d.elements]
    .filter((e) => !e.masque)
    .sort((a, b) => (Math.abs(a.y - b.y) > 24 ? a.y - b.y : a.x - b.x));

  /**
   * MOBILIER DE DIAPOSITIVE — à ne pas confondre avec du texte rédactionnel.
   *
   * Deux familles, écartées pour deux raisons distinctes :
   *
   *   · Les FILIGRANES (opacité très basse). Le grand « 01 » au fond d'un
   *     séparateur de partie fait 260 unités : sans ce filtre, il serait le
   *     plus gros texte de la diapositive et l'article se serait ouvert sur un
   *     chapitre nommé « 01 ».
   *
   *   · Les ÉTIQUETTES DE SECTION (petites capitales espacées). Elles répètent
   *     le nom de la partie en haut de chaque diapositive — utile à l'écran,
   *     où l'on arrive sans contexte, redondant dans un article où le `##` de
   *     la section est trois lignes plus haut. Pire : tant qu'elles comptaient
   *     comme « petit texte », le paragraphe d'à côté paraissait grand par
   *     comparaison, et chaque paragraphe devenait un intertitre.
   */
  const mobilier = (t: Extract<Element, { type: "texte" }>) =>
    (t.opacite ?? 1) < 0.35 || (!!t.majuscules && t.taille < 20);

  const candidats = ordre
    .filter((e): e is Extract<Element, { type: "texte" }> => e.type === "texte")
    .filter((t) => !mobilier(t) && nu(t.html).length > 0)
    .sort((a, b) => b.taille - a.taille);

  const tailleMax = candidats[0]?.taille ?? 0;
  const second = candidats[1]?.taille ?? 0;

  /**
   * Une diapositive n'a un titre que si quelque chose l'en distingue. Deux
   * signaux, et il en faut au moins un :
   *   · une taille d'affichage franche (44+), qui ne s'emploie pas pour du
   *     corps de texte ;
   *   · un net écart avec le texte suivant, qui trahit une hiérarchie.
   *
   * Sans cette double condition, un paragraphe seul sur sa diapositive — cas le
   * plus fréquent — devenait un intertitre, et l'article se retrouvait
   * découpé en dizaines de sections qui n'étaient que des phrases.
   */
  const idTitre =
    tailleMax >= 44 || (candidats.length >= 2 && second > 0 && tailleMax >= second * 1.25)
      ? candidats[0]?.id
      : undefined;

  const morceaux: string[] = [];

  for (const e of ordre) {
    if (e.type === "texte") {
      const contenu = nu(e.html);
      if (!contenu) continue;

      if (e.id === idTitre) {
        morceaux.push(`${tailleMax >= 52 ? "##" : "###"} ${contenu.replace(/\n/g, " ")}`);
        continue;
      }
      if (mobilier(e)) continue;
      // Un point de liste reste un point de liste dans l'article : c'est
      // précisément ce que la propriété `puce` permet de savoir.
      morceaux.push(e.puce ? `- ${contenu.replace(/\n/g, " ")}` : contenu);
      continue;
    }

    if (e.type === "tableau") {
      const [entete, ...corps] = e.lignes;
      if (!entete) continue;
      const c = (x: { html: string }) => cellule(x.html);
      morceaux.push(
        [
          `| ${entete.map(c).join(" | ")} |`,
          `| ${entete.map(() => "---").join(" | ")} |`,
          ...corps.map((l) => `| ${l.map(c).join(" | ")} |`),
        ].join("\n")
      );
      continue;
    }

    if (e.type === "graphique") {
      // Un graphique est un dessin : invisible pour un moteur de recherche,
      // muet pour un lecteur d'écran. Il part donc en TABLEAU — les mêmes
      // chiffres, mais indexables et énonçables. C'est le point où l'article et
      // la présentation divergent volontairement.
      if (!e.serie.length) continue;
      morceaux.push(
        [
          "| Libellé | Valeur |",
          "| --- | --- |",
          ...e.serie.map((p) => `| ${cellule(p.etiquette)} | ${p.valeur} |`),
        ].join("\n")
      );
      if (e.legende) morceaux.push(`*${nu(e.legende)}*`);
      continue;
    }

    if (e.type === "image") {
      // Une image incorporée en `data:` pèse souvent plusieurs centaines de
      // kilooctets. L'écrire dans un fichier Markdown versionné rendrait le
      // dépôt inutilisable. On garde la description, qui porte le sens, et on
      // signale le nombre d'images laissées de côté.
      if (e.src.startsWith("data:")) {
        images.ignorees += 1;
        if (e.alt) morceaux.push(`*${e.alt}*`);
        continue;
      }
      if (e.src) morceaux.push(`![${e.alt}](${e.src})`);
    }
  }

  return morceaux.join("\n\n");
};

export type ResultatArticle = { brouillon: Brouillon; imagesIgnorees: number };

/**
 * Convertit une présentation en brouillon d'article.
 *
 * Sens unique, comme la conversion des blocs du constructeur : le Markdown
 * produit est un texte ordinaire, qui se relit et se corrige à la main, et qui
 * survivrait à l'éditeur de présentations s'il disparaissait. Rouvrir l'article
 * ne reconstituera pas les diapositives — c'est assumé, le texte est ce qui
 * compte.
 */
export const versArticle = (doc: Document): ResultatArticle => {
  const images = { ignorees: 0 };
  const [premiere, ...suite] = doc.diapositives.filter((d) => !d.masque);

  // La première diapositive fournit les métadonnées : son plus gros texte est
  // le titre, le suivant le chapeau. C'est la convention d'une diapositive
  // d'ouverture, et elle se vérifie sur toutes celles que produisent les
  // gabarits comme la conversion d'articles.
  const textesUn = (premiere?.elements ?? [])
    .filter((e): e is Extract<Element, { type: "texte" }> => e.type === "texte" && !e.masque)
    .sort((a, b) => b.taille - a.taille);

  const titre = nu(textesUn[0]?.html ?? "") || doc.titre;
  const chapeau = nu(textesUn[1]?.html ?? "");

  const corps = suite
    .map((d) => diapoEnMarkdown(d, images))
    .filter((m) => m.trim())
    .join("\n\n")
    .trim();

  return {
    brouillon: {
      ...brouillonVide(),
      titre,
      slug: doc.meta.slug || slugDepuisTitre(titre),
      chapeau,
      categorie: doc.meta.categorie ?? "",
      auteur: doc.meta.auteur,
      corps,
    },
    imagesIgnorees: images.ignorees,
  };
};

/** Déclenche le téléchargement d'un contenu sous un nom donné. */
export const telecharger = (contenu: string, nom: string, type = "text/html;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  // Libéré au tour suivant : révoquer immédiatement annulerait le
  // téléchargement sur les navigateurs qui lisent l'objet après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
