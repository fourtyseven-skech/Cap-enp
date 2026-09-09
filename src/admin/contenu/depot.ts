import { ORDRE_SECTIONS, type CleSection } from "@/contenu/schemas";
import { serveurConfigure } from "../serveur/client";
import { ErreurApi } from "../serveur/contrat";
import * as api from "../serveur/depotHttp";

/**
 * ---------------------------------------------------------------------------
 * LE CONTENU DE L'ACCUEIL, VU DU PANEL
 * ---------------------------------------------------------------------------
 *
 * Deux sources, une seule interface — comme pour les articles et les médias.
 *
 *   · SERVEUR  — l'API. Le brouillon est séparé du publié : on peut retravailler
 *     une section pendant des jours sans que le site s'en aperçoive, puis
 *     publier d'un geste distinct.
 *
 *   · LOCAL    — les fichiers du dépôt, par les routes de développement de Vite
 *     (`src/contenu/serveurDev.ts`). Il n'y a PAS de brouillon : les fichiers
 *     sont la vérité, enregistrer c'est publier. Inventer un brouillon local
 *     voudrait dire stocker un état intermédiaire quelque part — et ce quelque
 *     part serait le navigateur, donc perdu au premier nettoyage.
 *
 * Le panel affiche laquelle des deux est active : de ces différences dépend le
 * sens du bouton « Publier », et l'éditeur ne doit pas laisser croire qu'un
 * travail est protégé quand il ne l'est pas.
 */

export type Section = {
  cle: CleSection;
  libelle: string;
  /** La version publiée — celle que lit la reconstruction du site. */
  donnees: Record<string, unknown>;
  /** La version en cours d'édition. `null` en mode local : il n'y en a pas. */
  brouillon: Record<string, unknown> | null;
  /** Étiquette de version, à renvoyer à l'écriture. Vide en mode local. */
  etiquette: string;
};

export const MODE_CONTENU: "fichiers" | "serveur" = serveurConfigure ? "serveur" : "fichiers";

/** En mode fichiers, enregistrer publie aussitôt : le bouton doit le dire. */
export const AVEC_BROUILLON = MODE_CONTENU === "serveur";

/* ========================================================================= */
/* Mode fichiers                                                             */
/* ========================================================================= */

const PREFIXE = "/__contenu";

type ReponseDev = { cle: CleSection; libelle: string; donnees: Record<string, unknown> };

const erreurDev = async (r: Response): Promise<never> => {
  let message = `Le serveur de développement a répondu ${r.status}.`;
  let champ = "";
  try {
    const corps = (await r.json()) as { message?: string; champ?: string };
    message = corps.message ?? message;
    champ = corps.champ ?? "";
  } catch {
    /* réponse illisible */
  }
  throw new ErreurApi("donnees_invalides", champ ? `${message} (champ « ${champ} »)` : message);
};

const fichiers = {
  lister: async (): Promise<Section[]> => {
    const r = await fetch(PREFIXE);
    if (!r.ok) return erreurDev(r);
    const sections = (await r.json()) as ReponseDev[];
    return sections.map((s) => ({ ...s, brouillon: null, etiquette: "" }));
  },

  enregistrer: async (cle: CleSection, donnees: Record<string, unknown>): Promise<Section> => {
    const r = await fetch(`${PREFIXE}/${encodeURIComponent(cle)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees),
    });
    if (!r.ok) return erreurDev(r);
    const s = (await r.json()) as ReponseDev;
    return { ...s, brouillon: null, etiquette: "" };
  },
};

/* ========================================================================= */
/* Mode serveur                                                              */
/* ========================================================================= */

const serveur = {
  lister: async (): Promise<Section[]> => {
    const pages = await api.contenu.lister();
    const parCle = new Map(pages.map((p) => [p.cle, p]));

    /*
     * L'ordre vient du MODÈLE, pas de la base.
     *
     * La requête trie par clé ; l'éditeur, lui, doit présenter les sections
     * dans l'ordre où elles apparaissent sur la page. « Avis » avant « Hero »
     * obligerait à chercher.
     */
    return ORDRE_SECTIONS.map(({ cle, libelle }) => {
      const p = parCle.get(cle);
      return {
        cle,
        libelle: p?.libelle ?? libelle,
        donnees: p?.donnees ?? {},
        brouillon: p?.brouillon ?? null,
        // L'étiquette vaut `maj_le`, comme pour les articles (CONTRAT.md § 6).
        etiquette: p?.maj_le ?? "",
      };
    });
  },

  enregistrer: async (
    cle: CleSection,
    donnees: Record<string, unknown>,
    etiquette: string
  ): Promise<Section> => {
    const { valeur } = await api.contenu.enregistrerBrouillon(cle, donnees, etiquette);
    return {
      cle,
      libelle: valeur.libelle,
      donnees: valeur.donnees,
      brouillon: valeur.brouillon,
      etiquette: valeur.maj_le,
    };
  },
};

/* ========================================================================= */
/* Interface commune                                                         */
/* ========================================================================= */

export const contenu = {
  lister: (): Promise<Section[]> => (serveurConfigure ? serveur.lister() : fichiers.lister()),

  /**
   * Enregistre.
   *
   * En mode serveur : écrit le brouillon. En mode fichiers : écrit le fichier,
   * donc publie. `AVEC_BROUILLON` dit lequel des deux, et le bouton en tient
   * compte.
   */
  enregistrer: (
    cle: CleSection,
    donnees: Record<string, unknown>,
    etiquette: string
  ): Promise<Section> =>
    serveurConfigure
      ? serveur.enregistrer(cle, donnees, etiquette)
      : fichiers.enregistrer(cle, donnees),

  /**
   * Publie le brouillon et déclenche la reconstruction.
   *
   * Sans objet en mode fichiers : il n'y a pas de brouillon à publier, et le
   * site de développement reflète déjà les fichiers.
   */
  publier: (cle: CleSection) => api.contenu.publier(cle),

  abandonner: (cle: CleSection) => api.contenu.abandonner(cle),
};
