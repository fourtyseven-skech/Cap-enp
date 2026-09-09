/**
 * ---------------------------------------------------------------------------
 * QUI TRAVAILLE SUR QUOI, EN CE MOMENT
 * ---------------------------------------------------------------------------
 *
 * Deux personnes qui ouvrent le même article ne s'en aperçoivent pas. La
 * première enregistre, la seconde enregistre à son tour : le serveur refuse la
 * seconde écriture (`If-Match`, CONTRAT.md § 6) et personne ne perd rien — mais
 * la seconde personne a écrit vingt minutes pour rien.
 *
 * La détection arrive trop tard. Ce module apporte l'étage manquant : dire,
 * AVANT d'écrire, que quelqu'un d'autre est déjà là.
 *
 * CONSULTATIF, JAMAIS BLOQUANT
 * ----------------------------
 * Ce n'est pas un verrou. On peut toujours ouvrir, écrire et enregistrer un
 * élément que quelqu'un d'autre a ouvert. Un verrou véritable demanderait de
 * savoir le lever — départ en réunion, onglet fermé brutalement, panne de
 * réseau — et une équipe de trois personnes se retrouverait régulièrement
 * devant un article verrouillé par quelqu'un qui n'y est plus. Le prix d'un
 * verrou dépasserait le problème qu'il résout.
 *
 * EN MÉMOIRE, ET NON EN BASE
 * --------------------------
 * Une présence dure quelques minutes et n'a aucune valeur le lendemain. La
 * mettre en base coûterait une écriture toutes les trente secondes et par
 * personne, pour une donnée qu'on jette. Le redémarrage du serveur efface tout,
 * et c'est le comportement voulu : après un redémarrage, plus personne n'est
 * connecté.
 *
 * L'API tourne dans UN processus. Le jour où elle tournerait en plusieurs
 * exemplaires, cette carte devrait passer en base ou dans un cache partagé —
 * c'est écrit ici pour que la question se pose au bon moment.
 */

/** Au-delà, la présence est considérée éteinte. Le panel bat toutes les 30 s. */
const DUREE_MS = 90_000;

/** Une présence, telle qu'elle est conservée. */
type Presence = {
  utilisateur: string;
  nom: string;
  /** Première ouverture — c'est ce qui permet de dire « depuis 4 minutes ». */
  depuis: number;
  /** Dernier battement reçu. */
  vuLe: number;
};

/** `ressource` → (`utilisateur` → présence). */
const carte = new Map<string, Map<string, Presence>>();

/**
 * Le nom d'une ressource, tel que le panel l'envoie.
 *
 * Volontairement libre en forme mais borné en taille : c'est une chaîne qui
 * vient du navigateur, elle sert de clé dans une carte que le serveur garde en
 * mémoire. Sans borne, un client bavard ferait grossir cette carte à volonté.
 */
export const ressourceValide = (r: unknown): r is string =>
  typeof r === "string" && r.length > 0 && r.length <= 200 && /^[a-z]+:[\w\-./]+$/i.test(r);

const purger = (m: Map<string, Presence>, maintenant: number) => {
  for (const [id, p] of m) if (maintenant - p.vuLe > DUREE_MS) m.delete(id);
};

/**
 * Signale que quelqu'un est sur une ressource, et renvoie LES AUTRES.
 *
 * Renvoyer les autres dans la même réponse évite un second aller-retour : le
 * panel bat et s'informe d'un seul geste.
 */
export const battre = (
  ressource: string,
  utilisateur: string,
  nom: string
): { utilisateur: string; nom: string; depuisMs: number }[] => {
  const maintenant = Date.now();
  const m = carte.get(ressource) ?? new Map<string, Presence>();
  carte.set(ressource, m);

  const existant = m.get(utilisateur);
  m.set(utilisateur, {
    utilisateur,
    nom,
    /* `depuis` ne se remet pas à zéro à chaque battement : c'est l'heure
       d'ouverture qui intéresse la personne d'en face. */
    depuis: existant?.depuis ?? maintenant,
    vuLe: maintenant,
  });

  purger(m, maintenant);

  return [...m.values()]
    .filter((p) => p.utilisateur !== utilisateur)
    .map((p) => ({ utilisateur: p.utilisateur, nom: p.nom, depuisMs: maintenant - p.depuis }));
};

/** Quitte une ressource. Au pire, la présence s'éteindra d'elle-même. */
export const quitter = (ressource: string, utilisateur: string) => {
  const m = carte.get(ressource);
  if (!m) return;
  m.delete(utilisateur);
  if (m.size === 0) carte.delete(ressource);
};

/** Toutes les présences d'une personne disparaissent à sa déconnexion. */
export const oublierUtilisateur = (utilisateur: string) => {
  for (const [ressource, m] of carte) {
    m.delete(utilisateur);
    if (m.size === 0) carte.delete(ressource);
  }
};

/** Pour la recette : l'état brut, sans effet de bord. */
export const etat = () =>
  [...carte.entries()].map(([ressource, m]) => ({ ressource, présents: m.size }));
