import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { load } from "js-yaml";
import { pool, requete, uneLigne } from "../bd.js";
import { verifierConfig } from "../config.js";

/**
 * ---------------------------------------------------------------------------
 * LE PONT, DANS L'AUTRE SENS : DES FICHIERS VERS LA BASE
 * ---------------------------------------------------------------------------
 *
 *     npm run importer-fichiers
 *
 * Opération de MIGRATION, à lancer une seule fois, le jour de la mise en
 * service. Elle lit `content/blog/*.md` et les installe en base.
 *
 * POURQUOI ELLE EST INDISPENSABLE
 * -------------------------------
 * Une fois `VITE_API_URL` déclarée, le panel ne lit plus les fichiers du dépôt
 * : il n'affiche que ce que le serveur lui renvoie. Sans cette migration, la
 * Direction ouvrirait un panel vide alors que six articles sont en ligne — et
 * la première publication depuis le panel les effacerait tous du site, le pont
 * inverse ne trouvant rien à réécrire.
 *
 * SANS EFFET SI RELANCÉE
 * ----------------------
 * Un article dont le slug existe déjà en base est ignoré, jamais écrasé. On
 * peut donc relancer la commande sans risque — y compris après avoir modifié
 * des articles depuis le panel.
 */

verifierConfig();

const DOSSIER = resolve(process.cwd(), "..", "content", "blog");

type Entete = Record<string, unknown>;

/** Sépare l'en-tête YAML du corps Markdown — même découpage que `src/lib/blog.ts`. */
const separer = (brut: string): { entete: Entete; corps: string } => {
  const texte = brut.replace(/^﻿/, "");
  if (!texte.startsWith("---")) return { entete: {}, corps: texte };

  const fin = texte.indexOf("\n---", 3);
  if (fin === -1) return { entete: {}, corps: texte };

  const entete = (load(texte.slice(texte.indexOf("\n") + 1, fin)) as Entete) ?? {};
  const corps = texte.slice(fin + 4).replace(/^[^\n]*\r?\n?/, "");
  return { entete, corps };
};

/**
 * YAML transforme `2026-08-13` en objet Date. La base attend « AAAA-MM-JJ ».
 *
 * On passe par les composantes UTC et non par `toISOString()` : une date sans
 * heure est interprétée à minuit UTC, et une conversion en heure locale
 * française la ferait reculer d'un jour en hiver.
 */
const enDate = (v: unknown): string | null => {
  if (v instanceof Date) {
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const j = String(v.getUTCDate()).padStart(2, "0");
    return `${v.getUTCFullYear()}-${m}-${j}`;
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
};

const texte = (v: unknown, defaut = ""): string =>
  typeof v === "string" ? v : v == null ? defaut : String(v);

const principal = async () => {
  console.log(`\n— Import des articles depuis ${DOSSIER} —\n`);

  let fichiers: string[];
  try {
    fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".md"));
  } catch {
    console.error(`✖ Dossier introuvable : ${DOSSIER}\n`);
    process.exit(1);
  }

  let importes = 0;
  let ignores = 0;

  for (const nom of fichiers) {
    const { entete, corps } = separer(readFileSync(join(DOSSIER, nom), "utf8"));
    const slug = texte(entete.slug) || nom.replace(/\.md$/, "");

    const existe = await uneLigne(`SELECT 1 FROM articles WHERE slug = $1`, [slug]);
    if (existe) {
      console.log(`  · ${slug} — déjà en base, ignoré`);
      ignores += 1;
      continue;
    }

    /*
     * `archive` est un statut dans les fichiers, une colonne dans la base.
     * On traduit : l'article passe en brouillon et porte le drapeau.
     */
    const statutFichier = texte(entete.statut, "brouillon");
    const archive = statutFichier === "archive";
    const statut = archive ? "brouillon" : statutFichier;

    const publieLe = enDate(entete.publie_le);

    // La contrainte `date_si_datee` refuserait un article publié sans date.
    // Mieux vaut le signaler ici, avec le nom du fichier, qu'une erreur
    // PostgreSQL au milieu d'une boucle.
    if ((statut === "publie" || statut === "programme") && !publieLe) {
      console.warn(`  ⚠ ${slug} — publié sans date de parution, importé en brouillon`);
    }

    const etiquettes = Array.isArray(entete.etiquettes)
      ? entete.etiquettes.map((e) => String(e))
      : texte(entete.etiquettes)
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);

    await requete(
      `INSERT INTO articles
        (slug, titre, chapeau, corps, categorie, format, accent, motif,
         titre_fantome, reponse, version, exergue, meta_description, auteur,
         etiquettes, faq, statut, publie_le, maquette, archive, image, maj_le)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
               COALESCE($22::date, now()))`,
      [
        slug,
        texte(entete.titre, slug),
        texte(entete.chapeau),
        corps.trim(),
        texte(entete.categorie),
        texte(entete.format, "fond"),
        entete.accent ? texte(entete.accent) : null,
        entete.motif ? texte(entete.motif) : null,
        texte(entete.titre_fantome),
        texte(entete.reponse),
        texte(entete.version),
        texte(entete.exergue),
        texte(entete.meta_description),
        texte(entete.auteur, "Équipe Megasoft"),
        etiquettes,
        JSON.stringify(entete.faq ?? []),
        publieLe ? statut : "brouillon",
        publieLe,
        entete.maquette === true,
        archive,
        texte(entete.image),
        enDate(entete.maj_le),
      ]
    );

    console.log(`  ✓ ${slug}`);
    importes += 1;
  }

  console.log(`\n${importes} article(s) importé(s), ${ignores} ignoré(s).\n`);

  if (importes > 0) {
    console.log(
      "  Les fichiers d'origine sont laissés en place. Ils seront repris par\n" +
        "  le premier export (scripts/exporter-articles.mjs), qui leur ajoutera\n" +
        "  la marque `origine: base`.\n"
    );
  }

  await pool.end();
};

principal().catch(async (e) => {
  console.error("\n✖", e instanceof Error ? e.message : e, "\n");
  await pool.end().catch(() => undefined);
  process.exit(1);
});
