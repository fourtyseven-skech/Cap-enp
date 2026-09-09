import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { parametre } from "../parametre.js";
import { requete, uneLigne } from "../bd.js";
import { config } from "../config.js";
import { conflit, ErreurHttp, introuvable, invalide } from "../erreurs.js";
import { convertirEnWebp, EST_IMAGE } from "../images.js";
import { enPoids, niveauDePoids, SEUILS, type GenreMedia } from "../poids.js";
import { tracer } from "../journal.js";
import { estAdministrateur, peutEcrire } from "../session.js";
import { schemaAlt, valider } from "../validation.js";

/**
 * ---------------------------------------------------------------------------
 * MÉDIAS
 * ---------------------------------------------------------------------------
 *
 * DEUX STOCKAGES, ET LA RAISON DU PARTAGE
 * ---------------------------------------
 *  · **Images** — converties en WebP puis stockées DANS la base (`contenu`).
 *    Le site est reconstruit depuis le dépôt Git : un fichier posé sur le
 *    disque du serveur ne survit pas forcément à un redéploiement ni à un
 *    changement de machine. La base est le seul endroit dont on sache qu'il
 *    persiste et qu'il est sauvegardé. En WebP, une image pèse quelques
 *    dizaines de kilo-octets — PostgreSQL les tient sans difficulté.
 *
 *  · **Vidéos et PDF** — sur le disque. Plusieurs mégaoctets par fichier en
 *    `bytea` alourdiraient chaque sauvegarde de la base et ralentiraient les
 *    requêtes qui n'en ont pas besoin.
 *
 * La contrainte `contenu_ou_chemin` du schéma impose qu'un média soit dans
 * l'un ou dans l'autre — jamais les deux, jamais aucun des deux.
 *
 * Implémente CONTRAT.md § 5.
 */

export const routesMedias = Router();

/* ========================================================================= */
/* Types acceptés                                                            */
/* ========================================================================= */

/**
 * Liste blanche, et non liste noire.
 *
 * Une liste noire oublie toujours quelque chose. Ici, ce qui n'est pas
 * explicitement prévu est refusé — un `.svg` compris, qui peut contenir du
 * JavaScript et devient une faille dès qu'il est servi depuis le même domaine.
 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
};

/**
 * Signatures de fichiers, lues dans les premiers octets.
 *
 * Le type annoncé par le navigateur et l'extension viennent tous deux du
 * client : un fichier renommé en `.jpg` reste ce qu'il est. On vérifie donc le
 * CONTENU. C'est la seule des trois indications qu'on ne puisse pas mentir.
 */
const reconnaitre = (o: Buffer): string | null => {
  const hex = (n: number, l: number) => o.subarray(n, n + l).toString("hex");
  const ascii = (n: number, l: number) => o.subarray(n, n + l).toString("ascii");

  if (hex(0, 3) === "ffd8ff") return "image/jpeg";
  if (hex(0, 8) === "89504e470d0a1a0a") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftypavif") return "image/avif";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (ascii(4, 4) === "ftyp") return "video/mp4";
  if (hex(0, 4) === "1a45dfa3") return "video/webm";
  if (ascii(0, 4) === "%PDF") return "application/pdf";
  return null;
};

const televersement = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.medias.poidsMaxOctets, files: 1 },
});

/* ========================================================================= */
/* Lecture                                                                   */
/* ========================================================================= */

/**
 * `contenu` n'est JAMAIS renvoyé dans une liste.
 *
 * Trente images de 80 Ko feraient une réponse JSON de plusieurs mégaoctets,
 * encodée en base64 — soit un tiers de plus — pour afficher une grille de
 * vignettes. Les octets se demandent un par un, sur la route dédiée.
 */
const CHAMPS = `id::text, nom, type_mime, type_origine, taille, largeur, hauteur,
                duree, chemin, alt, declinaisons, ajoute_le,
                (contenu IS NOT NULL) AS en_base`;

type LigneMedia = { id: string; chemin: string | null; en_base: boolean };

