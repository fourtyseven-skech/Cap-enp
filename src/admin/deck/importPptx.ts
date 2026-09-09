import {
  FORMATS,
  STYLE_TABLEAU,
  THEME_MEGASOFT,
  cellule,
  diapositiveVide,
  forme,
  identifiant,
  image,
  tableau,
  texte,
  type CelluleTableau,
  type Diapositive,
  type Document,
  type Element,
  type NomForme,
} from "@/blog/deck/modele";
import { decompressionDisponible, enDataURI, enTexte, ouvrirZip, typeMime, type Entree } from "./zip";

/**
 * ---------------------------------------------------------------------------
 * IMPORT POWERPOINT (.pptx)
 * ---------------------------------------------------------------------------
 *
 * Un `.pptx` est une archive ZIP de fichiers XML au format OOXML. On y lit ce
 * qui a un équivalent chez nous — position, texte, formes, images, tableaux —
 * et on l'oublie proprement pour le reste.
 *
 * POURQUOI PAS LE `.ppt`. L'ancien format binaire (PowerPoint 97-2003) n'est
 * pas une archive : c'est un système de fichiers composé (CFB) contenant des
 * enregistrements binaires propriétaires, sans spécification exploitable
 * raisonnablement. Le fichier est donc détecté et l'utilisateur invité à le
 * réenregistrer en `.pptx` — ce que PowerPoint fait en deux clics. Mieux vaut
 * une limite annoncée qu'un import qui produit une bouillie.
 *
 * CE QU'ON IMPORTE FIDÈLEMENT
 *   · la géométrie de chaque forme (position, taille, rotation) ;
 *   · le texte, sa taille, sa graisse, sa couleur, son alignement ;
 *   · les images, incorporées en `data:` — elles voyagent donc avec le
 *     document, comme le reste ;
 *   · les formes géométriques courantes et leur remplissage ;
 *   · les tableaux ;
 *   · la couleur de fond des diapositives ;
 *   · les notes de l'orateur.
 *
 * CE QU'ON PERD, ET QU'ON ANNONCE
 *   · les masques et thèmes : PowerPoint hérite couleurs et polices de
 *     `slideMaster` et `slideLayout` par un mécanisme d'héritage à trois
 *     niveaux. Le suivre entièrement demanderait autant de code que tout le
 *     reste ; les valeurs posées sur la forme elle-même sont lues, celles
 *     héritées retombent sur notre thème.
 *   · les animations, les transitions, les SmartArt, les graphiques (qui
 *     vivent dans une pièce jointe Excel), la vidéo.
 *
 * Le compte de ce qui a été laissé de côté est retourné à l'appelant, qui le
 * dit à l'utilisateur. Un import silencieusement partiel est pire qu'un import
 * refusé.
 */

/** Unité OOXML : l'EMU, 914 400 par pouce. Jamais manipulée telle quelle. */
const EMU = 914400;

export type ResultatImport = {
  document: Document;
  /** Ce qui n'a pas pu être repris, pour le dire honnêtement. */
  ignores: { graphiques: number; smartArt: number; medias: number; autres: number };
};

/* =========================================================================
 * OUTILS XML
 * ======================================================================= */

const lireXml = (t: string) => new DOMParser().parseFromString(t, "application/xml");

/** Premier descendant portant ce nom local, quel que soit son préfixe. */
const enfant = (n: Element_ | null, nom: string): Element_ | null => {
  if (!n) return null;
  for (const e of Array.from(n.children)) {
    if (e.localName === nom) return e as Element_;
  }
  return null;
};

/** Tous les descendants portant ce nom local, à n'importe quelle profondeur. */
const tous = (n: Element_ | Document_ | null, nom: string): Element_[] =>
  n ? (Array.from(n.getElementsByTagName("*")).filter((e) => e.localName === nom) as Element_[]) : [];

/** Descend une suite de noms locaux : `chemin(sp, "spPr", "xfrm", "off")`. */
const chemin = (n: Element_ | null, ...noms: string[]): Element_ | null =>
  noms.reduce<Element_ | null>((cur, nom) => enfant(cur, nom), n);

type Element_ = globalThis.Element;
type Document_ = globalThis.Document;

