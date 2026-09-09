import { REGISTRE } from "@/blocs/registre";
import { identifiant, type Bloc, type TypeBloc } from "@/blocs/types";

/**
 * Types d'articles — prédéfinis et créés par l'administrateur.
 *
 * Un type d'article n'est rien d'autre qu'une composition de blocs
 * pré-assemblée. Le mécanisme d'enregistrement est donc trivial : on copie les
 * blocs de l'article courant, on vide leur contenu rédactionnel, on garde la
 * structure et l'habillage.
 *
 * Aucun stockage serveur à ce stade : les types personnalisés vivent dans le
 * navigateur. Le passage en base est un remplacement de ces deux fonctions.
 */

export type TypeArticle = {
  cle: string;
  nom: string;
  description: string;
  /** Un type système ne peut être ni modifié ni supprimé. */
  systeme: boolean;
  composition: TypeBloc[];
};

export const TYPES_SYSTEME: TypeArticle[] = [
  {
    cle: "info",
    nom: "Info rapide",
    description: "Une question, une réponse nette. Le format le plus cité par les moteurs génératifs.",
    systeme: true,
    composition: ["accroche", "retenir", "texte", "texte", "action"],
  },
  {
    cle: "fond",
    nom: "Article de fond",
    description: "Analyse longue qui installe l'autorité de Megasoft sur un sujet métier.",
    systeme: true,
    composition: ["accroche", "texte", "citation", "texte", "comparatif", "texte", "retenir", "action"],
  },
  {
    cle: "nouveaute",
    nom: "Nouveauté Megasoft",
    description: "Annonce d'une version ou d'un module. Rassure les clients existants.",
    systeme: true,
    composition: ["accroche", "texte", "liste", "separateur", "texte", "action"],
  },
  {
    cle: "offre",
    nom: "Offre & tarifs",
    description: "Présente une formule. Le format le plus proche de la vente.",
    systeme: true,
    composition: ["accroche", "retenir", "comparatif", "chiffre", "texte", "action"],
  },
  {
    cle: "terrain",
    nom: "Retour de terrain",
    description: "Un déploiement réel raconté : contexte, obstacle, résultat.",
    systeme: true,
    composition: ["accroche", "texte", "chiffre", "citation", "etapes", "texte", "action"],
  },
  {
    cle: "vierge",
    nom: "Page vierge",
    description: "Aucune structure imposée. Pour composer librement, puis enregistrer comme nouveau type.",
    systeme: true,
    composition: [],
  },
];

const CLE = "ms-admin-types";

export const typesPersonnalises = (): TypeArticle[] => {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "[]");
  } catch {
    return [];
  }
};

export const enregistrerType = (nom: string, description: string, blocs: Bloc[]): TypeArticle => {
  const type: TypeArticle = {
    cle: `perso_${Date.now().toString(36)}`,
    nom,
    description: description || "Type personnalisé.",
    systeme: false,
    composition: blocs.map((b) => b.type),
  };
  try {
    localStorage.setItem(CLE, JSON.stringify([...typesPersonnalises(), type]));
  } catch {
    /* stockage indisponible — le type vivra le temps de la session */
  }
  return type;
};

export const supprimerType = (cle: string) => {
  try {
    localStorage.setItem(CLE, JSON.stringify(typesPersonnalises().filter((t) => t.cle !== cle)));
  } catch {
    /* sans conséquence */
  }
};

/** Instancie la composition d'un type en blocs concrets, prêts à éditer. */
export const instancier = (type: TypeArticle): Bloc[] =>
  type.composition.map((t) => {
    const d = REGISTRE[t].defauts();
    return { id: identifiant(), type: t, donnees: d.donnees, style: d.style };
  });