/**
 * L'adresse publique d'un média sur le site construit.
 *
 * Relative, jamais absolue : une URL absolue rendrait la base inutilisable le
 * jour d'un changement de domaine. C'est cette adresse que l'export recopie
 * dans `public/medias/` avant la construction du site.
 *
 * PLATE, MÊME POUR LES FICHIERS SUR DISQUE
 * ----------------------------------------
 * Sur le disque, une vidéo est rangée dans un sous-dossier de deux caractères
 * (`ab/<identifiant>.mp4`) pour qu'aucun répertoire ne contienne des milliers
 * d'entrées. Ce découpage est un détail de STOCKAGE : l'adresse publique n'en
 * porte pas la trace.
 *
 * Sans cela, le mode serveur produirait « /medias/ab/<id>.mp4 » quand le mode
 * local produit « /medias/<id>.mp4 » — deux formes pour la même chose, dont une
 * seule passerait la validation du contenu. C'est exactement le défaut réparé
 * au lot 1 : un panel qui enregistre ce que la construction refuse.
 */
const adressePublique = (m: LigneMedia) =>
  m.en_base ? `/medias/${m.id}.webp` : `/medias/${m.id}${extname(m.chemin ?? "")}`;

const avecUrl = <T extends LigneMedia>(m: T) => ({ ...m, url: adressePublique(m) });

routesMedias.get("/", async (_req, res) => {
  const l = await requete<LigneMedia>(`SELECT ${CHAMPS} FROM medias ORDER BY ajoute_le DESC`);
  res.json(l.map(avecUrl));
});

/**
 * Les octets d'une image stockée en base.
 *
 * Sert l'aperçu du panel. Le site public, lui, ne passe jamais par ici : les
 * fichiers sont recopiés dans `public/medias/` au moment de la construction, et
 * servis comme n'importe quel fichier statique.
 */
routesMedias.get("/:id/fichier", async (req, res) => {
  const m = await uneLigne<{ contenu: Buffer | null; type_mime: string }>(
    `SELECT contenu, type_mime FROM medias WHERE id = $1`,
    [parametre(req, "id")]
  );
  if (!m?.contenu) throw introuvable("Ce média n'est pas stocké en base.");

  res.setHeader("Content-Type", m.type_mime);
  // Le contenu d'un identifiant donné ne change jamais : un nouvel envoi crée
  // un nouvel identifiant. Le cache peut donc être long et sans condition.
  res.setHeader("Cache-Control", "private, max-age=86400, immutable");
  res.send(m.contenu);
});

/* ========================================================================= */
/* Le poids assumé                                                           */
/* ========================================================================= */

/**
 * Un fichier au-delà du seuil rouge n'entre qu'accompagné d'une acceptation.
 *
 * POURQUOI REFUSER PLUTÔT QU'AVERTIR
 * ----------------------------------
 * Un avertissement se ferme sans être lu. Ici l'envoi échoue, le panel affiche
 * la case à cocher qui nomme la taille réelle, et le second envoi porte la
 * phrase acceptée. Deux gestes au lieu d'un — c'est le but : le fichier lourd
 * doit être un choix, pas un accident.
 *
 * POURQUOI LE REFUS EST ICI ET PAS DANS LE NAVIGATEUR
 * ---------------------------------------------------
 * Le panel connaît les mêmes seuils et prévient à l'avance, mais un contrôle
 * qui vit dans le navigateur ne contrôle rien : il suffit de ne pas passer par
 * le navigateur. C'est cette fonction qui refuse réellement.
 */
const exigerAcceptation = (genre: GenreMedia, octets: number, assume: string | null) => {
  if (niveauDePoids(genre, octets) !== "rouge" || assume) return;

  throw new ErreurHttp(
    "fichier_trop_lourd",
    `Ce fichier pèse ${enPoids(octets)}${genre === "image" ? " après conversion" : ""}, ` +
      `au-delà de ${enPoids(SEUILS[genre].rouge)}. ` +
      `Il peut être publié, mais l'acceptation doit être explicite : ` +
      `cochez la case pour confirmer et renvoyez-le.`
  );
};

/**
 * Ce que le journal retient du poids.
 *
 * Le journal est inaltérable (règles `DO INSTEAD NOTHING` de `schema.sql`) :
 * une acceptation qui y entre ne peut plus en sortir. C'est précisément ce
 * qu'on veut d'une responsabilité — l'acteur, la taille et la date sont déjà
 * inscrits par `tracer`.
 */
