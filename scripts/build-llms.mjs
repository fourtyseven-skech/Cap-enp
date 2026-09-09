/**
 * Génération de /llms.txt.
 *
 * CE QUE C'EST. Un résumé du site en Markdown, à la racine du domaine, destiné
 * aux moteurs génératifs : qui est l'entreprise, ce qu'elle fait, et où trouver
 * l'information — sans qu'ils aient à reconstituer tout cela depuis le HTML.
 *
 * CE QU'IL FAUT EN ATTENDRE, HONNÊTEMENT. C'est une convention communautaire,
 * portée par aucun organisme de normalisation. Google a déclaré publiquement ne
 * pas la suivre et ne pas prévoir de le faire ; OpenAI ne la mentionne pas et
 * renvoie vers robots.txt. En revanche Anthropic (Claude) et Perplexity la
 * lisent réellement et s'en servent pour choisir les pages à consulter. Le
 * fichier ne coûte presque rien, il sert deux moteurs sur quatre : il est écrit
 * pour eux, pas comme un levier de référencement classique.
 *
 * ⚠️ Ce fichier est GÉNÉRÉ. Il tire son contenu de la FAQ (src/data/faq.ts)
 * et du catalogue d'articles (src/lib/blog.ts), pour qu'il ne puisse jamais
 * raconter autre chose que le site. Ne pas l'éditer dans dist/.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE_URL = "https://megasoft-office.com";

async function main() {
  const vite = await createServer({
    root,
    logLevel: "warn",
    server: { middlewareMode: true },
    appType: "custom",
  });

  try {
    const { questions } = await vite.ssrLoadModule("/src/data/faq.ts");
    const { posts } = await vite.ssrLoadModule("/src/lib/blog.ts");

    const articles = posts
      .map((p) => `- [${p.titre}](${SITE_URL}/blog/${p.slug}/) : ${p.chapeau}`)
      .join("\n");

    // Les réponses de la FAQ sont reprises telles quelles : c'est le format le
    // plus directement réutilisable par un moteur génératif, et cela garantit
    // qu'il ne lira jamais ici une version différente de celle du site.
    const faq = questions.map((q) => `### ${q.question}\n\n${q.reponse}`).join("\n\n");

    const contenu = `# Megasoft

> Éditeur algérien de logiciels de gestion d'entreprise depuis 1990, implanté à
> Alger (Hydra). Plus de 300 clients et 12 000 utilisateurs actifs. L'offre est
> organisée en trois pôles : Megasoft Office (suite de gestion), Megasoft
> Digital (solutions digitales et cloud) et Megasoft Services (conseil,
> intégration SAP et intelligence artificielle).

Megasoft conçoit et édite ses logiciels en Algérie. Ils sont commercialisés en
version desktop — installée sur poste ou en réseau local, toujours maintenue —
comme en version cloud. La comptabilité est conforme au Système Comptable
Financier algérien (SCF) et aux normes IAS/IFRS.

Contact : contact@megasoft-office.com — +213 (0)23 46 99 29
Adresse : Résidence El Marwa, Entrée 3 n°75, Hydra, Alger, Algérie

## Les trois pôles

### Megasoft Office — la suite de gestion

- **ERP** : le socle qui relie tous les métiers, un référentiel unique et des données cohérentes d'un service à l'autre.
- **Gestion commerciale** : clients, fournisseurs, devis, facturation, livraisons, stocks et règlements.
- **Finance** : comptabilité générale et analytique aux normes SCF et IAS/IFRS, trésorerie, états fiscaux.
- **RH** : paie complète, dossiers du personnel et déclarations périodiques, secteur privé comme public.
- **GPAO** : gestion de production assistée par ordinateur — nomenclatures, ordres de fabrication, ordonnancement.
- **GMAO** : maintenance préventive et curative des équipements, planifiée et tracée.

### Megasoft Digital — solutions digitales et cloud

- **TMS** (Transport Management System) : planification des tournées, suivi de flotte, coût réel au kilomètre.
- **WMS** (Warehouse Management System) : réception, adressage, préparation de commandes et inventaires, à l'emplacement près.
- **MES** (Manufacturing Execution System) : pilotage de l'atelier en temps réel, de l'ordre de fabrication à la traçabilité.
- **Solutions particulières** : développements spécifiques adaptés aux contraintes propres à chaque activité.
- **Cloud** : outils de gestion hébergés et sauvegardés, accessibles sans infrastructure lourde à maintenir.

### Megasoft Services — conseil, intégration et IA

- **Conseil** : cadrage du besoin, audit de l'existant, choix de la trajectoire avant projet.
- **Intégration SAP** : déploiement et intégration de SAP dans un système d'information existant.
- **My Exobrain** : agent d'intelligence artificielle dédié à la supply chain — évaluation des risques, recommandation d'actions, pilotage des approvisionnements, stocks et livraisons.
- **IA** : intelligence artificielle appliquée aux processus métiers — automatisation, analyse, aide à la décision.

## Logiciels métiers édités

MEGA COMMERCIAL (gestion commerciale), MEGA COMPTA SCF (comptabilité SCF),
MEGA ANALYTIQUE (coûts de revient), MEGA G.M.A.O. (maintenance), MEGA PAYE et
MEGA PAYE GRH (paie et ressources humaines), MEGA AUTO (concessionnaires
automobiles), MEGA PHARMA (grossistes et production pharmaceutique), MEGA IMMO
(immobilisations et inventaires), MEGA APPRO (approvisionnements), MEGA LAB
(laboratoires d'analyses médicales).

## Questions fréquentes

${faq}

## Pages principales

- [Accueil](${SITE_URL}/) : présentation des trois pôles, du catalogue de logiciels et des références clients.
- [Questions fréquentes](${SITE_URL}/faq) : conformité SCF et IAS/IFRS, desktop ou cloud, ERP, MES, TMS, WMS, intégration SAP, My Exobrain.
- [Blog](${SITE_URL}/blog/) : articles sur la gestion, la production et le terrain algérien.
- [Flux RSS](${SITE_URL}/blog/rss.xml) : suivi des publications.
- [Plan du site](${SITE_URL}/sitemap.xml)

## Articles

${articles}
`;

    await fs.writeFile(path.join(dist, "llms.txt"), contenu, "utf8");
    console.log(
      `✓ llms.txt généré : ${questions.length} questions, ${posts.length} articles, ` +
        `${Math.round(contenu.length / 1024)} Ko`
    );
  } finally {
    await vite.close();
  }
}

main().catch((err) => {
  console.error("✗ Génération de llms.txt échouée :", err);
  process.exit(1);
});
