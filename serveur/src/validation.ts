import { z } from "zod";
import { invalide } from "./erreurs.js";

/**
 * ---------------------------------------------------------------------------
 * VALIDATION DES ENTRÉES
 * ---------------------------------------------------------------------------
 *
 * Rien de ce qui arrive par le réseau n'est cru sur parole, y compris venant
 * du panel : le panel est du JavaScript livré au navigateur, donc modifiable
 * par celui qui l'exécute.
 *
 * Les messages sont rédigés en français et destinés à être AFFICHÉS. Un
 * « Expected string, received number » n'aide personne devant l'écran.
 */

const texte = (max: number, quoi: string) =>
  z.string().max(max, `${quoi} : ${max} caractères au maximum.`);

/**
 * Un slug est une adresse publique. On le contraint strictement : minuscules,
 * chiffres et tirets. Tout le reste finirait encodé dans l'URL, illisible dans
 * un partage, et parfois refusé par les serveurs.
 */
export const slug = z
  .string()
  .min(1, "L'adresse de l'article est obligatoire.")
  .max(120, "L'adresse de l'article est trop longue.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "L'adresse ne peut contenir que des minuscules, des chiffres et des tirets."
  );

export const statutArticle = z.enum(["brouillon", "relecture", "programme", "publie"], {
  message: "Statut inconnu.",
});

export const schemaArticle = z
  .object({
    titre: z.string().min(1, "Le titre est obligatoire.").max(200, "Titre trop long."),
    slug,
    chapeau: texte(600, "Le chapeau"),
    corps: texte(200_000, "Le corps de l'article"),
    categorie: texte(80, "La catégorie"),
    format: texte(40, "Le format"),
    accent: texte(40, "L'accent").nullable().optional(),
    motif: texte(40, "Le motif").nullable().optional(),
    titre_fantome: texte(200, "Le titre fantôme"),
    reponse: texte(2000, "La réponse"),
    version: texte(40, "La version"),
    exergue: texte(600, "L'exergue"),
    meta_description: texte(320, "La méta-description"),
    auteur: texte(120, "L'auteur"),

    /**
     * Le panel saisit les étiquettes séparées par des virgules ; la base les
     * stocke en tableau. La conversion se fait ICI, une fois, plutôt que dans
     * chaque requête de lecture.
     */
    etiquettes: z
      .union([z.string(), z.array(z.string())])
      .transform((v) =>
        (Array.isArray(v) ? v : v.split(","))
          .map((e) => e.trim())
          .filter(Boolean)
          .slice(0, 20)
      ),

    faq: z
      .array(
        z.object({
          q: texte(300, "La question"),
          r: texte(3000, "La réponse"),
        })
      )
      .max(20, "Vingt questions au maximum.")
      .default([]),

    statut: statutArticle,

    /** `AAAA-MM-JJ`, ou vide tant que l'article n'est pas daté. */
    publie_le: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ.")
      .or(z.literal(""))
      .nullable()
      .optional(),

    /*
     * La vignette. Deux formes seulement : vide, ou l'adresse publique d'une
     * image envoyée depuis le panel.
     *
     * Pas de chemin libre : ce champ finit dans une balise `<img>` et dans
     * `og:image`. Laisser saisir une adresse quelconque permettrait de faire
     * pointer la vignette d'un article Megasoft vers n'importe quoi.
     */
    image: z
      .string()
      .regex(
        /^(?:|\/medias\/[0-9a-f-]{36}\.webp)$/,
        "La vignette doit être une image envoyée depuis le panel."
      )
      .optional()
      .default(""),

    maquette: z.boolean().optional().default(false),
  })
  /*
   * Le même contrôle que la contrainte `date_si_datee` de la base.
   *
   * En double, et volontairement : la base garantit qu'aucune donnée
   * incohérente ne s'installe, quel que soit le chemin d'écriture ; ce
   * contrôle-ci donne à l'éditeur une phrase compréhensible au lieu d'une
   * erreur PostgreSQL brute.
   */
  .refine((a) => !["publie", "programme"].includes(a.statut) || !!a.publie_le, {
    message: "Un article publié ou programmé doit avoir une date de parution.",
    path: ["publie_le"],
  });

