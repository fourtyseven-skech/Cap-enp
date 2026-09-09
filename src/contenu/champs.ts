import type { ZodTypeAny } from "zod";
import { CLES_ICONES } from "./clesIcones";

/**
 * ---------------------------------------------------------------------------
 * DU SCHÉMA AU FORMULAIRE
 * ---------------------------------------------------------------------------
 *
 * Lit un schéma Zod et en déduit les champs à afficher dans le panel.
 *
 * POURQUOI DÉDUIRE PLUTÔT QUE DÉCRIRE
 * -----------------------------------
 * L'alternative était d'écrire, à côté de chaque schéma, une description du
 * formulaire correspondant. Deux fichiers à tenir d'accord : ajouter un champ
 * au modèle sans l'ajouter au formulaire donnerait une donnée invisible, et
 * l'inverse un champ qui ne s'enregistre pas. Les deux passent inaperçus.
 *
 * Ici, ajouter une section au modèle suffit : son formulaire existe.
 *
 * CE QUI EST LU DANS LE SCHÉMA
 * ----------------------------
 * Le type, les bornes (longueur, minimum, maximum), le caractère facultatif, et
 * les valeurs d'une liste fermée. Le panel s'en sert pour choisir le bon
 * contrôle et pour empêcher une saisie que le build refuserait de toute façon.
 *
 * LES LIBELLÉS
 * ------------
 * Déduits de la clé : `titre_fort` devient « Titre fort ». Les cas où ça sonne
 * mal sont corrigés dans `LIBELLES`, plus bas — une liste courte et lisible
 * vaut mieux que soixante appels à `.describe()` dans les schémas.
 */

/* Zod n'expose pas ses définitions dans ses types publics. On les décrit ici
   plutôt que de parsemer le fichier de `any`. */
type Def = {
  typeName: string;
  checks?: { kind: string; value?: number; regex?: RegExp }[];
  values?: string[];
  type?: ZodTypeAny;
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  exactLength?: { value: number };
  minLength?: { value: number };
  maxLength?: { value: number };
  shape?: () => Record<string, ZodTypeAny>;
  defaultValue?: () => unknown;
  discriminator?: string;
  options?: ZodTypeAny[];
  value?: unknown;
};

const def = (s: ZodTypeAny) => (s as unknown as { _def: Def })._def;

export type Champ =
  | { genre: "texte"; cle: string; libelle: string; max?: number; long: boolean; facultatif: boolean }
  | { genre: "nombre"; cle: string; libelle: string; min?: number; max?: number; facultatif: boolean }
  | {
      genre: "liste";
      cle: string;
      libelle: string;
      valeurs: string[];
      facultatif: boolean;
      /**
       * Les valeurs sont des CLÉS D'ICÔNES.
       *
       * Le panel dessine alors les icônes plutôt que d'afficher « serveur »,
       * « puzzle », « cartons » en toutes lettres. Personne ne choisit un
       * pictogramme sur la foi de son nom de code.
       */
      icones?: boolean;
    }
  /**
   * Un FICHIER — une image ou une vidéo — et non un chemin à taper.
   *
   * Le panel montre alors le fichier lui-même : la vignette de ce qui est
   * choisi, la bibliothèque de ce qui existe déjà, un bouton d'envoi. Personne
   * ne devrait avoir à écrire « /medias/9f3a…-b21c.webp » à la main, ni à
   * deviner ce que contient un logo d'après son nom de fichier.
   */
  | {
      genre: "media";
      cle: string;
      libelle: string;
      /** Ce que le champ accepte, déduit de son schéma. */
      accepte: "image" | "video" | "tout";
      facultatif: boolean;
    }
  | { genre: "booleen"; cle: string; libelle: string; facultatif: boolean }
  | { genre: "texteMultiple"; cle: string; libelle: string; max?: number; mini: number; maxi: number }
  /**
   * Une liste dont chaque élément suit l'un de plusieurs GABARITS.
   *
   * Le discriminant — `gabarit` — dit lequel, et chaque gabarit a ses propres
   * champs. C'est ce qui permet d'offrir au client deux modèles de section
   * bien faits plutôt qu'un formulaire fourre-tout où la moitié des champs ne
   * s'appliquerait pas à ce qu'il est en train d'écrire.
   */
  | {
      genre: "variantes";
      cle: string;
      libelle: string;
      discriminant: string;
      variantes: { valeur: string; libelle: string; champs: Champ[] }[];
      mini: number;
      maxi: number;
    }
  | {
      genre: "objets";
      cle: string;
      libelle: string;
      champs: Champ[];
      mini: number;
      maxi: number;
      /** Nombre imposé : le panel n'affiche alors ni ajout ni suppression. */
      fige: boolean;
    };

/* ------------------------------------------------------------- libellés */

