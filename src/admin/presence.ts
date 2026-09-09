import { useEffect, useState } from "react";
import { serveurConfigure } from "./serveur/client";
import { presence as apiPresence } from "./serveur/depotHttp";

/**
 * ---------------------------------------------------------------------------
 * QUI D'AUTRE EST SUR CET ÉCRAN
 * ---------------------------------------------------------------------------
 *
 * Le panel prévient AVANT d'écrire : « Amel a cet article ouvert depuis
 * 4 minutes ». Sans cela, deux personnes travaillent vingt minutes sur le même
 * texte et la seconde se fait refuser son enregistrement — le refus est
 * correct, mais il arrive une fois le travail fait.
 *
 * CE N'EST PAS UN VERROU
 * ----------------------
 * Rien n'est bloqué : on peut ouvrir et enregistrer un élément que quelqu'un
 * d'autre a ouvert. Le raisonnement complet est dans `serveur/src/presence.ts`
 * — en deux mots, un vrai verrou demanderait de savoir le lever quand personne
 * ne revient, et une équipe de trois personnes se retrouverait régulièrement
 * devant un article verrouillé par quelqu'un qui est parti en réunion.
 *
 * INERTE EN MODE LOCAL
 * --------------------
 * Sans serveur, il n'y a qu'une personne par définition : le crochet ne fait
 * aucune requête et renvoie une liste vide.
 */

/** Un battement toutes les 30 s ; le serveur oublie au bout de 90 s. */
const BATTEMENT_MS = 30_000;

export type Autre = { utilisateur: string; nom: string; depuisMs: number };

/**
 * Signale sa présence sur une ressource et renvoie les autres personnes.
 *
 * `ressource` prend la forme `article:mon-article` ou `contenu:hero`. Passer
 * `null` désactive le suivi — utile quand l'écran est ouvert sans qu'aucun
 * élément précis ne soit sélectionné.
 */
export const usePresence = (ressource: string | null): Autre[] => {
  const [autres, setAutres] = useState<Autre[]>([]);

  useEffect(() => {
    if (!serveurConfigure || !ressource) {
      setAutres([]);
      return;
    }

    let vivant = true;

    const battre = async () => {
      try {
        const r = await apiPresence.battre(ressource);
        if (vivant) setAutres(r);
      } catch {
        /* Le réseau a hoqueté : on n'affiche rien plutôt qu'une erreur. Une
           indication de présence absente est sans conséquence ; un bandeau
           rouge pour un battement raté, lui, ferait douter de l'écran. */
        if (vivant) setAutres([]);
      }
    };

    void battre();
    const minuterie = setInterval(battre, BATTEMENT_MS);

    return () => {
      vivant = false;
      clearInterval(minuterie);
      /* On prévient qu'on s'en va — au pire, la présence expirera seule. */
      void apiPresence.quitter(ressource).catch(() => undefined);
    };
  }, [ressource]);

  return autres;
};

/** « depuis 4 min », « à l'instant ». */
export const depuis = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes === 1) return "depuis 1 minute";
  if (minutes < 60) return `depuis ${minutes} minutes`;
  const heures = Math.floor(minutes / 60);
  return `depuis ${heures} h`;
};
