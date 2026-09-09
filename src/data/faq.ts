/**
 * Questions fréquentes — le contenu.
 *
 * Séparé du composant (src/components/Faq.tsx) parce qu'il alimente aussi le
 * JSON-LD `FAQPage` et le fichier /llms.txt : ces trois sorties doivent lire la
 * MÊME source, sans quoi elles divergeraient à la première correction.
 *
 * POURQUOI CETTE SECTION EXISTE. Un moteur génératif ne cite pas une page parce
 * qu'elle est bien écrite : il la cite parce qu'elle répond, en toutes lettres,
 * à la question qu'on vient de lui poser. Le reste du site présente une offre ;
 * cette section pose les questions telles qu'un dirigeant les formule
 * réellement — « est-ce conforme au SCF ? », « ça marche pour une PME ? » — et y
 * répond en une phrase utilisable telle quelle.
 *
 * Chaque réponse est également publiée en données structurées `FAQPage` (voir
 * `faqJsonLd()` dans entry-accueil.tsx) : c'est le format que Google affiche en
 * accordéon sous le résultat, et celui qu'une IA reprend le plus volontiers.
 *
 * ⚠️ SOURCE UNIQUE. Ce tableau alimente à la fois l'affichage et le JSON-LD.
 * Ne jamais réécrire une réponse dans le JSON-LD seul : Google traite un
 * décalage entre les deux comme une tentative de manipulation.
 *
 * ⚠️ Toutes les réponses ci-dessous sont tirées de ce que le site atteste par
 * ailleurs (catalogue produits, chiffres de la section Stats, adresse du pied
 * de page). N'ajouter une affirmation ici qu'après l'avoir vérifiée : une FAQ
 * est précisément ce qu'une IA reprend mot pour mot.
 */
export const questions: { question: string; reponse: string }[] = [
  {
    question: "Quels logiciels de gestion Megasoft édite-t-il ?",
    reponse:
      "Megasoft édite une gamme complète de logiciels de gestion d'entreprise : gestion commerciale, comptabilité SCF, comptabilité analytique, paie et RH, GMAO, gestion des approvisionnements, des immobilisations, ainsi que des solutions métier dédiées à l'automobile, à la pharmacie et aux laboratoires d'analyses. S'y ajoutent l'ERP, la GPAO, le TMS, le WMS et le MES.",
  },
  {
    question: "Vos logiciels sont-ils conformes au SCF algérien et aux normes IAS/IFRS ?",
    reponse:
      "Oui. MEGA COMPTA SCF permet de tenir la comptabilité conformément au Système Comptable Financier algérien, avec la saisie des écritures et l'édition des états comptables et fiscaux aux normes IAS/IFRS.",
  },
  {
    question: "Faut-il installer les logiciels sur poste, ou existe-t-il une version cloud ?",
    reponse:
      "Les deux. Toute la gamme métier reste commercialisée et maintenue en version desktop, installée sur poste ou en réseau local. Le pôle Megasoft Digital propose par ailleurs une version cloud, hébergée et sauvegardée, accessible sans infrastructure lourde à maintenir.",
  },
  {
    question:
      "Quelle est la différence entre Megasoft Office, Megasoft Digital et Megasoft Services ?",
    reponse:
      "Megasoft Office regroupe la suite de gestion : ERP, gestion commerciale, finance, RH, GPAO et GMAO. Megasoft Digital couvre le TMS, le WMS, le MES, les développements spécifiques et le cloud. Megasoft Services rassemble le conseil, l'intégration SAP, My Exobrain et l'intelligence artificielle.",
  },
  {
    question: "Vos solutions conviennent-elles à une PME ou seulement aux grandes entreprises ?",
    reponse:
      "Megasoft accompagne aussi bien les TPE et PME que les grandes entreprises et les organismes publics. Plus de 300 clients et 12 000 utilisateurs actifs travaillent aujourd'hui sur ses logiciels en Algérie.",
  },
  {
    question: "Qu'est-ce qu'un MES et à quelle entreprise s'adresse-t-il ?",
    reponse:
      "Un MES (Manufacturing Execution System) pilote l'atelier de production en temps réel, de l'ordre de fabrication jusqu'à la traçabilité du produit fini. Il s'adresse aux entreprises industrielles qui veulent savoir ce qui se passe réellement sur leurs lignes, et non le reconstituer après coup.",
  },
  {
    question: "Qu'est-ce qu'un TMS et que permet-il de gagner ?",
    reponse:
      "Un TMS (Transport Management System) gère la planification des tournées, le suivi de la flotte et le coût réel au kilomètre. Il s'adresse aux entreprises qui livrent elles-mêmes ou pilotent des transporteurs, et permet de rapporter chaque livraison à son coût véritable.",
  },
  {
    question: "Megasoft accompagne-t-il l'intégration de SAP ?",
    reponse:
      "Oui. Le pôle Megasoft Services assure le déploiement et l'intégration de SAP dans un système d'information existant, précédé d'une phase de conseil : cadrage du besoin, audit de l'existant et choix de la trajectoire.",
  },
  {
    question: "Qu'est-ce que My Exobrain ?",
    reponse:
      "My Exobrain est un agent d'intelligence artificielle dédié à la supply chain. Il évalue les risques, recommande des actions et pilote en temps réel les approvisionnements, les stocks et les livraisons, plutôt que de laisser ces arbitrages se décider dans l'urgence.",
  },
  {
    question: "Depuis quand Megasoft existe-t-il et où l'entreprise est-elle implantée ?",
    reponse:
      "Megasoft édite des logiciels de gestion en Algérie depuis 1990. L'entreprise est implantée à Alger, Résidence El Marwa, Entrée 3 n°75, à Hydra, et intervient sur l'ensemble du territoire national.",
  },
];
