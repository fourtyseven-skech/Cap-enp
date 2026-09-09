import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "../bd.js";
import { verifierConfig } from "../config.js";

/**
 * Installe `schema.sql` sur la base configurée.
 *
 *     npm run installer-schema
 *
 * Utile quand `psql` n'est pas disponible sur la machine — le cas courant sur
 * un poste Windows, et sur beaucoup d'hébergements mutualisés où l'on n'a que
 * Node et une chaîne de connexion.
 *
 * Le fichier étant entièrement encadré par `BEGIN` / `COMMIT`, il s'applique
 * en une seule transaction : soit tout est installé, soit rien ne l'est. Une
 * installation à moitié faite serait bien plus pénible à démêler qu'un échec
 * franc.
 */

verifierConfig();

const principal = async () => {
  const chemin = resolve(process.cwd(), "schema.sql");
  const sql = readFileSync(chemin, "utf8");

  const client = await pool.connect();
  try {
    console.log(`\nInstallation de ${chemin}…`);
    await client.query(sql);

    const t = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log(`\n✓ Schéma installé — ${t.rows[0]?.n} tables.\n`);
    console.log("  Étape suivante : npm run creer-admin\n");
  } finally {
    client.release();
    await pool.end();
  }
};

principal().catch(async (e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`\n✖ Installation interrompue : ${message}\n`);
  if (message.includes("already exists")) {
    console.error(
      "  Le schéma semble déjà installé. Pour repartir de zéro sur une base de\n" +
        "  TEST uniquement :  DROP SCHEMA public CASCADE; CREATE SCHEMA public;\n"
    );
  }
  await pool.end().catch(() => undefined);
  process.exit(1);
});
