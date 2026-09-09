/* Compte temporaire de vérification. Créé, utilisé, supprimé. */
import { pool, requete } from "../bd.js";
import { hacher } from "../session.js";
const EMAIL = "sonde@megasoft-office.com";
const MDP = "sonde-verification-6-septembre";
if (process.argv.includes("--retirer")) {
  await requete(`DELETE FROM utilisateurs WHERE email = $1`, [EMAIL]);
  console.log("retiré");
} else {
  await requete(`DELETE FROM utilisateurs WHERE email = $1`, [EMAIL]);
  await requete(
    `INSERT INTO utilisateurs (nom, email, role, empreinte_mdp) VALUES ('Sonde', $1, 'administrateur', $2)`,
    [EMAIL, await hacher(MDP)]
  );
  console.log("créé");
}
await pool.end();
