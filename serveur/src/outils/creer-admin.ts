import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pool, uneLigne } from "../bd.js";
import { verifierConfig } from "../config.js";
import { hacher } from "../session.js";

/**
 * ---------------------------------------------------------------------------
 * CRÉATION DU PREMIER ADMINISTRATEUR
 * ---------------------------------------------------------------------------
 *
 *     npm run creer-admin
 *
 * POURQUOI UNE COMMANDE ET PAS UN « INSERT » DANS schema.sql
 * ----------------------------------------------------------
 * Une empreinte de mot de passe écrite en dur dans un fichier versionné est un
 * mot de passe public : elle part dans le dépôt, dans les sauvegardes, et sur
 * la machine de tous ceux qui clonent le projet.
 *
 * Le mot de passe est également saisi ICI plutôt que passé en argument : un
 * argument de ligne de commande reste dans l'historique du shell et se lit
 * dans la liste des processus tant que la commande tourne.
 *
 * La saisie est masquée — pas d'écho à l'écran.
 */

verifierConfig();

/** Lit une valeur sans l'afficher. `readline` n'offre pas cela nativement. */
const demanderSecret = async (question: string): Promise<string> => {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });

  // On intercepte l'écho pour n'écrire que la question, jamais les caractères
  // tapés ensuite.
  const sortie = stdout.write.bind(stdout);
  let masquer = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (!masquer) sortie(s);
  };

  const promesse = rl.question(question);
  masquer = true;
  const reponse = await promesse;
  masquer = false;
  stdout.write("\n");
  rl.close();
  return reponse;
};

const principal = async () => {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("\n— Création d'un administrateur du panel Megasoft —\n");

  const dejaLa = await uneLigne<{ n: string }>(
    `SELECT count(*)::text AS n FROM utilisateurs WHERE role = 'administrateur'`
  );
  if (Number(dejaLa?.n ?? 0) > 0) {
    console.log(
      `⚠ ${dejaLa?.n} administrateur(s) existe(nt) déjà. Cette commande en ajoutera un autre.\n`
    );
  }

  const nom = (await rl.question("Nom complet      : ")).trim();
  const email = (await rl.question("Adresse e-mail   : ")).trim().toLowerCase();
  rl.close();

  if (!nom || !email.includes("@")) {
    console.error("\n✖ Nom et adresse e-mail valides sont obligatoires.\n");
    process.exit(1);
  }

  const existe = await uneLigne(`SELECT 1 FROM utilisateurs WHERE lower(email) = $1`, [email]);
  if (existe) {
    console.error(`\n✖ Un compte utilise déjà l'adresse ${email}.\n`);
    process.exit(1);
  }

  const mdp = await demanderSecret("Mot de passe     : ");
  const confirmation = await demanderSecret("Confirmation     : ");

  if (mdp !== confirmation) {
    console.error("\n✖ Les deux saisies diffèrent.\n");
    process.exit(1);
  }

  /*
   * Douze caractères minimum, et rien d'autre.
   *
   * Pas d'exigence de majuscule, de chiffre ni de symbole : ces règles
   * produisent surtout des mots de passe du type « Megasoft2026! », courts et
   * devinables. La longueur est le seul critère qui améliore réellement la
   * résistance à une attaque hors ligne.
   */
  if (mdp.length < 12) {
    console.error(
      "\n✖ Douze caractères au minimum. Une phrase dont vous vous souvenez vaut\n" +
        "  mieux qu'une suite compliquée que vous finirez par noter quelque part.\n"
    );
    process.exit(1);
  }

  const u = await uneLigne<{ email: string }>(
    `INSERT INTO utilisateurs (nom, email, role, empreinte_mdp)
     VALUES ($1, $2, 'administrateur', $3) RETURNING email`,
    [nom, email, await hacher(mdp)]
  );

  console.log(`\n✓ Administrateur créé : ${u?.email}\n`);
  await pool.end();
};

principal().catch(async (e) => {
  console.error("\n✖", e instanceof Error ? e.message : e, "\n");
  await pool.end().catch(() => undefined);
  process.exit(1);
});
