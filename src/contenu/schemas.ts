import { z } from "zod";
import { CLES_ICONES } from "./clesIcones";

/**
 * ---------------------------------------------------------------------------
 * LE MODÈLE DE CONTENU DE LA PAGE D'ACCUEIL
 * ---------------------------------------------------------------------------
 *
 * Une section = un fichier dans `content/accueil/`, et un schéma ici.
 *
 * CE FICHIER N'EST JAMAIS CHARGÉ PAR LE NAVIGATEUR
 * ------------------------------------------------
 * Les composants n'importent que les TYPES (`import type`), effacés à la
 * compilation. La validation, elle, tourne au build : un greffon de Vite lit
 * les fichiers JSON et refuse de construire le site si l'un d'eux ne respecte
 * pas son schéma.
 *
 * C'est ce qui permet d'avoir un modèle strict sans embarquer Zod dans le
 * bundle d'une page dont le temps de chargement a été gagné à la main.
 *
 * POURQUOI BORNER AUTANT
 * ----------------------
 * Ces bornes ne protègent pas d'une faute de frappe : elles protègent la MISE
 * EN PAGE. Le jour où le contenu sera modifiable depuis le panel, un titre de
 * 400 caractères ou une quatrième colonne casseront un déroulé réglé au pixel.
 * Mieux vaut refuser à la saisie, avec une phrase claire, que découvrir le
 * dégât en ligne.
 *
 * Chaque borne ci-dessous vient d'une mesure sur le contenu réel, arrondie
 * généreusement — assez large pour ne jamais gêner une reformulation, assez
 * étroite pour arrêter une saisie aberrante.
 */

/** Texte court : un libellé, une étiquette. */
const bref = (max: number, quoi: string) =>
  z.string().trim().min(1, `${quoi} ne peut pas être vide.`).max(max, `${quoi} : ${max} caractères au maximum.`);

/** Texte long : un paragraphe. Peut être vide. */
const paragraphe = (max: number, quoi: string) =>
  z.string().trim().max(max, `${quoi} : ${max} caractères au maximum.`);

/* ========================================================================= */
/* accueil.chiffres — le bandeau sous le Hero                                */
/* ========================================================================= */

export const schemaChiffres = z.object({
  chiffres: z
    .array(
      z.object({
        /** Compté à l'écran, de 0 jusqu'à cette valeur. */
        valeur: z.number().int().min(0).max(10_000_000),
        libelle: bref(40, "Le libellé du chiffre"),
        /** « + », « % », ou rien. */
        suffixe: z.string().max(3, "Le suffixe tient en trois caractères."),
      })
    )
    /*
     * Exactement quatre.
     *
     * Le bandeau est une grille de quatre colonnes sur bureau et de deux sur
     * téléphone. Trois laissent un trou, cinq débordent sur une deuxième ligne
     * bancale. Ce n'est pas une préférence : c'est ce que la mise en page sait
     * faire.
     */
    .length(4, "Le bandeau affiche exactement quatre chiffres."),
});

/* ========================================================================= */
/* accueil.qui-sommes-nous                                                   */
/* ========================================================================= */

export const schemaQuiSommesNous = z.object({
  badge: bref(30, "Le badge"),

  /*
   * Le titre est en DEUX morceaux, et ce n'est pas un caprice.
   *
   * À l'écran, la première partie est en noir et la seconde en gris — c'est une
   * seule phrase dont la fin s'efface. Un champ unique obligerait à écrire du
   * balisage dans le contenu, donc à autoriser du HTML saisi depuis le panel.
   * Deux champs disent la même chose sans ouvrir cette porte.
   */
  titre_fort: bref(120, "La partie foncée du titre"),
  titre_doux: bref(220, "La partie grise du titre"),

  colonnes: z
    .array(
      z.object({
        index: bref(4, "Le numéro de colonne"),
        titre: bref(70, "Le titre de colonne"),
        texte: paragraphe(320, "Le texte de colonne"),
      })
    )
    // Trois colonnes, une par pôle. La grille est en `md:grid-cols-3`.
    .length(3, "La section présente exactement trois colonnes."),

  /** Le compteur d'années part de cette date. Jamais un nombre écrit en dur. */
  annee_fondation: z.number().int().min(1900).max(2100),
  libelle_annees: bref(40, "Le libellé du compteur"),
  lieu: bref(60, "La mention de lieu"),
});

