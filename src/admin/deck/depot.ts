import { identifiant, relire, type Document } from "@/blog/deck/modele";
import { journal } from "../depot";

/**
 * ---------------------------------------------------------------------------
 * DÉPÔT DES PRÉSENTATIONS — prêt pour le serveur
 * ---------------------------------------------------------------------------
 *
 * L'hébergement définitif est annoncé : un serveur, une base de données. Ce
 * fichier est écrit POUR CE JOUR-LÀ, pas pour aujourd'hui seulement.
 *
 * LE CONTRAT EST ASYNCHRONE, alors que l'implémentation actuelle écrit dans
 * `localStorage` et pourrait tout retourner immédiatement. C'est délibéré et
 * c'est le point important du fichier : une interface synchrone se répand dans
 * l'appelant — on lit une valeur, on la rend, on ne prévoit ni attente ni
 * erreur. La remplacer plus tard par des appels réseau obligerait à réécrire
 * chaque écran. En promettant dès maintenant ce que le serveur imposera,
 * le basculement ne coûte qu'un changement d'implémentation ici.
 *
 * CE QUE LE SERVEUR DEVRA FOURNIR
 *
 *   GET    /api/presentations              → Resume[]
 *   GET    /api/presentations/:id          → Document
 *   POST   /api/presentations              → Document          (corps : Document)
 *   PUT    /api/presentations/:id          → Document          (En-tête If-Match)
 *   DELETE /api/presentations/:id          → 204
 *
 * SCHÉMA DE TABLE SUGGÉRÉ
 *
 *   presentations(
 *     id          text primary key,
 *     titre       text not null,
 *     auteur      text not null,
 *     slug        text,
 *     article     text references articles(slug) on delete set null,
 *     contenu     jsonb not null,      -- le Document complet
 *     cree_le     timestamptz not null default now(),
 *     maj_le      timestamptz not null default now()
 *   )
 *
 * Le document entier va dans une colonne JSON plutôt que d'être éclaté en
 * tables « diapositives » et « éléments ». Ce n'est pas de la paresse : on ne
 * requête jamais un élément isolé, on charge toujours la présentation entière,
 * et le modèle évolue vite. Un schéma relationnel fin imposerait une migration
 * à chaque nouvelle propriété d'élément, pour un gain de requête nul. Les seuls
 * champs sortis en colonnes sont ceux sur lesquels on filtre ou on trie.
 *
 * CONCURRENCE. `maj_le` sert de jeton : le serveur refuse une écriture dont le
 * jeton ne correspond plus (409). Deux onglets ouverts sur la même présentation
 * — cas banal — ne peuvent alors pas s'écraser en silence.
 */

/** Ce qu'il faut pour afficher la bibliothèque, sans charger les documents. */
export type Resume = {
  id: string;
  titre: string;
  auteur: string;
  cree_le: string;
  maj_le: string;
  diapositives: number;
  article?: string;
};

export type Conflit = { conflit: true; distant: Document };

export interface DepotPresentations {
  lister(): Promise<Resume[]>;
  obtenir(id: string): Promise<Document | null>;
  creer(doc: Document): Promise<Document>;
  /** Retourne le document enregistré, ou un conflit si la version a bougé. */
  enregistrer(doc: Document, jeton: string): Promise<Document | Conflit>;
  supprimer(id: string): Promise<void>;
}

export const estConflit = (r: Document | Conflit): r is Conflit =>
  (r as Conflit).conflit === true;

const resumer = (d: Document): Resume => ({
  id: d.id,
  titre: d.titre,
  auteur: d.meta.auteur,
  cree_le: d.meta.cree_le,
  maj_le: d.meta.maj_le,
  diapositives: d.diapositives.length,
  article: d.meta.article,
});

/* =========================================================================
 * IMPLÉMENTATION LOCALE
 * ======================================================================= */

const CLE = "ms-admin-decks";

const lireTout = (): Document[] => {
  try {
    const b = localStorage.getItem(CLE);
    if (!b) return [];
    const l = JSON.parse(b) as unknown[];
    return l.map((x) => relire(x)).filter((x): x is Document => !!x);
  } catch {
    return [];
  }
};

