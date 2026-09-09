import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * ---------------------------------------------------------------------------
 * L'ENVOI D'IMAGES ET DE VIDÉOS EN MODE LOCAL
 * ---------------------------------------------------------------------------
 *
 * Trois routes ajoutées au serveur de DÉVELOPPEMENT, qui donnent au panel de
 * quoi envoyer une image ou une vidéo sans base ni API.
 *
 *   GET    /__medias        la liste
 *   POST   /__medias        un envoi (le corps est le fichier brut)
 *   DELETE /__medias/<id>   une suppression
 *
 * POURQUOI CETTE ROUTE EXISTE
 * ---------------------------
 * Sans elle, le mode local sait modifier du texte mais pas ajouter une image —
 * or c'est la fonction la plus visible, et la démonstration au client se fait
 * précisément en local, avant que l'hébergement ne soit fourni.
 *
 * MÊME TRAITEMENT QUE LE SERVEUR
 * ------------------------------
 * Conversion en WebP, réduction à 2 000 px, repli sans perte si le mode avec
 * perte n'allège pas. Le code de conversion est partagé : `src/contenu/webp.ts`
 * est importé aussi bien ici que par l'API. Deux implémentations auraient fini
 * par produire deux résultats différents pour la même image.
 *
 * OÙ LES FICHIERS ATTERRISSENT
 * ----------------------------
 * Dans `content/medias/`, qui est VERSIONNÉ. Pas dans `public/medias/`, qui est
 * dérivé et vidé à chaque build de ce qu'il ne reconnaît pas.
 *
 * CE QUE CE MODE NE SAIT PAS FAIRE
 * --------------------------------
 * Journaliser. Le journal vit dans la base, et ce mode n'en a pas : une
 * acceptation de fichier lourd donnée ici n'est écrite nulle part. Le panel le
 * dit à l'écran plutôt que de laisser croire à une trace qui n'existe pas. En
 * mode serveur — le mode réel, celui du client — elle part au journal avec le
 * compte, la taille et la date.
 *
 * ⚠️ CES ROUTES N'EXISTENT QU'EN DÉVELOPPEMENT
 * -------------------------------------------
 * `apply: "serve"` : elles sont absentes du site construit. Indispensable —
 * elles n'ont aucune authentification et écrivent dans le dépôt.
 */

const DOSSIER = "content/medias";

/** Au-delà, on refuse avant même de convertir. */
const POIDS_MAX = 25 * 1024 * 1024;

/**
 * Les extensions gérées ici, et leur type.
 *
 * Les vidéos ne sont pas converties : `ffmpeg` n'est pas garanti sur
 * l'hébergement, et un transcodage qui marcherait sur ce poste sans marcher
 * chez le client serait pire que pas de transcodage du tout. Elles sont donc
 * stockées telles quelles — d'où les seuils de poids, qui prennent le relais.
 */
const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const NOM_DE_FICHIER = /^[0-9a-f-]{36}\.(webp|mp4|webm)$/;

/** La signature d'une vidéo, lue dans ses premiers octets — jamais l'extension. */
const reconnaitreVideo = (o: Buffer): ".mp4" | ".webm" | null => {
  if (o.subarray(4, 8).toString("ascii") === "ftyp") return ".mp4";
  if (o.subarray(0, 4).toString("hex") === "1a45dfa3") return ".webm";
  return null;
};

type Media = {
  id: string;
  nom: string;
  url: string;
  /* Le mode serveur renvoie ce champ : le panel s'en sert pour distinguer une
     image d'une vidéo. Les deux sources doivent se ressembler, sinon le
     sélecteur devrait savoir lequel des deux il interroge. */
  type_mime: string;
  taille: number;
  largeur: number;
  hauteur: number;
  ajoute_le: string;
};