/* ========================================================================= */
/* accueil.solutions — les trois pôles                                       */
/* ========================================================================= */

/**
 * Une entrée de liste : un module, un service.
 *
 * L'ICÔNE EST UN CHAMP, PAS UNE DÉDUCTION.
 *
 * Avant l'extraction, elle se déduisait du titre : `moduleIcons[item.title]`.
 * Le jour où le client renommera « GPAO » en « G.P.A.O. » depuis le panel,
 * l'icône serait silencieusement retombée sur celle par défaut. Séparer les
 * deux rend le titre librement réécrivable, et une clé d'icône inconnue fait
 * échouer le build au lieu de passer inaperçue.
 */
const schemaEntree = z.object({
  titre: bref(60, "Le nom du module"),
  texte: paragraphe(260, "La description du module"),
  icone: z.enum(CLES_ICONES, {
    message: `Icône inconnue. Choisissez parmi : ${CLES_ICONES.join(", ")}.`,
  }),
});

export const schemaSolutions = z.object({
  poles: z
    .array(
      z.object({
        /*
         * L'identifiant est une ADRESSE, pas un libellé.
         *
         * Il sert d'ancre (`/#solutions-digital`), depuis le menu, le pied de
         * page et les articles du blog. Le renommer casserait des liens déjà
         * partagés : il est donc contraint, et le panel ne devra pas le
         * proposer à la modification.
         */
        id: z
          .string()
          .regex(/^[a-z]+$/, "L'identifiant d'un pôle ne prend que des minuscules."),
        libelle: bref(20, "Le nom de l'onglet"),
        titre: bref(80, "Le titre du pôle"),
        bouton: bref(40, "Le libellé du bouton"),
        entrees: z
          .array(schemaEntree)
          .min(1, "Un pôle a au moins une entrée.")
          .max(12, "Douze entrées au maximum : au-delà, la liste coulissante déborde."),
      })
    )
    // Trois pôles : Office, Digital, Services. Les onglets et les couleurs sont
    // écrits en toutes lettres dans le composant, Tailwind ne voyant pas une
    // classe assemblée à l'exécution.
    .length(3, "Le site présente exactement trois pôles."),
});

/* ========================================================================= */
/* accueil.avis                                                              */
/* ========================================================================= */

export const schemaAvis = z.object({
  avis: z
    .array(
      z.object({
        /*
         * ⚠️ LA NOTE EST À CONFIRMER AVANT MISE EN LIGNE.
         *
         * Les textes proviennent d'avis réels, mais le nombre d'étoiles de
         * chacun n'a pas été relevé : il est supposé à 5. Une note affichée
         * plus haute que la note réelle est un faux avis, quelle que soit la
         * sincérité du texte.
         */
        note: z.number().int().min(1).max(5),
        texte: paragraphe(320, "Le texte de l'avis"),
        auteur: bref(60, "L'auteur"),
        organisation: bref(60, "L'organisation").nullable(),
      })
    )
    // Trois, en éventail : un à gauche penché, un au centre, un à droite penché.
    // La disposition est écrite dans le composant.
    .length(3, "L'éventail présente exactement trois avis."),
});

/* ========================================================================= */
/* accueil.contact                                                           */
/* ========================================================================= */

export const schemaContact = z.object({
  secteurs: z
    .array(bref(60, "Un secteur d'activité"))
    .min(2, "Au moins deux secteurs.")
    .max(20, "Vingt secteurs au maximum."),
  tailles: z
    .array(bref(40, "Une taille d'entreprise"))
    .min(2, "Au moins deux tailles.")
    .max(10, "Dix tailles au maximum."),
  coordonnees: z.object({
    adresse: bref(120, "L'adresse"),
    /*
     * Chaque numéro porte SON affichage et SON numéro composable.
     *
     * Une première version ne gardait que l'affichage et dérivait le lien
     * `tel:` en retirant tout sauf les chiffres et le « + ». Cela conservait le
     * zéro de « +213 (0)23… » et produisait un numéro faux d'un chiffre : le
     * « (0) » est le préfixe national, qu'on omet précisément quand on compose
     * l'indicatif international.
     *
     * Une transformation juste sur un exemple et fausse sur le suivant n'a pas
     * sa place dans un lien que personne ne teste.
     *
     * `appel` est facultatif : un numéro seulement affiché dans une liste n'a
     * pas besoin d'être cliquable, et l'inventer serait pire que l'omettre.
     */
    telephones: z
      .array(
        z.object({
          affiche: bref(30, "Le numéro tel qu'il est écrit"),
          appel: z
            .string()
            .regex(/^\+\d{6,15}$/, "Le numéro composable s'écrit « + » puis les chiffres, sans espace.")
            .optional(),
        })
      )
      .min(1, "Au moins un numéro.")
      .max(4, "Quatre numéros au maximum."),
    email: z.string().email("Adresse e-mail invalide.").max(120),
  }),
});