const ecrireTout = (l: Document[]) => {
  try {
    localStorage.setItem(CLE, JSON.stringify(l));
  } catch {
    /* quota atteint — l'action reste effective en mémoire pour la session */
  }
};

export class DepotLocal implements DepotPresentations {
  async lister() {
    return lireTout()
      .sort((a, b) => (a.meta.maj_le < b.meta.maj_le ? 1 : -1))
      .map(resumer);
  }

  async obtenir(id: string) {
    return lireTout().find((d) => d.id === id) ?? null;
  }

  async creer(doc: Document) {
    const maintenant = new Date().toISOString();
    const neuf: Document = {
      ...doc,
      id: identifiant("doc"),
      meta: { ...doc.meta, cree_le: maintenant, maj_le: maintenant },
    };
    ecrireTout([neuf, ...lireTout()]);
    return neuf;
  }

  async enregistrer(doc: Document, jeton: string) {
    const tout = lireTout();
    const existant = tout.find((d) => d.id === doc.id);

    // Même vérification de concurrence qu'un serveur, pour que le comportement
    // soit déjà celui d'après la bascule : deux onglets ouverts sur la même
    // présentation ne s'écrasent pas en silence.
    if (existant && jeton && existant.meta.maj_le !== jeton) {
      return { conflit: true as const, distant: existant };
    }

    const maj: Document = { ...doc, meta: { ...doc.meta, maj_le: new Date().toISOString() } };
    ecrireTout([maj, ...tout.filter((d) => d.id !== doc.id)]);
    return maj;
  }

  async supprimer(id: string) {
    ecrireTout(lireTout().filter((d) => d.id !== id));
  }
}

/* =========================================================================
 * IMPLÉMENTATION SERVEUR
 * ======================================================================= */

/**
 * Parle au serveur décrit en tête de fichier.
 *
 * Écrite maintenant et pas plus tard : tant qu'elle n'existe pas, rien ne
 * garantit que le contrat est réellement satisfaisable — c'est en l'écrivant
 * qu'on découvre les champs manquants. Elle est inerte tant que `VITE_API_URL`
 * n'est pas déclarée.
 *
 * `credentials: "include"` : la session du panel voyagera en cookie `HttpOnly`,
 * pas en jeton stocké dans le navigateur. Un jeton lisible par le JavaScript de
 * la page est récupérable par n'importe quel script tiers qui s'y glisserait.
 */
export class DepotHttp implements DepotPresentations {
  constructor(private base: string) {}

  private async requete<T>(chemin: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${this.base}${chemin}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
  }

  async lister() {
    return this.requete<Resume[]>("/presentations");
  }

  async obtenir(id: string) {
    try {
      const brut = await this.requete<unknown>(`/presentations/${id}`);
      return relire(brut);
    } catch {
      return null;
    }
  }

  async creer(doc: Document) {
    const brut = await this.requete<unknown>("/presentations", {
      method: "POST",
      body: JSON.stringify(doc),
    });
    return relire(brut) ?? doc;
  }

  async enregistrer(doc: Document, jeton: string) {
    const r = await fetch(`${this.base}/presentations/${doc.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json", "If-Match": jeton },
      body: JSON.stringify(doc),
    });
    if (r.status === 409) {
      const distant = relire(await r.json());
      if (distant) return { conflit: true as const, distant };
    }
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return relire(await r.json()) ?? doc;
  }

  async supprimer(id: string) {
    await this.requete<void>(`/presentations/${id}`, { method: "DELETE" });
  }
}

/* =========================================================================
 * CHOIX DE L'IMPLÉMENTATION
 * ======================================================================= */

const API = import.meta.env.VITE_API_URL as string | undefined;

/**
 * Le dépôt en service. Poser `VITE_API_URL` au build suffit à basculer toute
 * l'application sur le serveur — aucun écran ne change.
 */
export const depotDecks: DepotPresentations = API ? new DepotHttp(API) : new DepotLocal();

/** Vrai tant que les présentations ne vivent que dans ce navigateur. */
export const stockageLocal = !API;

/* Le journal reste commun au panel : une présentation créée ou supprimée doit
   apparaître dans la même chronologie que les articles et les médias. */
export const tracer = (acteur: string, action: "creation" | "suppression" | "export", cible: string, detail?: string) =>
  journal.ecrire(acteur, action, cible, detail);
