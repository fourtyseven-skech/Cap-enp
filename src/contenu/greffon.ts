import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { SECTIONS, type CleSection } from "./schemas";

/**
 * ---------------------------------------------------------------------------
 * VALIDATION DU CONTENU, AU BUILD
 * ---------------------------------------------------------------------------
 *
 * Greffon Vite branché dans `vite.config.ts`. Il lit `content/accueil/*.json`
 * et interrompt la construction si un fichier ne respecte pas son schéma.
 *
 * POURQUOI AU BUILD ET PAS À L'EXÉCUTION
 * --------------------------------------
 * Valider dans le navigateur voudrait dire y embarquer Zod — une dizaine de
 * kilo-octets sur une page dont le temps de chargement a été gagné à la main —
 * pour découvrir une erreur au moment où un visiteur la subit.
 *
 * Ici, une donnée invalide ne franchit jamais la porte : le build échoue, avec
 * le nom du fichier, le champ fautif et une phrase en français.
 *
 * DEUX CONTRÔLES, PAS UN
 * ----------------------
 * On vérifie aussi qu'aucun fichier n'est ORPHELIN. Un JSON déposé dans
 * `content/accueil/` sans schéma correspondant passerait sinon inaperçu : ni
 * validé, ni lu, mais présent — et quelqu'un finirait par croire qu'il sert.
 */

const DOSSIER = "content/accueil";

/**
 * Laissé par `scripts/exporter-contenu.mjs` : la liste des sections écrites
 * depuis la base.
 *
 * Sert uniquement au message d'erreur. Corriger un fichier que le prochain
 * build va réécrire ne sert à rien : il faut corriger la base, et le message
 * doit le dire plutôt que de laisser chercher.
 */
const MANIFESTE = ".genere-depuis-la-base.json";

const sectionsDeLaBase = (): string[] => {
  try {
    return JSON.parse(readFileSync(join(DOSSIER, MANIFESTE), "utf8")).sections ?? [];
  } catch {
    return [];
  }
};

export const greffonContenu = (): Plugin => ({
  name: "megasoft-contenu",

  buildStart() {
    const depuisLaBase = sectionsDeLaBase();
    const fichiers = readdirSync(DOSSIER)
      .filter((f) => f.endsWith(".json") && f !== MANIFESTE)
      .map((f) => f.replace(/\.json$/, ""));

    const attendus = Object.keys(SECTIONS);
    const erreurs: string[] = [];

    for (const nom of fichiers) {
      if (!attendus.includes(nom)) {
        erreurs.push(
          `${DOSSIER}/${nom}.json n'a aucun schéma. Déclarez-le dans SECTIONS ` +
            `(src/contenu/schemas.ts) ou supprimez le fichier.`
        );
        continue;
      }

      const schema = SECTIONS[nom as CleSection];
      let donnees: unknown;
      try {
        donnees = JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
      } catch (e) {
        erreurs.push(`${DOSSIER}/${nom}.json : JSON illisible — ${(e as Error).message}`);
        continue;
      }

      const r = schema.safeParse(donnees);
      if (!r.success) {
        const venu = depuisLaBase.includes(`${nom}.json`)
          ? " (section écrite depuis la base : corrigez-la dans le panel, pas dans le fichier)"
          : "";
        for (const souci of r.error.issues) {
          const champ = souci.path.join(".");
          erreurs.push(
            `${DOSSIER}/${nom}.json${champ ? ` · ${champ}` : ""} : ${souci.message}${venu}`
          );
        }
      }
    }

    for (const nom of attendus) {
      if (!fichiers.includes(nom)) {
        erreurs.push(`${DOSSIER}/${nom}.json est absent alors qu'un schéma l'attend.`);
      }
    }

    if (erreurs.length) {
      this.error(
        `\n\nContenu invalide — ${erreurs.length} problème(s) :\n\n` +
          erreurs.map((e, i) => `  ${i + 1}. ${e}`).join("\n") +
          "\n"
      );
    }

    this.info(`contenu : ${fichiers.length} section(s) valide(s)`);
  },
});
