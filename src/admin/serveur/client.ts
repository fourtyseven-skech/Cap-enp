import { ErreurApi, type CodeErreur, type Marque } from "./contrat";

/**
 * ---------------------------------------------------------------------------
 * LE TRANSPORT
 * ---------------------------------------------------------------------------
 *
 * Un seul endroit qui parle réellement au réseau. Tout le reste du panel
 * appelle des fonctions métier et n'a jamais à connaître `fetch`, les en-têtes
 * ou les codes HTTP.
 *
 * INERTE TANT QUE LE SERVEUR N'EXISTE PAS
 * ---------------------------------------
 * `VITE_API_URL` n'est pas déclarée aujourd'hui : `serveurConfigure` vaut donc
 * `false` et aucune de ces fonctions n'est appelée. Le panel continue d'écrire
 * dans le navigateur, exactement comme avant. Le jour de la mise en service,
 * cette seule variable fait basculer l'ensemble.
 */

const BRUT = import.meta.env.VITE_API_URL as string | undefined;

/**
 * On retire la barre oblique finale une bonne fois.
 *
 * Sans cela, `https://api.exemple.com/` + `/api/articles` donne une adresse à
 * double barre. La plupart des serveurs la tolèrent ; certains répondent 404,
 * et d'autres redirigent — ce qui, sur une requête `POST`, la transforme en
 * `GET` et fait perdre le corps en silence.
 */
export const API_URL = BRUT?.replace(/\/+$/, "") ?? "";

/** Le panel doit-il parler au serveur, ou écrire dans le navigateur ? */
export const serveurConfigure = API_URL.length > 0;

/* ========================================================================= */

/** Forme d'erreur imposée par le contrat (§ 2). */
type CorpsErreur = { erreur?: string; message?: string; distant?: unknown };

const CODES: readonly CodeErreur[] = [
  "donnees_invalides",
  "non_connecte",
  "droit_insuffisant",
  "introuvable",
  "conflit",
  "fichier_trop_lourd",
  "trop_de_tentatives",
  "erreur_serveur",
];

/**
 * Transforme une réponse en échec en `ErreurApi`.
 *
 * Un serveur en panne ne renvoie pas toujours du JSON : un proxy peut
 * intercaler une page HTML, et `response.json()` lève alors une erreur de
 * syntaxe qui masquerait la vraie cause. On se replie donc sur le code HTTP.
 */
const enErreur = async (r: Response): Promise<ErreurApi> => {
  let corps: CorpsErreur = {};
  try {
    corps = (await r.json()) as CorpsErreur;
  } catch {
    /* réponse illisible — on se rabat sur le code HTTP ci-dessous */
  }

  const annonce = corps.erreur as CodeErreur | undefined;
  const code: CodeErreur =
    annonce && CODES.includes(annonce)
      ? annonce
      : r.status === 401
        ? "non_connecte"
        : r.status === 403
          ? "droit_insuffisant"
          : r.status === 404
            ? "introuvable"
            : r.status === 409
              ? "conflit"
              : r.status === 413
                ? "fichier_trop_lourd"
                : r.status === 429
                  ? "trop_de_tentatives"
                  : "erreur_serveur";

  const message =
    corps.message ??
    (r.status >= 500
      ? "Le serveur a rencontré une erreur. Réessayez dans un instant."
      : `La requête a échoué (${r.status}).`);

  return new ErreurApi(code, message, corps.distant);
};

/* ========================================================================= */

type Options = {
  methode?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  corps?: unknown;
  /** Étiquette reçue à la lecture, à renvoyer pour toute écriture. */
  etiquette?: string;
  /** Envoi de fichier : le corps part tel quel, sans en-tête JSON. */
  fichier?: FormData;
  signal?: AbortSignal;
};

/**
 * Une requête vers l'API.
 *
 * `credentials: "include"` : la session voyage dans un cookie `HttpOnly`, que
 * le JavaScript de la page ne peut pas lire. Un jeton stocké et rattaché à la
 * main serait, lui, récupérable par n'importe quel script tiers qui se
 * glisserait dans la page.
 */
export const requete = async <T>(chemin: string, o: Options = {}): Promise<Marque<T>> => {
  if (!serveurConfigure) {
    throw new ErreurApi(
      "erreur_serveur",
      "Aucun serveur n'est configuré. Le panel fonctionne en mode local."
    );
  }

  const entetes: Record<string, string> = { Accept: "application/json" };
  if (!o.fichier && o.corps !== undefined) entetes["Content-Type"] = "application/json";

  // Le contrat refuse une écriture sans `If-Match` (§ 6) : un client qui
  // oublie l'en-tête ne doit pas obtenir par défaut le comportement le plus
  // destructeur. On le pose ici plutôt que dans chaque appel métier.
  if (o.etiquette) entetes["If-Match"] = o.etiquette;

  let r: Response;
  try {
    r = await fetch(`${API_URL}${chemin}`, {
      method: o.methode ?? "GET",
      credentials: "include",
      headers: entetes,
      body: o.fichier ?? (o.corps !== undefined ? JSON.stringify(o.corps) : undefined),
      signal: o.signal,
    });
  } catch {
    // `fetch` ne rejette que si la requête n'est jamais partie : serveur
    // injoignable, DNS, ou origine refusée par le navigateur. Un message
    // distinct évite de faire chercher un bogue applicatif là où le réseau
    // est en cause.
    throw new ErreurApi(
      "reseau_indisponible",
      "Le serveur est injoignable. Vérifiez votre connexion, puis réessayez."
    );
  }

  if (!r.ok) throw await enErreur(r);

  // 204 : opération réussie, aucun contenu. `r.json()` lèverait sur un corps
  // vide, alors que c'est le cas normal d'une suppression ou d'une déconnexion.
  const valeur = r.status === 204 ? (undefined as T) : ((await r.json()) as T);

  return { valeur, etiquette: r.headers.get("ETag") ?? "" };
};

/** Raccourci pour les lectures dont l'étiquette ne sert pas. */
export const lire = async <T>(chemin: string, signal?: AbortSignal): Promise<T> =>
  (await requete<T>(chemin, { signal })).valeur;
