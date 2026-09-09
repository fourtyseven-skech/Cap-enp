import type { Media, Resultat } from "../mediatheque";
import { API_URL } from "./client";
import { ErreurApi, type MediaDistant } from "./contrat";
import * as api from "./depotHttp";

/**
 * ---------------------------------------------------------------------------
 * MÉDIATHÈQUE — VERSION SERVEUR
 * ---------------------------------------------------------------------------
 *
 * Même forme que `src/admin/mediatheque.ts`, adossée à l'API. L'Éditeur,
 * l'onglet Médias et les Outils l'appellent sans savoir laquelle des deux ils
 * utilisent.
 *
 * DEUX ADRESSES POUR LA MÊME IMAGE, ET C'EST VOULU
 * ------------------------------------------------
 * Une image stockée en base a deux chemins, qui ne servent pas au même moment :
 *
 *   · `/api/medias/<id>/fichier` — l'APERÇU, dans le panel. Les octets sortent
 *     directement de la base. C'est le seul chemin qui fonctionne tant que le
 *     site n'a pas été reconstruit ;
 *   · `/medias/<id>.webp` — l'adresse PUBLIQUE, sur le site construit. Le
 *     fichier y est recopié par `scripts/exporter-medias.mjs` avant le build.
 *
 * C'est la seconde qui part dans le Markdown des articles : elle doit rester
 * valable une fois l'article en ligne, quand l'API n'est plus dans la boucle.
 * Écrire l'adresse d'aperçu dans un article produirait des images qui ne
 * s'affichent que pour les personnes connectées au panel — et personne ne s'en
 * apercevrait avant un visiteur.
 */

/** L'adresse publique, celle qui part dans les articles. */
export const adressePublique = (id: string) => `/medias/${id}.webp`;

/** L'adresse d'aperçu, qui lit les octets en base. */
const adresseApercu = (id: string) => `${API_URL}/api/medias/${encodeURIComponent(id)}/fichier`;

/**
 * Média du serveur → média du panel.
 *
 * `variantes` ne contient qu'une entrée : le serveur produit une seule image
 * WebP, redimensionnée à 2 000 px au plus. Les trois déclinaisons du mode local
 * (400, 800, 1600) existaient pour alimenter un `srcset` que les articles
 * n'utilisent pas — les reproduire côté serveur multiplierait le stockage sans
 * rien changer à l'affichage.
 */
const versPanel = (m: MediaDistant): Media => ({
  id: m.id,
  nom: m.nom,
  alt: m.alt ?? "",
  mime: m.type_mime,
  largeur: m.largeur ?? 0,
  hauteur: m.hauteur ?? 0,
  poids: Number(m.taille),
  variantes: [{ largeur: m.largeur ?? 0, url: adresseApercu(m.id), poids: Number(m.taille) }],
  cree_le: m.ajoute_le,
  par: "",
  origine: m.type_origine
    ? { nom: m.nom, largeur: m.largeur ?? 0, hauteur: m.hauteur ?? 0, poids: Number(m.taille), mime: m.type_origine }
    : undefined,
});

/* ========================================================================= */

export const listerMedias = async (): Promise<Media[]> =>
  (await api.medias.lister()).map(versPanel);

export const obtenirMedia = async (id: string): Promise<Media | undefined> =>
  (await api.medias.lister()).map(versPanel).find((m) => m.id === id);

export const supprimerMedia = async (id: string): Promise<void> => {
  await api.medias.supprimer(id);
};

/**
 * Seul le texte alternatif est modifiable.
 *
 * La légende et les étiquettes n'existent pas côté serveur : elles n'ont jamais
 * été utilisées ailleurs que dans l'onglet Médias, et les inventer en base
 * maintenant reviendrait à figer un modèle dont on ne sait pas s'il servira.
 * À ajouter au contrat le jour où le besoin se confirme.
 */
export const majMedia = async (
  id: string,
  champs: Partial<Pick<Media, "alt" | "legende" | "etiquettes">>
): Promise<Media | undefined> => {
  if (champs.alt === undefined) return obtenirMedia(id);
  return versPanel(await api.medias.decrire(id, champs.alt));
};

/**
 * Envoi d'un fichier.
 *
 * Aucun traitement dans le navigateur : le serveur convertit en WebP, réduit à
 * 2 000 px et choisit entre compression avec ou sans perte. Le mode local le
 * faisait ici parce qu'il n'avait personne d'autre pour le faire.
 *
 * `par` n'est pas transmis : l'auteur d'un envoi est déduit de la session,
 * jamais de ce que le navigateur annonce.
 */
export const importer = async (fichier: File, alt: string, _par: string): Promise<Resultat> => {
  try {
    const m = await api.medias.envoyer(fichier, alt);
    return { ok: true, media: versPanel(m) };
  } catch (e) {
    return {
      ok: false,
      raison:
        e instanceof ErreurApi
          ? e.message
          : "L'envoi a échoué. Vérifiez votre connexion, puis réessayez.",
    };
  }
};

/**
 * Le quota du navigateur n'a pas de sens ici : les images sont en base, sur le
 * serveur. `null` est la réponse honnête — l'appelant sait déjà l'interpréter,
 * il la reçoit déjà quand le navigateur refuse l'estimation.
 */
export const quota = async (): Promise<{ utiliseMo: number; disponibleMo: number } | null> => null;

/* ========================================================================= */
/* Références dans le Markdown                                               */
/* ========================================================================= */

/**
 * En mode serveur, on écrit directement l'adresse publique.
 *
 * Le mode local insère `media:<id>`, une référence résolue à l'affichage parce
 * que l'image n'existe que dans le navigateur. Ici l'adresse est stable et
 * publique : la référence indirecte n'apporterait rien et laisserait un
 * `media:` non résolu dans le Markdown exporté.
 *
 * C'est aussi ce format que le serveur cherche pour refuser la suppression d'un
 * média encore utilisé.
 */
export const versMarkdown = (m: Media) => `![${m.alt}](${adressePublique(m.id)})`;

export const urlMedia = (m: Media) => m.variantes[0]?.url ?? "";

/**
 * Remplace les adresses publiques par les adresses d'aperçu.
 *
 * Sans cela, l'aperçu d'un article dans le panel afficherait des images cassées
 * tant que le site n'a pas été reconstruit : `/medias/<id>.webp` n'existe pas
 * encore. Le Markdown enregistré, lui, n'est jamais modifié.
 */
export const resoudre = (texte: string, _medias: Media[]): string =>
  texte.replace(/\/medias\/([0-9a-f-]{36})\.webp/gi, (_t, id: string) => adresseApercu(id));

/** Les identifiants de médias cités par un texte. */
export const referencesDe = (texte: string): string[] => [
  ...new Set([...texte.matchAll(/\/medias\/([0-9a-f-]{36})\.webp/gi)].map((m) => m[1])),
];

export const versHtml = (m: Media) =>
  `<img src="${adressePublique(m.id)}" alt="${m.alt}" width="${m.largeur}" height="${m.hauteur}" loading="lazy" />`;