/* ========================================================================= */
/* accueil.hero                                                              */
/* ========================================================================= */

export const schemaHero = z.object({
  titre: bref(120, "Le titre principal"),
  sous_titre: bref(200, "Le sous-titre"),
  bouton: bref(30, "Le libellé du bouton"),

  /*
   * Les scènes vidéo du fond.
   *
   * DEUX FORMES, ET UNE SEULE PORTE DEUX RÉSOLUTIONS
   * ------------------------------------------------
   *   · « /videos/nom » — les vidéos livrées avec le site, déclinées en 480p
   *     et 720p. Le composant choisit la bonne selon l'écran ;
   *   · « /medias/<identifiant>.mp4 » — une vidéo ENVOYÉE depuis le panel.
   *     Faute de `ffmpeg` sur l'hébergement, elle n'est pas déclinée : le même
   *     fichier sert à tous les écrans. C'est ce qui justifie les seuils de
   *     poids de `contenu/poids.ts` — sans transcodage, le poids envoyé est le
   *     poids téléchargé par un visiteur en 3G.
   */
  scenes: z
    .array(
      z.object({
        base: z
          .string()
          .regex(
            /^(?:\/videos\/[a-z0-9-]+|\/medias\/[0-9a-f-]{36}\.(?:mp4|webm))$/,
            "Attendu : une vidéo livrée avec le site (« /videos/nom ») ou une vidéo envoyée depuis le panel."
          ),
        libelle: bref(40, "Le libellé de la scène"),
      })
    )
    .min(1, "Au moins une scène.")
    .max(6, "Six scènes au maximum : au-delà, la rotation devient interminable."),
});

/* ========================================================================= */
/* accueil.partenaires                                                       */
/* ========================================================================= */

export const schemaPartenaires = z.object({
  titre: bref(60, "Le titre de la section"),
  accroche: paragraphe(220, "L'accroche"),
  partenaires: z
    .array(
      z.object({
        nom: bref(60, "Le nom du partenaire"),
        /* Sert aussi de filigrane quand une carte est ouverte : un nom de ville
           trop long déborderait de l'écran. */
        region: bref(20, "La ville"),
        adresse: bref(120, "L'adresse").optional(),
        telephone: bref(30, "Le téléphone"),
      })
    )
    .min(1, "Au moins un partenaire.")
    .max(20, "Vingt partenaires au maximum."),
});

/* ========================================================================= */
/* accueil.references                                                        */
/* ========================================================================= */

export const schemaReferences = z.object({
  logos: z
    .array(
      z.object({
        /** Sert aussi de texte alternatif : c'est ce que lit un lecteur d'écran. */
        nom: bref(60, "Le nom du client"),
        /*
         * DEUX FORMES ACCEPTÉES, et une seule est saisissable à la main.
         *
         *   · « ups.webp » — un fichier de `src/assets/clients/`, présent dans
         *     le dépôt depuis le début ;
         *   · « /medias/<identifiant>.webp » — une image ENVOYÉE depuis le
         *     panel. C'est ce que produit le sélecteur de média.
         *
         * Le motif refuse tout le reste, et notamment les chemins relatifs :
         * un « ../ » dans un nom de fichier n'a rien à faire ici.
         */
        fichier: z
          .string()
          .regex(
            /^(?:[a-zA-Z0-9_-]+|\/medias\/[0-9a-f-]{36})\.(webp|png|jpg|jpeg|avif)$/,
            "Attendu : un fichier du dépôt (« ups.webp ») ou une image envoyée depuis le panel."
          ),
      })
    )
    .min(1, "Au moins un logo.")
    .max(80, "Quatre-vingts logos au maximum : le ruban devient interminable."),
});

/* ========================================================================= */
/* commun.entete et commun.pied                                              */
/* ========================================================================= */