const mentionDuPoids = (genre: GenreMedia, octets: number, assume: string | null) => {
  const niveau = niveauDePoids(genre, octets);
  if (niveau === "rouge" && assume) return ` · POIDS ASSUMÉ (${enPoids(octets)}) : « ${assume} »`;
  if (niveau === "orange") return ` · au-dessus du seuil conseillé (${enPoids(octets)})`;
  return "";
};

/* ========================================================================= */
/* Envoi                                                                     */
/* ========================================================================= */

routesMedias.post("/", peutEcrire, televersement.single("fichier"), async (req, res) => {
  const f = req.file;
  if (!f) throw invalide("Aucun fichier n'a été reçu.");

  const reel = reconnaitre(f.buffer);
  if (!reel || !EXTENSIONS[reel]) {
    throw invalide(
      "Ce type de fichier n'est pas accepté. Formats admis : JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, PDF."
    );
  }

  const id = randomUUID();
  const nomAffiche =
    (f.originalname || "fichier").replace(/[/\\]/g, "").slice(0, 200) || "fichier";
  const alt = (req.body?.alt as string | undefined)?.slice(0, 300) ?? null;

  /*
   * La phrase cochée par l'utilisateur pour un fichier lourd.
   *
   * Elle est reprise telle qu'elle a été envoyée, mais elle ne décide de rien :
   * c'est le serveur qui pèse le fichier et qui juge si une acceptation était
   * requise. Un client qui enverrait la phrase sans qu'elle soit nécessaire
   * n'obtiendrait rien de plus.
   */
  const assume = (req.body?.poids_assume as string | undefined)?.slice(0, 400)?.trim() || null;

  let media: LigneMedia | null;

  if (EST_IMAGE.has(reel)) {
    /* ------------------------------------------------ image : WebP en base */

    const image = await convertirEnWebp(f.buffer, reel);

    /* Le poids jugé est celui d'APRÈS conversion : une photo de 4 Mo prise au
       téléphone en fait 120 Ko en WebP, et refuser sur les 4 Mo d'origine
       serait une fausse alerte. Le refus tombe avant l'écriture en base : rien
       n'est stocké tant que la responsabilité n'est pas prise. */
    exigerAcceptation("image", image.taille, assume);

    media = await uneLigne<LigneMedia>(
      `INSERT INTO medias
         (id, nom, type_mime, type_origine, taille, largeur, hauteur,
          contenu, chemin, alt, declinaisons, ajoute_par)
       VALUES ($1, $2, 'image/webp', $3, $4, $5, $6, $7, NULL, $8, '[]'::jsonb, $9)
       RETURNING ${CHAMPS}`,
      [id, nomAffiche, reel, image.taille, image.largeur, image.hauteur,
       image.octets, alt, req.utilisateur!.id]
    );

    const gain = Math.max(0, Math.round((1 - image.taille / f.size) * 100));
    await tracer(
      req,
      "media-ajout",
      nomAffiche,
      `${reel} vers WebP, ${Math.round(f.size / 1024)} Ko vers ${Math.round(image.taille / 1024)} Ko (-${gain} %)` +
        mentionDuPoids("image", image.taille, assume)
    );
  } else {
    /* --------------------------------------------- vidéo, PDF : sur disque */

    /*
     * Le nom du fichier stocké ne vient JAMAIS de celui envoyé : un nom fourni
     * par le client peut contenir « ../ », des caractères interdits, ou viser
     * un fichier existant.
     *
     * Deux niveaux de sous-dossiers : quelques milliers de fichiers dans un
     * seul répertoire rendent les opérations du système de fichiers lentes.
     */
    /* Aucune conversion possible ici — `ffmpeg` n'est pas garanti sur
       l'hébergement. Le fichier est donc jugé tel quel, avant d'être écrit sur
       le disque. */
    if (reel.startsWith("video/")) exigerAcceptation("video", f.size, assume);

    const seau = id.slice(0, 2);
    const nomStocke = `${id}${EXTENSIONS[reel]}`;
    await mkdir(join(config.medias.chemin, seau), { recursive: true });
    await writeFile(join(config.medias.chemin, seau, nomStocke), f.buffer);

    media = await uneLigne<LigneMedia>(
      `INSERT INTO medias
         (id, nom, type_mime, type_origine, taille, contenu, chemin, alt,
          declinaisons, ajoute_par)
       VALUES ($1, $2, $3, $3, $4, NULL, $5, $6, '[]'::jsonb, $7)
       RETURNING ${CHAMPS}`,
      [id, nomAffiche, reel, f.size, `${seau}/${nomStocke}`, alt, req.utilisateur!.id]
    );

    await tracer(
      req,
      "media-ajout",
      nomAffiche,
      `${reel}, ${Math.round(f.size / 1024)} Ko, sur disque` +
        (reel.startsWith("video/") ? mentionDuPoids("video", f.size, assume) : "")
    );
  }

  res.status(201).json(avecUrl(media!));
});

