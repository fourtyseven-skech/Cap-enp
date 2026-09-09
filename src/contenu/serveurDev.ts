import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { ORDRE_SECTIONS, SECTIONS, type CleSection } from "./schemas";

/**
 * ---------------------------------------------------------------------------
 * L'ÉDITEUR EN MODE LOCAL
 * ---------------------------------------------------------------------------
 *
 * Deux routes ajoutées au serveur de DÉVELOPPEMENT, qui laissent le panel lire
 * et écrire `content/accueil/*.json` directement sur le disque.
 *
 * POURQUOI
 * --------
 * Un navigateur ne peut pas écrire de fichier — c'est toute la raison d'être du
 * serveur qu'on a construit. Mais pendant le développement, Vite tourne déjà et
 * a, lui, accès au disque. Quelques lignes suffisent donc à obtenir un éditeur
 * local, sans base ni API.
 *
 * Trois usages, tous réels :
 *
 *   · modifier le contenu du site sans monter PostgreSQL ;
 *   · montrer l'éditeur au client avant qu'aucun accès ne soit fourni ;
 *   · continuer à travailler si l'hébergement pose problème.
 *
 * L'interface est exactement la même qu'en mode serveur : le panel ne sait pas
 * lequel des deux il utilise.
 *
 * ⚠️ CES ROUTES N'EXISTENT QU'EN DÉVELOPPEMENT
 * -------------------------------------------
 * `configureServer` n'est appelé que par `vite dev`. Elles sont donc absentes
 * du site construit — ce qui est indispensable : elles n'ont AUCUNE
 * authentification, et écrivent dans le dépôt sans rien demander.
 */

const DOSSIER = "content/accueil";
const PREFIXE = "/__contenu";

const lireSection = (cle: CleSection) => ({
  cle,
  libelle: ORDRE_SECTIONS.find((s) => s.cle === cle)?.libelle ?? cle,
  donnees: JSON.parse(readFileSync(join(DOSSIER, `${cle}.json`), "utf8")) as Record<string, unknown>,
});

export const serveurContenuDev = (): Plugin => ({
  name: "megasoft-contenu-dev",
  apply: "serve",

  configureServer(serveur) {
    serveur.middlewares.use(PREFIXE, async (req, res) => {
      const repondre = (code: number, corps: unknown) => {
        res.statusCode = code;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(corps));
      };

      /* ------------------------------------------- toutes les sections */
      if (req.method === "GET") {
        try {
          repondre(200, ORDRE_SECTIONS.map((s) => lireSection(s.cle)));
        } catch (e) {
          repondre(500, { message: `Lecture impossible : ${(e as Error).message}` });
        }
        return;
      }

      /* --------------------------------------------- écriture d'une section */
      if (req.method === "PUT") {
        const cle = decodeURIComponent((req.url ?? "").replace(/^\//, "").split("?")[0]);

        if (!(cle in SECTIONS)) {
          repondre(404, { message: `Section inconnue : ${cle}` });
          return;
        }

        const morceaux: Buffer[] = [];
        for await (const m of req) morceaux.push(m as Buffer);

        let donnees: unknown;
        try {
          donnees = JSON.parse(Buffer.concat(morceaux).toString("utf8"));
        } catch {
          repondre(400, { message: "Corps illisible." });
          return;
        }

        /*
         * On valide AVANT d'écrire.
         *
         * Sans ce contrôle, une saisie invalide partirait dans le fichier et
         * ferait échouer la reconstruction — le panel afficherait « enregistré »
         * pendant que le site refuserait de se construire.
         */
        const r = SECTIONS[cle as CleSection].safeParse(donnees);
        if (!r.success) {
          const souci = r.error.issues[0];
          repondre(400, {
            message: souci?.message ?? "Contenu invalide.",
            champ: souci?.path.join(".") ?? "",
          });
          return;
        }

        try {
          writeFileSync(
            join(DOSSIER, `${cle}.json`),
            JSON.stringify(r.data, null, 2) + "\n",
            "utf8"
          );
        } catch (e) {
          repondre(500, { message: `Écriture impossible : ${(e as Error).message}` });
          return;
        }

        repondre(200, lireSection(cle as CleSection));
        return;
      }

      repondre(405, { message: "Méthode non autorisée." });
    });
  },
});