/**
 * Un lien de menu.
 *
 * L'ANCRE est une adresse, pas un libellé : elle doit correspondre à l'`id`
 * d'une section de la page. La renommer casserait le lien ET le repère de
 * défilement qui met l'entrée en surbrillance. Le libellé, lui, se réécrit
 * librement.
 */
const schemaLien = z.object({
  libelle: bref(30, "Le libellé du lien"),
  ancre: z.string().regex(/^[a-z]+$/, "Une ancre ne prend que des minuscules."),
});

export const schemaEntete = z.object({
  liens: z
    .array(schemaLien)
    .min(1, "Au moins un lien.")
    .max(8, "Huit liens au maximum : au-delà, la barre déborde sur un portable."),
  bouton_blog: bref(20, "Le libellé du bouton Blog"),
  bouton_demo: bref(30, "Le libellé du bouton de démonstration"),
});

export const schemaPied = z.object({
  poles: z
    .array(
      z.object({
        /* Doit correspondre à l'identifiant du pôle dans `solutions.json` :
           c'est lui qui fait défiler vers le bon onglet. */
        id: z.string().regex(/^[a-z]+$/, "L'identifiant d'un pôle ne prend que des minuscules."),
        nom: bref(40, "Le nom du pôle"),
        descriptif: bref(60, "Le descriptif du pôle"),
      })
    )
    .length(3, "Le pied de page présente les trois pôles."),

  /** Nombre de numéros du standard repris dans le pied de page. */
  telephones_affiches: z.number().int().min(1).max(4),

  mention_legale: bref(80, "La mention légale"),
});

/* ========================================================================= */
/* accueil.mega-erp                                                          */
/* ========================================================================= */

/**
 * Seuls les TEXTES d'accompagnement sont ici.
 *
 * La démonstration animée elle-même -- les écrans, les indicateurs, le
 * graphique -- reste dans `components/erp/ecrans.tsx`. Ce ne sont pas des
 * phrases éditoriales mais une maquette d'interface : les sortir en champs
 * donnerait au client la possibilité de casser un rendu réglé au pixel, sans
 * lui offrir quoi que ce soit d'utile en échange.
 */
export const schemaMegaErp = z.object({
  badge: bref(30, "Le badge"),
  titre: bref(90, "Le titre"),
  accroche: paragraphe(220, "L'accroche"),
  bouton_visite: bref(40, "Le libellé du bouton de visite"),
});

/* ========================================================================= */
/* accueil.pourquoi-nous                                                     */
/* ========================================================================= */

/**
 * UNE SEULE SOURCE POUR DEUX AFFICHAGES.
 *
 * La section a deux variantes -- l'empilement au défilement sur grand écran,
 * des cartes qui se suivent sur téléphone -- et chacune portait sa propre copie
 * des textes. Rien n'empêchait les deux de diverger : corriger une faute d'un
 * côté la laissait de l'autre, invisible depuis un ordinateur.
 *
 * Les teintes et l'icône restent des choix d'affichage, mais vivent ici : elles
 * accompagnent chaque carte et n'ont de sens qu'avec elle.
 */
export const schemaPourquoiNous = z.object({
  surtitre: bref(40, "Le surtitre"),
  titre: bref(90, "Le titre"),
  pilule_engagements: bref(30, "Le libellé de la pilule"),

  cartes: z
    .array(
      z.object({
        titre: bref(60, "Le titre de la carte"),
        texte: paragraphe(200, "Le texte de la carte"),
        teinte: z.enum(["vert", "orange", "violet", "bleu"], {
          message: "Teinte inconnue : vert, orange, violet ou bleu.",
        }),
        /* De quel côté la carte est épinglée pendant l'empilement. */
        pin: z.enum(["gauche", "droite"], { message: "Côté inconnu : gauche ou droite." }),
      })
    )
    /* Quatre exactement : l'empilement décale chaque carte de 32 px, et le
       point d'arrêt de la dernière est calculé sur ce compte. */
    .length(4, "L'empilement présente exactement quatre cartes."),

  engagements: z
    .array(
      z.object({
        titre: bref(60, "Le titre de l'engagement"),
        texte: paragraphe(200, "Le texte de l'engagement"),
        icone: z.enum(["calendrier", "bouclier", "boussole", "ampoule"], {
          message: "Icône inconnue : calendrier, bouclier, boussole ou ampoule.",
        }),
      })
    )
    .length(4, "La section présente exactement quatre engagements."),
});