/* ========================================================================= */
/* Description et suppression                                                */
/* ========================================================================= */

routesMedias.patch("/:id", peutEcrire, async (req, res) => {
  const { alt } = valider(schemaAlt, req.body);
  const m = await uneLigne<LigneMedia>(
    `UPDATE medias SET alt = $2 WHERE id = $1 RETURNING ${CHAMPS}`,
    [parametre(req, "id"), alt]
  );
  if (!m) throw introuvable("Ce média n'existe pas.");
  res.json(avecUrl(m));
});

routesMedias.delete("/:id", estAdministrateur, async (req, res) => {
  const id = parametre(req, "id");

  const m = await uneLigne<{ chemin: string | null; nom: string; en_base: boolean }>(
    `SELECT chemin, nom, (contenu IS NOT NULL) AS en_base FROM medias WHERE id = $1`,
    [id]
  );
  if (!m) throw introuvable("Ce média n'existe pas.");

  /*
   * Un média encore utilisé ne se supprime pas.
   *
   * On cherche son adresse publique dans le corps des articles et dans le
   * contenu des pages. Supprimer sans ce contrôle laisserait une image cassée
   * quelque part sur le site, et personne ne s'en apercevrait avant un visiteur.
   */
  const url = adressePublique({ id, chemin: m.chemin, en_base: m.en_base });
  const utilise = await uneLigne<{ ou: string }>(
    `SELECT 'un article' AS ou FROM articles
      WHERE NOT supprime AND (corps LIKE $1 OR exergue LIKE $1)
      UNION ALL
     SELECT 'une section de la page d''accueil' AS ou FROM contenu_pages
      WHERE donnees::text LIKE $1 OR COALESCE(brouillon::text, '') LIKE $1
      LIMIT 1`,
    [`%${url}%`]
  );
  if (utilise) {
    throw conflit(
      `Ce média est encore utilisé dans ${utilise.ou}. Retirez-le d'abord, puis supprimez-le.`
    );
  }

  await requete(`DELETE FROM medias WHERE id = $1`, [id]);

  // Le fichier part APRÈS la ligne : si l'effacement du disque échoue, on
  // laisse un fichier orphelin — gênant, mais sans conséquence. L'inverse
  // laisserait une entrée pointant vers un fichier disparu, donc une image
  // cassée pour le visiteur.
  if (m.chemin) {
    await unlink(join(config.medias.chemin, m.chemin)).catch(() => undefined);
  }

  await tracer(req, "media-suppression", m.nom);
  res.sendStatus(204);
});

/* ========================================================================= */
/* Erreurs de multer                                                         */
/* ========================================================================= */

/**
 * Multer lève ses propres erreurs, hors de notre hiérarchie. Sans cette
 * traduction, un fichier trop lourd donnerait une erreur 500 illisible au lieu
 * du 413 prévu par le contrat.
 */
routesMedias.use((e: unknown, _req: Request, _res: Response, suivant: NextFunction) => {
  if (e instanceof multer.MulterError) {
    if (e.code === "LIMIT_FILE_SIZE") {
      const mo = Math.round(config.medias.poidsMaxOctets / 1024 / 1024);
      return suivant(
        new ErreurHttp(
          "fichier_trop_lourd",
          `Ce fichier dépasse la taille autorisée (${mo} Mo). Compressez-le avant de l'envoyer.`
        )
      );
    }
    return suivant(new ErreurHttp("donnees_invalides", "L'envoi du fichier a échoué."));
  }
  suivant(e);
});