export type EntreeArticle = z.infer<typeof schemaArticle>;

export const schemaConnexion = z.object({
  email: z.string().email("Adresse e-mail invalide.").max(200),
  motDePasse: z.string().min(1, "Le mot de passe est obligatoire.").max(200),
});

/**
 * Un mot de passe CHOISI par son propriétaire.
 *
 * Douze caractères, sans autre règle. Les exigences de casse et de ponctuation
 * produisent « Megasoft2026 ! » — court, prévisible, et écrit sur un post-it.
 * La longueur, elle, protège vraiment : elle est la seule contrainte que les
 * outils de calcul de mots de passe ne contournent pas.
 *
 * Ne s'applique pas à la CONNEXION, qui accepte ce qui existe déjà en base :
 * durcir la règle ne doit pas enfermer dehors un compte créé avant elle.
 */
const motDePasseChoisi = z
  .string()
  .min(12, "Douze caractères au minimum. Une phrase courte fait un très bon mot de passe.")
  .max(200, "Deux cents caractères au maximum.");

export const schemaChangementMdp = z.object({
  actuel: z.string().min(1, "Votre mot de passe actuel est demandé.").max(200),
  nouveau: motDePasseChoisi,
});

export const schemaUtilisateur = z.object({
  nom: z.string().min(1, "Le nom est obligatoire.").max(120),
  email: z.string().email("Adresse e-mail invalide.").max(200),
  role: z.enum(["administrateur", "redacteur", "relecteur"], { message: "Rôle inconnu." }),
});

export const schemaModifUtilisateur = z.object({
  nom: z.string().min(1).max(120).optional(),
  role: z.enum(["administrateur", "redacteur", "relecteur"]).optional(),
  actif: z.boolean().optional(),
});

/**
 * Contenu d'une section de page.
 *
 * Volontairement libre à ce stade : le modèle détaillé de chaque section
 * (Hero, Chiffres, Solutions…) sera écrit au lot suivant, quand le contenu
 * aura été sorti des composants. Poser maintenant une forme inventée
 * obligerait à la défaire.
 *
 * Ce qui est déjà contrôlé : c'est bien un objet, et il ne dépasse pas une
 * taille déraisonnable — un mégaoctet de JSON dans une section signalerait
 * une erreur, pas un contenu.
 */
export const schemaContenu = z
  .record(z.string(), z.unknown())
  .refine((o) => JSON.stringify(o).length < 1_000_000, {
    message: "Ce contenu est anormalement volumineux.",
  });

export const schemaAlt = z.object({
  alt: z.string().max(300, "Le texte alternatif doit rester court.").nullable(),
});

/* ========================================================================= */

/**
 * Valide, ou lève une erreur affichable.
 *
 * Le paramètre porte sur le SCHÉMA (`S extends ZodTypeAny`) et non sur le type
 * de sortie. Avec un schéma qui transforme — `etiquettes` passe d'une chaîne à
 * un tableau —, TypeScript déduisait sinon le type d'ENTRÉE, et l'appelant
 * recevait `string | string[]` là où la transformation garantit `string[]`.
 *
 * On ne renvoie que le PREMIER message : une liste de dix erreurs dans un
 * bandeau est illisible, et l'éditeur corrige de toute façon un champ à la
 * fois.
 */
export const valider = <S extends z.ZodTypeAny>(schema: S, valeur: unknown): z.infer<S> => {
  const r = schema.safeParse(valeur);
  if (r.success) return r.data;

  const premier = r.error.issues[0];
  const champ = premier?.path.join(".");
  const message = premier?.message ?? "Données invalides.";

  throw invalide(champ ? `${message} (champ « ${champ} »)` : message);
};