/* ========================================================================= */
/* accueil.sections-libres                                                   */
/* ========================================================================= */

/**
 * TROIS GABARITS, PAS DAVANTAGE.
 *
 * Le client doit pouvoir ajouter quelque chose de nouveau sans appeler un
 * développeur — une offre, un événement, un partenariat. Mais lui donner un
 * éditeur libre reviendrait à lui laisser casser une mise en page réglée au
 * pixel, avec un résultat qui ne ressemblerait plus au reste du site.
 *
 * Trois modèles soignés couvrent l'essentiel de ce qu'on veut annoncer :
 *
 *   · TEXTE ET IMAGE — un argument développé, illustré. Le cas d'une nouveauté
 *     qu'on explique ;
 *   · TROIS POINTS FORTS — trois idées courtes, sans image. Le cas d'une offre
 *     qu'on résume ;
 *   · ANNONCE — un titre en grand, un fichier en pleine largeur, quelques
 *     lignes. Le cas d'un événement : un prix remporté, un salon, une
 *     certification. C'est le seul gabarit qui accepte une VIDÉO aussi bien
 *     qu'une image, parce que c'est là qu'on a quelque chose à montrer.
 *
 * Un quatrième gabarit s'ajoute ici, et il apparaît dans le panel : le
 * formulaire est déduit du schéma. Mais chaque gabarit demande son rendu, et un
 * gabarit bâclé se verrait plus qu'il ne servirait.
 */

/** Une image : un fichier du dépôt, ou une image envoyée depuis le panel. */
const image = z
  .string()
  .regex(
    /^(?:[a-zA-Z0-9_-]+|\/medias\/[0-9a-f-]{36})\.(webp|png|jpg|jpeg|avif)$/,
    "Attendu : un fichier du dépôt ou une image envoyée depuis le panel."
  );

const blocTexteImage = z.object({
  gabarit: z.literal("texte-image"),
  titre: bref(90, "Le titre"),
  texte: paragraphe(600, "Le texte"),
  image,
  /* Obligatoire : c'est ce que lit un lecteur d'écran, et une image sans
     description est invisible pour qui ne la voit pas. */
  alt: bref(160, "La description de l'image"),
  /* De quel côté l'image se place. Le texte prend l'autre moitié. */
  cote: z.enum(["gauche", "droite"], { message: "Côté inconnu : gauche ou droite." }),
});

const blocTroisPoints = z.object({
  gabarit: z.literal("trois-points"),
  surtitre: bref(40, "Le surtitre"),
  titre: bref(90, "Le titre"),
  points: z
    .array(
      z.object({
        titre: bref(60, "Le titre du point"),
        texte: paragraphe(220, "Le texte du point"),
        icone: z.enum(CLES_ICONES, {
          message: `Icône inconnue. Choisissez parmi : ${CLES_ICONES.join(", ")}.`,
        }),
      })
    )
    /* Trois exactement : la grille est en trois colonnes sur bureau. Deux
       laissent un trou, quatre passent à la ligne de façon bancale. */
    .length(3, "Ce gabarit présente exactement trois points."),
});

/**
 * Un fichier : image OU vidéo.
 *
 * Les trois formes acceptées, et rien d'autre :
 *   · « prix-2026.webp »               — un fichier du dépôt ;
 *   · « /medias/<identifiant>.webp »   — une image envoyée depuis le panel ;
 *   · « /medias/<identifiant>.mp4 »    — une vidéo envoyée depuis le panel.
 *
 * Le panel déduit de cette expression qu'il doit proposer les deux
 * bibliothèques dans le même sélecteur : il la met à l'épreuve d'un exemple de
 * chaque genre. Rien n'est écrit deux fois.
 */
const imageOuVideo = z
  .string()
  .regex(
    /^(?:[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|avif)|\/medias\/[0-9a-f-]{36}\.(?:webp|png|jpg|jpeg|avif|mp4|webm))$/,
    "Attendu : une image ou une vidéo du dépôt, ou un fichier envoyé depuis le panel."
  );

