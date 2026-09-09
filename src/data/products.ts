import {
  ShoppingCart,
  Calculator,
  PieChart,
  Cog,
  Banknote,
  Users,
  Car,
  Pill,
  Barcode,
  Boxes,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";

export type Product = {
  name: string;
  icon: LucideIcon;
  text: string;
  /**
   * Commercialisé en version desktop (poste ou réseau local).
   *
   * ⚠️ À CONFIRMER AVEC AMEL — par défaut, toute la gamme métier historique est
   * marquée « Desktop », conformément à sa remarque (« il faut la déclinaison
   * des softwares version desktop pck ils sont tjrs vendus »). Si un logiciel
   * n'est plus vendu en desktop, passer son `desktop` à false ici : le badge
   * disparaît partout où le catalogue est affiché.
   */
  desktop: boolean;
};

/**
 * Catalogue des logiciels métiers édités par Megasoft.
 *
 * Source unique : consommé par la section Solutions (onglet Office), pour
 * qu'une correction de libellé ne soit jamais à faire deux fois.
 *
 * ⚠️ UNE LIGNE PAR LOGICIEL, ET C'EST DÉLIBÉRÉ. Ces phrases faisaient 92 à 131
 * caractères et se repliaient sur deux ou trois lignes : la liste devenait un
 * mur de texte où plus rien ne se distinguait. Chacune tient désormais sur une
 * ligne, et ne garde que ce qui différencie ce logiciel des dix autres.
 *
 * Y ajouter une précision, c'est reprendre deux lignes — et le mur avec. Le
 * détail a sa place sur une page produit, pas dans une liste de survol.
 */
export const products: Product[] = [
  {
    name: "MEGA COMMERCIAL",
    icon: ShoppingCart,
    text: "Ventes, achats, stocks, règlements et déclarations fiscales.",
    desktop: true,
  },
  {
    name: "MEGA COMPTA SCF",
    icon: Calculator,
    text: "Comptabilité au SCF, états comptables et fiscaux aux normes IAS/IFRS.",
    desktop: true,
  },
  {
    name: "MEGA ANALYTIQUE",
    icon: PieChart,
    text: "Coûts de revient et rentabilité réelle par produit ou activité.",
    desktop: true,
  },
  {
    name: "MEGA G.M.A.O.",
    icon: Cog,
    text: "Maintenance préventive et curative de vos équipements.",
    desktop: true,
  },
  {
    name: "MEGA PAYE",
    icon: Banknote,
    text: "Bulletins de paie et déclarations périodiques.",
    desktop: true,
  },
  {
    name: "MEGA PAYE GRH",
    icon: Users,
    text: "Paie et suivi du personnel, secteur privé comme public.",
    desktop: true,
  },
  {
    name: "MEGA AUTO",
    icon: Car,
    text: "La gestion commerciale des concessionnaires automobiles.",
    desktop: true,
  },
  {
    name: "MEGA PHARMA",
    icon: Pill,
    text: "Commercial et stock pour grossistes et unités pharmaceutiques.",
    desktop: true,
  },
  {
    name: "MEGA IMMO",
    icon: Barcode,
    text: "Immobilisations, amortissements, inventaires et code-barres.",
    desktop: true,
  },
  {
    name: "MEGA APPRO",
    icon: Boxes,
    text: "Commandes, entrées/sorties de stock et inventaires.",
    desktop: true,
  },
  {
    name: "MEGA LAB",
    icon: FlaskConical,
    text: "De la demande d'analyse à la remise des résultats.",
    desktop: true,
  },
];
