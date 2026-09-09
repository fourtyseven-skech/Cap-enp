import chiffres from "../../content/accueil/chiffres.json";
import quiSommesNous from "../../content/accueil/qui-sommes-nous.json";
import solutions from "../../content/accueil/solutions.json";
import avis from "../../content/accueil/avis.json";
import contact from "../../content/accueil/contact.json";
import hero from "../../content/accueil/hero.json";
import partenaires from "../../content/accueil/partenaires.json";
import references from "../../content/accueil/references.json";
import entete from "../../content/accueil/entete.json";
import pied from "../../content/accueil/pied.json";
import megaErp from "../../content/accueil/mega-erp.json";
import pourquoiNous from "../../content/accueil/pourquoi-nous.json";
import sectionsLibres from "../../content/accueil/sections-libres.json";

import type {
  Avis,
  Chiffres,
  Contact,
  Entete,
  Hero,
  MegaErp,
  Partenaires,
  QuiSommesNous,
  Pied,
  PourquoiNous,
  References,
  SectionsLibres,
  Solutions,
} from "./schemas";

/**
 * ---------------------------------------------------------------------------
 * LE CONTENU DE LA PAGE D'ACCUEIL
 * ---------------------------------------------------------------------------
 *
 * Les composants lisent ici, plus dans leur propre code.
 *
 * IMPORTS DIRECTS, RÉSOLUS AU BUILD
 * ---------------------------------
 * Vite lit ces fichiers JSON à la compilation et les intègre au bundle. Il n'y
 * a donc aucune requête réseau, aucune attente, et la pré-génération des pages
 * voit exactement le même contenu que le navigateur — ce qui est la condition
 * pour que le HTML produit reste identique.
 *
 * `import type` pour les schémas : Zod ne part JAMAIS dans le navigateur. La
 * validation a lieu au build, dans `greffonContenu` (voir `vite.config.ts`), et
 * une donnée invalide interrompt la construction.
 *
 * D'OÙ VIENT CE CONTENU, DEMAIN
 * -----------------------------
 * Ces fichiers seront écrits par `scripts/exporter-contenu.mjs` à partir de la
 * table `contenu_pages`, avant chaque build — exactement comme les articles et
 * les médias. Les composants n'en sauront rien : ils lisent des fichiers, que
 * ceux-ci viennent du dépôt ou de la base.
 */

export const CHIFFRES = chiffres as Chiffres;
export const QUI_SOMMES_NOUS = quiSommesNous as QuiSommesNous;
export const SOLUTIONS = solutions as Solutions;
export const AVIS = avis as Avis;
export const CONTACT = contact as Contact;
export const HERO = hero as Hero;
export const PARTENAIRES = partenaires as Partenaires;
export const REFERENCES = references as References;
export const ENTETE = entete as Entete;
export const PIED = pied as Pied;
export const MEGA_ERP = megaErp as MegaErp;
export const POURQUOI_NOUS = pourquoiNous as PourquoiNous;
export const SECTIONS_LIBRES = sectionsLibres as SectionsLibres;

/**
 * Le nombre d'années écoulées depuis la fondation.
 *
 * Calculé, jamais écrit en dur : la section affichait « 35+ », juste à
 * l'écriture et faux l'année suivante.
 */
export const anneesDExpertise = () =>
  new Date().getFullYear() - QUI_SOMMES_NOUS.annee_fondation;