const lister = (): Media[] => {
  mkdirSync(DOSSIER, { recursive: true });
  return readdirSync(DOSSIER)
    .filter((f) => NOM_DE_FICHIER.test(f))
    .map((f) => {
      const id = f.replace(/\.(webp|mp4|webm)$/, "");
      const s = statSync(join(DOSSIER, f));
      return {
        id,
        nom: f,
        url: `/medias/${f}`,
        type_mime: TYPES[f.slice(f.lastIndexOf("."))] ?? "application/octet-stream",
        taille: s.size,
        largeur: 0,
        hauteur: 0,
        ajoute_le: s.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.ajoute_le.localeCompare(a.ajoute_le));
};

export const serveurMediasDev = (): Plugin => ({
  name: "megasoft-medias-dev",
  apply: "serve",

  configureServer(serveur) {
    /*
     * Les fichiers de `content/medias/` sont servis sous `/medias/…`, comme ils
     * le seront une fois le site construit. Sans cela, l'aperçu du panel et la
     * page elle-même afficheraient une image cassée jusqu'au premier build.
     */
    serveur.middlewares.use("/medias", (req, res, suivant) => {
      const nom = decodeURIComponent((req.url ?? "").replace(/^\//, "").split("?")[0]);
      if (!NOM_DE_FICHIER.test(nom)) return suivant();
      try {
        const octets = statSync(join(DOSSIER, nom));
        res.setHeader("Content-Type", TYPES[nom.slice(nom.lastIndexOf("."))]!);
        res.setHeader("Content-Length", String(octets.size));
        /* Le fichier part d'un bloc, sans gestion des requêtes partielles : une
           vidéo d'aperçu se lit du début, et le site construit, lui, est servi
           par Apache qui sait le faire. */
        res.end(readFileSync(join(DOSSIER, nom)));
      } catch {
        suivant();
      }
    });

    serveur.middlewares.use("/__medias", async (req, res) => {
      const repondre = (code: number, corps: unknown) => {
        res.statusCode = code;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(corps));
      };

      if (req.method === "GET") {
        repondre(200, lister());
        return;
      }

      if (req.method === "DELETE") {
        const id = decodeURIComponent((req.url ?? "").replace(/^\//, "").split("?")[0]);
        if (!/^[0-9a-f-]{36}$/.test(id)) {
          repondre(400, { message: "Identifiant invalide." });
          return;
        }
        /* L'extension n'est pas connue de l'appelant : il ne manipule que des
           identifiants. On retire celui des trois fichiers possibles qui
           existe. */
        const trouve = Object.keys(TYPES)
          .map((ext) => join(DOSSIER, `${id}${ext}`))
          .find((chemin) => {
            try {
              return statSync(chemin).isFile();
            } catch {
              return false;
            }
          });

        if (!trouve) {
          repondre(404, { message: "Ce fichier n'existe pas." });
          return;
        }
        unlinkSync(trouve);
        repondre(200, { supprime: id });
        return;
      }

      if (req.method === "POST") {
        const morceaux: Buffer[] = [];
        let total = 0;
        for await (const m of req) {
          total += (m as Buffer).length;
          if (total > POIDS_MAX) {
            repondre(413, {
              message: `Ce fichier dépasse ${Math.round(POIDS_MAX / 1024 / 1024)} Mo.`,
            });
            return;
          }
          morceaux.push(m as Buffer);
        }

        const { convertirEnWebp, reconnaitreImage } = await import("./webp.js");
        const { niveauDePoids, enPoids, SEUILS } = await import("./poids.js");
        const octets = Buffer.concat(morceaux);

        /*
         * L'acceptation d'un fichier lourd voyage en EN-TÊTE, et non dans le
         * corps : ici le corps est le fichier brut, il n'y a pas de formulaire
         * où glisser un champ. Côté serveur c'est un champ de `FormData` — deux
         * transports, une seule règle, celle de `poids.ts`.
         */
        const assume = (req.headers["x-poids-assume"] as string | undefined)?.trim() || null;

        /** Le refus, formulé une fois pour les deux genres de fichier. */
        const refuserSiTropLourd = (genre: "image" | "video", taille: number) => {
          if (niveauDePoids(genre, taille) !== "rouge" || assume) return false;
          repondre(413, {
            message:
              `Ce fichier pèse ${enPoids(taille)}${genre === "image" ? " après conversion" : ""}, ` +
              `au-delà de ${enPoids(SEUILS[genre].rouge)}. ` +
              `Il peut être publié, mais l'acceptation doit être explicite : ` +
              `cochez la case pour confirmer et renvoyez-le.`,
            poids: taille,
            genre,
          });
          return true;
        };

        /* ------------------------------------------------------------ vidéo */

        const extensionVideo = reconnaitreVideo(octets);
        if (extensionVideo) {
          if (refuserSiTropLourd("video", octets.length)) return;

          const id = randomUUID();
          mkdirSync(DOSSIER, { recursive: true });
          writeFileSync(join(DOSSIER, `${id}${extensionVideo}`), octets);

          repondre(201, {
            id,
            nom: `${id}${extensionVideo}`,
            url: `/medias/${id}${extensionVideo}`,
            type_mime: TYPES[extensionVideo]!,
            taille: octets.length,
            largeur: 0,
            hauteur: 0,
            ajoute_le: new Date().toISOString(),
          } satisfies Media);
          return;
        }

        /* ------------------------------------------------------------ image */

        const type = reconnaitreImage(octets);
        if (!type) {
          repondre(400, {
            message:
              "Ce fichier n'est ni une image (JPEG, PNG, WebP, AVIF, GIF) " +
              "ni une vidéo (MP4, WebM) reconnue.",
          });
          return;
        }

        try {
          const image = await convertirEnWebp(octets, type);
          if (refuserSiTropLourd("image", image.taille)) return;

          const id = randomUUID();
          mkdirSync(DOSSIER, { recursive: true });
          writeFileSync(join(DOSSIER, `${id}.webp`), image.octets);

          repondre(201, {
            id,
            nom: `${id}.webp`,
            url: `/medias/${id}.webp`,
            type_mime: "image/webp",
            taille: image.taille,
            largeur: image.largeur,
            hauteur: image.hauteur,
            ajoute_le: new Date().toISOString(),
          } satisfies Media);
        } catch (e) {
          repondre(400, {
            message:
              e instanceof Error
                ? e.message
                : "Cette image n'a pas pu être traitée. Elle est peut-être endommagée.",
          });
        }
        return;
      }

      repondre(405, { message: "Méthode non autorisée." });
    });
  },
});
