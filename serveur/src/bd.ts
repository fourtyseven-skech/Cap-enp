import pg from "pg";
import { config } from "./config.js";

/**
 * ---------------------------------------------------------------------------
 * ACCÈS À LA BASE
 * ---------------------------------------------------------------------------
 *
 * `pg` seul, sans ORM. Le schéma est écrit à la main, connu, et stable : un
 * ORM n'apporterait ici qu'une couche de plus à comprendre, et masquerait les
 * requêtes au moment où l'on cherche pourquoi l'une d'elles est lente.
 *
 * ⚠️ RÈGLE ABSOLUE : aucune valeur ne se concatène dans une requête. Toutes
 * passent par les paramètres `$1`, `$2`… C'est la seule protection réellement
 * fiable contre l'injection SQL, et elle ne souffre aucune exception « juste
 * pour ce cas-là ».
 */

const { Pool } = pg;

/*
 * PostgreSQL renvoie les `numeric` sous forme de chaîne, parce qu'ils peuvent
 * dépasser la précision d'un nombre JavaScript. Ici, le seul `numeric` est la
 * durée d'une vidéo en secondes : aucun risque de dépassement, et le panel
 * attend un nombre. On convertit donc à la lecture.
 *
 * 1700 est l'identifiant du type `numeric` dans PostgreSQL.
 */
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const pool = new Pool({
  connectionString: config.bd.url,
  // `rejectUnauthorized: false` accepte un certificat auto-signé, ce que
  // proposent beaucoup d'hébergements mutualisés. La connexion reste chiffrée.
  ssl: config.bd.ssl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (e) => {
  // Une connexion inactive coupée par le serveur de base est un événement
  // normal ; sans ce gestionnaire, Node considère l'erreur comme non
  // rattrapée et arrête le processus.
  console.error("[bd] connexion inactive perdue :", e.message);
});

/** Une requête. Les valeurs passent TOUJOURS par `params`. */
export const requete = async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> => {
  const r = await pool.query<T>(sql, params);
  return r.rows;
};

/** Une requête dont on attend au plus une ligne. */
export const uneLigne = async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> => {
  const lignes = await requete<T>(sql, params);
  return lignes[0] ?? null;
};

/**
 * Exécute plusieurs requêtes dans une transaction.
 *
 * Indispensable dès qu'une opération touche deux tables : enregistrer un
 * article ET ajouter sa version, par exemple. Sans transaction, une panne
 * entre les deux laisse un article sans historique, et personne ne s'en
 * aperçoit avant d'en avoir besoin.
 */
export const transaction = async <T>(
  travail: (client: pg.PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await travail(client);
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
};

/** Vérifie que la base répond et que le schéma est installé. */
export const verifierBase = async () => {
  const t = await requete<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [["utilisateurs", "articles", "contenu_pages", "journal", "medias", "publications"]]
  );

  if (t.length < 6) {
    const presentes = new Set(t.map((x) => x.table_name));
    const absentes = ["utilisateurs", "articles", "contenu_pages", "journal", "medias", "publications"]
      .filter((n) => !presentes.has(n));
    throw new Error(
      `Le schéma n'est pas installé — table(s) absente(s) : ${absentes.join(", ")}.\n` +
        "  Exécutez : psql -d <base> -f serveur/schema.sql"
    );
  }
};