const blocAnnonce = z.object({
  gabarit: z.literal("annonce"),
  /* Court et daté : « Octobre 2026 », « Prix de l'innovation ». */
  surtitre: bref(40, "Le surtitre"),
  titre: bref(120, "Le titre"),
  media: imageOuVideo,
  /* Obligatoire, image comme vidéo : c'est ce que lit un lecteur d'écran, et
     c'est aussi ce qui s'affiche si le fichier ne charge pas. */
  alt: bref(160, "La description du fichier"),
  texte: paragraphe(400, "Le texte"),
});

/* Exportés séparément : le composant qui les affiche a besoin du type d'un
   bloc précis. L'extraire à l'usage (`Extract<…, { gabarit: "texte-image" }>`)
   fonctionnait sur le papier mais donnait `never` à la compilation du projet —
   nommer les deux types règle la question sans détour. */
export type BlocTexteImage = z.infer<typeof blocTexteImage>;
export type BlocTroisPoints = z.infer<typeof blocTroisPoints>;
export type BlocAnnonce = z.infer<typeof blocAnnonce>;

export const schemaSectionsLibres = z.object({
  blocs: z
    .array(z.discriminatedUnion("gabarit", [blocTexteImage, blocTroisPoints, blocAnnonce]))
    .max(6, "Six sections libres au maximum : au-delà, la page devient interminable."),
});

/* ========================================================================= */
/* Types                                                                     */
/* ========================================================================= */

export type Chiffres = z.infer<typeof schemaChiffres>;
export type QuiSommesNous = z.infer<typeof schemaQuiSommesNous>;
export type Solutions = z.infer<typeof schemaSolutions>;
export type Avis = z.infer<typeof schemaAvis>;
export type Contact = z.infer<typeof schemaContact>;
export type Hero = z.infer<typeof schemaHero>;
export type Partenaires = z.infer<typeof schemaPartenaires>;
export type References = z.infer<typeof schemaReferences>;
export type Entete = z.infer<typeof schemaEntete>;
export type Pied = z.infer<typeof schemaPied>;
export type MegaErp = z.infer<typeof schemaMegaErp>;
export type PourquoiNous = z.infer<typeof schemaPourquoiNous>;
export type SectionsLibres = z.infer<typeof schemaSectionsLibres>;

/**
 * Les sections connues, et le schéma de chacune.
 *
 * Le greffon de build parcourt cette table : ajouter une section, c'est ajouter
 * une ligne ici. Un fichier JSON présent dans `content/accueil/` mais absent de
 * cette table fait échouer la construction — sans quoi un fichier oublié
 * resterait invisible et non validé.
 */
export const SECTIONS = {
  chiffres: schemaChiffres,
  "qui-sommes-nous": schemaQuiSommesNous,
  solutions: schemaSolutions,
  avis: schemaAvis,
  contact: schemaContact,
  hero: schemaHero,
  partenaires: schemaPartenaires,
  references: schemaReferences,
  entete: schemaEntete,
  pied: schemaPied,
  "mega-erp": schemaMegaErp,
  "pourquoi-nous": schemaPourquoiNous,
  "sections-libres": schemaSectionsLibres,
} as const;

export type CleSection = keyof typeof SECTIONS;

/**
 * Le nom affiché de chaque section, dans l'ordre de la page.
 *
 * L'ordre compte : l'éditeur présente les sections comme elles se suivent à
 * l'écran, pour qu'on les retrouve sans réfléchir. Un tri alphabétique mettrait
 * « Avis » avant « Hero ».
 *
 * Ces libellés figurent aussi dans `serveur/schema.sql`, qui crée les lignes de
 * `contenu_pages`. La duplication est assumée : le fichier SQL doit rester
 * exécutable seul, sans rien importer.
 */
export const ORDRE_SECTIONS: { cle: CleSection; libelle: string }[] = [
  { cle: "hero", libelle: "Hero" },
  { cle: "chiffres", libelle: "Chiffres" },
  { cle: "qui-sommes-nous", libelle: "Qui sommes-nous" },
  { cle: "solutions", libelle: "Solutions" },
  { cle: "mega-erp", libelle: "MEGA ERP" },
  { cle: "pourquoi-nous", libelle: "Pourquoi nous" },
  { cle: "partenaires", libelle: "Partenaires" },
  { cle: "avis", libelle: "Avis" },
  { cle: "references", libelle: "Références" },
  { cle: "contact", libelle: "Contact" },
  { cle: "entete", libelle: "En-tête" },
  { cle: "pied", libelle: "Pied de page" },
  { cle: "sections-libres", libelle: "Sections libres" },
];