/** Les clés dont la transformation automatique sonne faux. */
const LIBELLES: Record<string, string> = {
  cle: "Identifiant",
  id: "Identifiant",
  titre_fort: "Titre — partie foncée",
  titre_doux: "Titre — partie grise",
  sous_titre: "Sous-titre",
  bouton_blog: "Bouton « Blog »",
  bouton_demo: "Bouton de démonstration",
  bouton_visite: "Bouton de la visite",
  pilule_engagements: "Libellé de la pilule",
  annee_fondation: "Année de fondation",
  libelle_annees: "Libellé du compteur",
  telephones_affiches: "Numéros repris dans le pied de page",
  mention_legale: "Mention légale",
  telephone_appel: "Numéro composable",
  affiche: "Affiché",
  appel: "Composable",
  base: "Fichier vidéo",
  note: "Étoiles",
  pin: "Côté d'épinglage",
  wm: "Filigrane",
};

/** Le nom lisible d'un gabarit, tel qu'il apparaît dans la liste déroulante. */
const LIBELLES_GABARITS: Record<string, string> = {
  "texte-image": "Texte et image",
  "trois-points": "Trois points forts",
  annonce: "Annonce — image ou vidéo",
};

const enLibelle = (cle: string) => {
  if (LIBELLES[cle]) return LIBELLES[cle];
  const mots = cle.replace(/[_-]/g, " ").trim();
  return mots.charAt(0).toUpperCase() + mots.slice(1);
};

/* --------------------------------------------------------------- lecture */

const borne = (s: ZodTypeAny, kind: string): number | undefined =>
  def(s).checks?.find((c) => c.kind === kind)?.value;

/* ----------------------------------------------------------- les médias */

/**
 * UN CHAMP EST-IL UN FICHIER ?
 *
 * Reconnu sur le CONTENU du schéma, jamais sur le nom de la clé — même règle
 * que pour les icônes, et pour la même raison : un champ nommé `illustration`
 * doit être traité comme un média, et un champ nommé `image` qui contiendrait
 * autre chose ne doit pas l'être.
 *
 * La méthode : on soumet à l'expression régulière du schéma un exemple de ce
 * que le panel produirait. Si elle l'accepte, c'est que le champ attend ce
 * genre de valeur. Le schéma reste seul juge — on ne redit rien de ce qu'il
 * dit déjà.
 */
const EXEMPLES = {
  image: ["/medias/0123abcd-0123-0123-0123-0123456789ab.webp"],
  /* Deux formes pour la vidéo : le couple 480/720 déjà présent dans le dépôt,
     et le fichier unique envoyé depuis le panel. */
  video: ["/videos/exemple", "/medias/0123abcd-0123-0123-0123-0123456789ab.mp4"],
} as const;

const genreDeMedia = (s: ZodTypeAny): "image" | "video" | "tout" | undefined => {
  const regles = (def(s).checks ?? [])
    .filter((c) => c.kind === "regex" && c.regex)
    .map((c) => c.regex!);

  /* Sans contrainte de forme, un texte reste un texte : tout le reste du
     modèle passerait pour un fichier. */
  if (!regles.length) return undefined;

  const accepte = (exemple: string) => regles.every((r) => r.test(exemple));
  const image = EXEMPLES.image.some(accepte);
  const video = EXEMPLES.video.some(accepte);

  /* Les deux : le gabarit « Annonce » laisse le choix entre une image et une
     vidéo, et le sélecteur propose alors les deux bibliothèques. */
  if (image && video) return "tout";
  if (image) return "image";
  if (video) return "video";
  return undefined;
};

/** Retire les enveloppes `optional`, `nullable`, `default` et `refine`. */
const noyau = (s: ZodTypeAny): { schema: ZodTypeAny; facultatif: boolean } => {
  let courant = s;
  let facultatif = false;
  for (;;) {
    const d = def(courant);
    if (d.typeName === "ZodOptional" || d.typeName === "ZodNullable") {
      facultatif = true;
      courant = d.innerType!;
    } else if (d.typeName === "ZodDefault") {
      facultatif = true;
      courant = d.innerType!;
    } else if (d.typeName === "ZodEffects") {
      // `.refine()` enveloppe le schéma : le contrôle qu'il porte s'applique à
      // l'objet entier et n'a pas de champ à lui.
      courant = d.schema!;
    } else {
      return { schema: courant, facultatif };
    }
  }
};

/**
 * Les champs d'un schéma d'objet.
 *
 * Renvoie une liste vide pour tout ce qui n'est pas un objet : le panel affiche
 * alors un message plutôt qu'un écran blanc.
 */
