import { SECTIONS } from "../src/contenu/schemas";
import { champsDe } from "../src/contenu/champs";

/**
 * Contrôle de la déduction des champs.
 *
 *     npx tsx scripts/verifier-champs.mts
 *
 * Une section qui ne produirait aucun champ, ou dont un champ manquerait, se
 * traduirait par un formulaire incomplet dans le panel — sans erreur, et sans
 * que rien ne signale la donnée devenue inaccessible.
 */
let total = 0;
const vides: string[] = [];

for (const [cle, schema] of Object.entries(SECTIONS)) {
  const champs = champsDe(schema);
  total += champs.length;
  if (!champs.length) vides.push(cle);

  const detail = champs
    .map((c) =>
      c.genre === "objets"
        ? `${c.cle}[${c.fige ? c.mini : `${c.mini}-${c.maxi}`}]{${c.champs.map((x) => x.cle).join(",")}}`
        : `${c.cle}:${c.genre}`
    )
    .join("  ");
  console.log(`${cle.padEnd(17)} ${String(champs.length).padStart(2)}  ${detail}`);
}

console.log(`\n${total} champs sur ${Object.keys(SECTIONS).length} sections`);
if (vides.length) {
  console.error(`\n✖ Sections sans aucun champ : ${vides.join(", ")}\n`);
  process.exit(1);
}
