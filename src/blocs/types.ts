/**
 * ---------------------------------------------------------------------------
 * COUCHE BLOCS — neutre, ni site ni administration
 * ---------------------------------------------------------------------------
 *
 * Cette couche ne dépend NI de `src/components` (interface du site) NI de
 * `src/admin` (interface d'édition). Les deux la consomment, aucune ne la
 * possède.
 *
 * Raison : l'aperçu de l'éditeur et la page publiée doivent sortir du même
 * rendu. Dupliquer les blocs d'un côté et de l'autre garantirait des écarts
 * silencieux entre ce que l'administrateur compose et ce que le visiteur
 * reçoit. L'isolation demandée porte sur les OUTILS d'édition — barres,
 * formulaires, poignées — qui restent, eux, entièrement dans `src/admin`.
 */

export type Accent = "office" | "digital" | "service";

export type TypeBloc =
  | "accroche"
  | "texte"
  | "citation"
  | "chiffre"
  | "retenir"
  | "action"
  | "etapes"
  | "comparatif"
  | "liste"
  | "separateur";

/** Un bloc posé dans un article. */
export type Bloc = {
  id: string;
  type: TypeBloc;
  /** Contenu rédactionnel — libre. */
  donnees: Record<string, unknown>;
  /** Habillage — fermé aux jetons de la charte, jamais de valeur libre. */
  style: { accent: Accent };
  /**
   * Retiré de la page. Le bloc reste dans la composition et dans la liste des
   * calques, mais ne paraît plus — c'est ce qui permet d'essayer une variante
   * sans supprimer celle qu'on avait, et de la retrouver intacte.
   */
  masque?: boolean;
  /**
   * Protégé : ni déplaçable, ni modifiable. Sert aux blocs que l'on ne veut
   * plus toucher une fois calés — un chapô validé, un encadré légal — et qu'un
   * glissement malheureux déplacerait sans qu'on s'en aperçoive.
   */
  verrouille?: boolean;
};

/** Nature d'un champ, qui décide du contrôle affiché dans l'éditeur. */
export type NatureChamp = "ligne" | "paragraphe" | "liste" | "paires" | "lien";

export type Champ = {
  cle: string;
  libelle: string;
  nature: NatureChamp;
  /** Texte grisé affiché tant que le champ est vide. */
  exemple?: string;
};

export type DefinitionBloc = {
  nom: string;
  /** Ce que le bloc apporte à la lecture — affiché dans la bibliothèque. */
  role: string;
  champs: Champ[];
  defauts: () => { donnees: Record<string, unknown>; style: { accent: Accent } };
};

export const identifiant = () => `b_${Math.random().toString(36).slice(2, 8)}`;