export const champsDe = (schema: ZodTypeAny): Champ[] => {
  const { schema: racine } = noyau(schema);
  const d = def(racine);
  if (d.typeName !== "ZodObject" || !d.shape) return [];

  const sortie: Champ[] = [];

  for (const [cle, brut] of Object.entries(d.shape())) {
    const { schema: s, facultatif } = noyau(brut);
    const t = def(s);
    const libelle = enLibelle(cle);

    switch (t.typeName) {
      case "ZodString": {
        const media = genreDeMedia(s);
        if (media) {
          sortie.push({ genre: "media", cle, libelle, accepte: media, facultatif });
          break;
        }

        const max = borne(s, "max");
        sortie.push({
          genre: "texte",
          cle,
          libelle,
          max,
          // Au-delà de 160 caractères, une ligne unique devient illisible : on
          // passe en zone de texte.
          long: (max ?? 0) > 160,
          facultatif,
        });
        break;
      }

      case "ZodNumber":
        sortie.push({
          genre: "nombre",
          cle,
          libelle,
          min: borne(s, "min"),
          max: borne(s, "max"),
          facultatif,
        });
        break;

      case "ZodBoolean":
        sortie.push({ genre: "booleen", cle, libelle, facultatif });
        break;

      case "ZodEnum": {
        const valeurs = t.values ?? [];
        sortie.push({
          genre: "liste",
          cle,
          libelle,
          valeurs,
          facultatif,
          /* Reconnu par le CONTENU de l'énumération, pas par le nom du champ :
             une clé nommée autrement qu'« icone » serait traitée pareil, et
             un champ « icone » portant d'autres valeurs ne le serait pas. */
          icones:
            valeurs.length > 0 &&
            valeurs.every((v) => (CLES_ICONES as readonly string[]).includes(v)),
        });
        break;
      }

      case "ZodArray": {
        const interne = noyau(t.type!).schema;
        const mini = t.exactLength?.value ?? t.minLength?.value ?? 0;
        const maxi = t.exactLength?.value ?? t.maxLength?.value ?? 50;

        if (def(interne).typeName === "ZodDiscriminatedUnion") {
          const u = def(interne);
          sortie.push({
            genre: "variantes",
            cle,
            libelle,
            discriminant: u.discriminator ?? "gabarit",
            variantes: (u.options ?? []).map((option) => {
              const forme = def(option).shape?.() ?? {};
              const litteral = def(forme[u.discriminator ?? "gabarit"]);
              const valeur = String(litteral.value ?? "");
              return {
                valeur,
                libelle: LIBELLES_GABARITS[valeur] ?? enLibelle(valeur),
                // Le discriminant est retiré : il est choisi par la liste
                // déroulante, pas saisi comme un champ ordinaire.
                champs: champsDe(option).filter((c) => c.cle !== (u.discriminator ?? "gabarit")),
              };
            }),
            mini,
            maxi,
          });
        } else if (def(interne).typeName === "ZodObject") {
          sortie.push({
            genre: "objets",
            cle,
            libelle,
            champs: champsDe(interne),
            mini,
            maxi,
            fige: t.exactLength !== undefined,
          });
        } else {
          sortie.push({
            genre: "texteMultiple",
            cle,
            libelle,
            max: borne(interne, "max"),
            mini,
            maxi,
          });
        }
        break;
      }

      case "ZodObject":
        /*
         * Un objet imbriqué est aplati : ses champs remontent avec une clé
         * composée (`coordonnees.email`).
         *
         * Un seul niveau d'imbrication existe dans le modèle, et une section
         * qui replierait ses champs dans des sous-titres serait plus longue à
         * parcourir qu'une liste plate.
         */
        for (const enfant of champsDe(s)) {
          sortie.push({ ...enfant, cle: `${cle}.${enfant.cle}` });
        }
        break;

      default:
        // Type non pris en charge : on l'ignore plutôt que d'afficher un
        // contrôle qui ne saurait pas l'enregistrer.
        break;
    }
  }

  return sortie;
};

/* ------------------------------------------------------------- accès aux valeurs */

/** Lit une valeur, y compris derrière une clé composée (`coordonnees.email`). */
export const lireValeur = (objet: Record<string, unknown>, cle: string): unknown =>
  cle.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], objet);

/**
 * Écrit une valeur et renvoie un NOUVEL objet.
 *
 * Sans copie, React ne verrait pas le changement : l'objet garderait la même
 * référence et le rendu ne serait pas rejoué.
 */
export const ecrireValeur = (
  objet: Record<string, unknown>,
  cle: string,
  valeur: unknown
): Record<string, unknown> => {
  const [tete, ...reste] = cle.split(".");
  if (!reste.length) return { ...objet, [tete]: valeur };
  const enfant = (objet[tete] ?? {}) as Record<string, unknown>;
  return { ...objet, [tete]: ecrireValeur(enfant, reste.join("."), valeur) };
};