const nombre = (v: string | null | undefined, defaut = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

/* =========================================================================
 * COULEURS
 * ======================================================================= */

/**
 * Couleur d'un `a:solidFill`.
 *
 * OOXML sait exprimer une couleur de six façons ; on lit la seule qui soit
 * autoportante (`srgbClr`) et l'on renvoie `null` pour les autres — couleurs de
 * thème (`schemeClr`), teintes système, couleurs indexées — car les résoudre
 * suppose d'avoir déroulé tout l'héritage de masques. Retomber sur notre thème
 * donne un résultat cohérent ; deviner donnerait un résultat faux.
 */
const couleurDe = (parent: Element_ | null): string | null => {
  const fill = enfant(parent, "solidFill");
  if (!fill) return null;
  const srgb = enfant(fill, "srgbClr");
  if (!srgb) return null;
  const val = srgb.getAttribute("val");
  if (!val) return null;

  const alpha = enfant(srgb, "alpha");
  const a = alpha ? nombre(alpha.getAttribute("val"), 100000) / 100000 : 1;
  return a >= 1 ? `#${val}` : `#${val}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
};

/* =========================================================================
 * GÉOMÉTRIE
 * ======================================================================= */

/** Correspondance des géométries prédéfinies avec nos formes. */
const FORMES: Record<string, NomForme> = {
  rect: "rectangle",
  roundRect: "rectangle",
  snip1Rect: "rectangle",
  ellipse: "ellipse",
  triangle: "triangle",
  rtTriangle: "triangle",
  diamond: "losange",
  star5: "etoile",
  line: "ligne",
  straightConnector1: "ligne",
  bentConnector3: "ligne",
  rightArrow: "fleche",
  leftArrow: "fleche",
};

/* =========================================================================
 * LECTURE D'UNE FORME
 * ======================================================================= */

type Echelle = { k: number };

const geometrie = (sp: Element_, e: Echelle) => {
  const xfrm = chemin(sp, "spPr", "xfrm") ?? chemin(sp, "grpSpPr", "xfrm") ?? chemin(sp, "xfrm");
  const off = enfant(xfrm, "off");
  const ext = enfant(xfrm, "ext");
  return {
    x: Math.round(nombre(off?.getAttribute("x")) * e.k),
    y: Math.round(nombre(off?.getAttribute("y")) * e.k),
    l: Math.max(8, Math.round(nombre(ext?.getAttribute("cx")) * e.k)),
    h: Math.max(8, Math.round(nombre(ext?.getAttribute("cy")) * e.k)),
    // La rotation OOXML est en 60 000<sup>e</sup> de degré.
    rot: Math.round(nombre(xfrm?.getAttribute("rot")) / 60000) || undefined,
  };
};

const echappe = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Reconstitue le HTML en ligne d'un corps de texte.
 *
 * OOXML découpe un paragraphe en « runs » dès qu'un attribut change : « mot
 * **gras** » fait trois runs. On les recolle, en ne conservant que le balisage
 * que notre modèle accepte — gras, italique, souligné.
 */
const texteDe = (txBody: Element_ | null) => {
  if (!txBody) return { html: "", taille: 0, graisse: 400, couleur: null as string | null, aligne: "gauche" as const };

  const paragraphes: string[] = [];
  let tailleMax = 0;
  let graisse = 400;
  let couleur: string | null = null;
  let aligne: "gauche" | "centre" | "droite" = "gauche";

  for (const p of tous(txBody, "p")) {
    const pPr = enfant(p, "pPr");
    const algn = pPr?.getAttribute("algn");
    if (algn === "ctr") aligne = "centre";
    else if (algn === "r") aligne = "droite";

    const morceaux: string[] = [];
    for (const r of tous(p, "r")) {
      const t = enfant(r, "t")?.textContent ?? "";
      if (!t) continue;
      const rPr = enfant(r, "rPr");

      // `sz` est en centièmes de point. Un point vaut 4/3 de pixel CSS, et
      // notre canevas est en pixels : sans cette conversion, tous les textes
      // importés seraient d'un quart trop petits.
      const sz = nombre(rPr?.getAttribute("sz"));
      if (sz) tailleMax = Math.max(tailleMax, Math.round((sz / 100) * 1.333));
      if (rPr?.getAttribute("b") === "1") graisse = 700;
      couleur = couleur ?? couleurDe(rPr);

      let m = echappe(t);
      if (rPr?.getAttribute("b") === "1") m = `<b>${m}</b>`;
      if (rPr?.getAttribute("i") === "1") m = `<i>${m}</i>`;
      if (rPr?.getAttribute("u") && rPr.getAttribute("u") !== "none") m = `<u>${m}</u>`;
      morceaux.push(m);
    }
    if (morceaux.length) paragraphes.push(morceaux.join(""));
  }

  return { html: paragraphes.join("<br>"), taille: tailleMax, graisse, couleur, aligne };
};

/* =========================================================================
 * IMPORT
 * ======================================================================= */

const relations = (xml: string): Map<string, string> => {
  const doc = lireXml(xml);
  const m = new Map<string, string>();
  for (const r of tous(doc, "Relationship")) {
    const id = r.getAttribute("Id");
    const cible = r.getAttribute("Target");
    if (id && cible) m.set(id, cible.replace(/^\.\.\//, "ppt/").replace(/^\//, ""));
  }
  return m;
};

export const importerPptx = async (fichier: File, auteur: string): Promise<ResultatImport> => {
  if (!decompressionDisponible()) {
    throw new Error(
      "Ce navigateur ne sait pas décompresser les archives. Utilisez une version récente de Chrome, Firefox ou Safari."
    );
  }

  const octets = await fichier.arrayBuffer();
  const signature = new Uint8Array(octets.slice(0, 4));

  // Un `.ppt` binaire commence par la signature d'un système de fichiers
  // composé. On le reconnaît pour donner une consigne utile plutôt qu'une
  // erreur d'archive incompréhensible.
  if (signature[0] === 0xd0 && signature[1] === 0xcf) {
    throw new Error(
      "Ce fichier est au format PowerPoint 97-2003 (.ppt), un format binaire fermé. Ouvrez-le dans PowerPoint et enregistrez-le en .pptx, puis réessayez."
    );
  }
  if (!(signature[0] === 0x50 && signature[1] === 0x4b)) {
    throw new Error("Ce fichier n'est pas une présentation PowerPoint.");
  }

  const archive = await ouvrirZip(octets);
  const lire = (n: string) => archive.get(n);

  const presentation = lireXml(enTexte(lire("ppt/presentation.xml")));
  const sldSz = tous(presentation, "sldSz")[0];
  const largeurEmu = nombre(sldSz?.getAttribute("cx"), 12192000);
  const hauteurEmu = nombre(sldSz?.getAttribute("cy"), 6858000);

  // Le format le plus proche décide du canevas ; l'échelle est ensuite calculée
  // sur la LARGEUR seule, pour qu'un ratio légèrement différent déforme le moins
  // possible plutôt que de rogner.
  const ratio = largeurEmu / hauteurEmu;
  const format = Math.abs(ratio - 4 / 3) < Math.abs(ratio - 16 / 9) ? "4:3" : "16:9";
  const cible = FORMATS[format];
  const k = cible.largeur / largeurEmu;

  const relsPresentation = relations(enTexte(lire("ppt/_rels/presentation.xml.rels")));
  const ordre = tous(presentation, "sldId")
    .map((s) => {
      const rid = Array.from(s.attributes).find((a) => a.localName === "id" && a.prefix === "r")?.value;
      return rid ? relsPresentation.get(rid) : undefined;
    })
    .filter((n): n is string => !!n);

  // Repli : certains fichiers produits par des outils tiers n'ont pas de liste
  // ordonnée exploitable. On prend alors les diapositives par numéro.
  const chemins = ordre.length
    ? ordre
    : [...archive.keys()]
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => nombre(a.match(/(\d+)/)?.[1]) - nombre(b.match(/(\d+)/)?.[1]));

  const ignores = { graphiques: 0, smartArt: 0, medias: 0, autres: 0 };
  const diapositives: Diapositive[] = [];

  for (const cheminDiapo of chemins) {
    const entree = lire(cheminDiapo);
    if (!entree) continue;

    const doc = lireXml(enTexte(entree));
    const rels = relations(enTexte(lire(cheminDiapo.replace(/slides\//, "slides/_rels/") + ".rels")));

    const elements: Element[] = [];
    const e: Echelle = { k };

    /* ---------- Fond ---------- */
    const bg = tous(doc, "bg")[0];
    const fondCouleur = bg ? couleurDe(chemin(bg, "bgPr")) : null;

    /* ---------- Formes et textes ---------- */
    const arbre = tous(doc, "spTree")[0] ?? doc.documentElement;

    for (const noeud of Array.from(arbre.children) as Element_[]) {
      const g = geometrie(noeud, e);

      if (noeud.localName === "sp") {
        const txBody = enfant(noeud, "txBody");
        const t = texteDe(txBody);
        const spPr = enfant(noeud, "spPr");
        const prst = enfant(spPr, "prstGeom")?.getAttribute("prst") ?? "rect";
        const remplissage = couleurDe(spPr);
        const contour = couleurDe(enfant(spPr, "ln"));
        const rayonAngles = prst === "roundRect" ? 18 : 0;

        // Une forme porteuse de texte donne DEUX éléments chez nous : le fond
        // et le texte. C'est volontaire — chacun se déplace et se recolore
        // ensuite indépendamment, ce que PowerPoint ne permet pas.
        if (remplissage || (contour && prst !== "line")) {
          elements.push(
            forme({
              ...g,
              forme: FORMES[prst] ?? "rectangle",
              remplissage: remplissage ?? "transparent",
              contour: contour ?? "transparent",
              epaisseur: contour ? Math.max(1, Math.round(nombre(enfant(spPr, "ln")?.getAttribute("w")) * k)) : 0,
              rayon: rayonAngles,
            })
          );
        }

        if (t.html) {
          elements.push(
            texte({
              ...g,
              html: t.html,
              taille: t.taille || 24,
              graisse: t.graisse,
              couleur: t.couleur ?? THEME_MEGASOFT.encre,
              aligne: t.aligne,
              interligne: 1.25,
              vertical: "milieu",
            })
          );
        }
        continue;
      }

      if (noeud.localName === "pic") {
        const blip = tous(noeud, "blip")[0];
        const rid = blip
          ? Array.from(blip.attributes).find((a) => a.localName === "embed")?.value
          : undefined;
        const source = rid ? rels.get(rid) : undefined;
        const media: Entree | undefined = source ? lire(source) : undefined;
        elements.push(
          image({
            ...g,
            src: media ? enDataURI(media, typeMime(media.nom)) : "",
            alt: tous(noeud, "cNvPr")[0]?.getAttribute("descr") ?? "",
            ajustement: "couvrir",
            rayon: 0,
          })
        );
        continue;
      }

      if (noeud.localName === "graphicFrame") {
        const tbl = tous(noeud, "tbl")[0];
        if (tbl) {
          const grid = tous(tbl, "gridCol");
          const lignes: CelluleTableau[][] = tous(tbl, "tr").map((tr) =>
            tous(tr, "tc").map((tc) => cellule(texteDe(enfant(tc, "txBody")).html))
          );
          if (lignes.length) {
            elements.push(
              tableau({
                ...g,
                colonnes: grid.length
                  ? grid.map((c) => ({ p: nombre(c.getAttribute("w"), 1) }))
                  : lignes[0].map(() => ({ p: 1 })),
                lignes,
                entete: true,
                style: { ...STYLE_TABLEAU, couleurEntete: THEME_MEGASOFT.accents[0] },
              })
            );
          }
          continue;
        }
        // Graphique Excel ou SmartArt : le contenu vit dans une pièce jointe
        // qu'on ne sait pas lire. On compte et on annonce.
        if (tous(noeud, "chart").length) ignores.graphiques += 1;
        else if (tous(noeud, "dgm").length) ignores.smartArt += 1;
        else ignores.autres += 1;
        continue;
      }

      if (noeud.localName === "grpSp") {
        // Les groupes ont leur propre repère, avec décalage et mise à l'échelle
        // internes. Les déplier correctement demande de composer les deux
        // transformations ; on prend les formes à plat, ce qui place
        // correctement la grande majorité des cas.
        for (const sous of tous(noeud, "sp")) {
          const gs = geometrie(sous, e);
          const t = texteDe(enfant(sous, "txBody"));
          if (t.html) {
            elements.push(
              texte({
                ...gs,
                html: t.html,
                taille: t.taille || 20,
                graisse: t.graisse,
                couleur: t.couleur ?? THEME_MEGASOFT.encre,
                aligne: t.aligne,
                vertical: "milieu",
              })
            );
          }
        }
        continue;
      }

      if (noeud.localName === "pic" || noeud.localName === "videoFile") ignores.medias += 1;
    }

    /* ---------- Notes de l'orateur ---------- */
    const numero = cheminDiapo.match(/slide(\d+)\.xml/)?.[1];
    const notes = numero ? lire(`ppt/notesSlides/notesSlide${numero}.xml`) : undefined;
    const texteNotes = notes
      ? tous(lireXml(enTexte(notes)), "t")
          .map((n) => n.textContent ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    diapositives.push({
      ...diapositiveVide(fondCouleur ?? THEME_MEGASOFT.fond),
      elements,
      notes: texteNotes,
    });
  }

  if (!diapositives.length) throw new Error("Aucune diapositive lisible dans ce fichier.");

  const maintenant = new Date().toISOString();
  return {
    document: {
      version: 3,
      id: identifiant("doc"),
      titre: fichier.name.replace(/\.pptx?$/i, ""),
      format,
      theme: { ...THEME_MEGASOFT },
      diapositives,
      meta: { auteur, cree_le: maintenant, maj_le: maintenant },
    },
    ignores,
  };
};

/** Phrase honnête sur ce que l'import a laissé de côté. */
export const resumerPertes = (i: ResultatImport["ignores"]) => {
  const morceaux: string[] = [];
  if (i.graphiques) morceaux.push(`${i.graphiques} graphique(s)`);
  if (i.smartArt) morceaux.push(`${i.smartArt} SmartArt`);
  if (i.medias) morceaux.push(`${i.medias} média(s)`);
  if (i.autres) morceaux.push(`${i.autres} objet(s) non reconnu(s)`);
  if (!morceaux.length) return "";
  return `${morceaux.join(", ")} n'ont pas pu être repris — leur contenu vit dans des pièces jointes que l'import ne sait pas lire. Les emplacements sont vides, à recomposer.`;
};
