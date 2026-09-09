import { useSyncExternalStore } from "react";

/**
 * Signal partagé « l'intro est terminée ».
 *
 * La page d'accueil est désormais montée DERRIÈRE le rideau d'intro (voir
 * App.tsx) afin que le navigateur ait le temps de télécharger et de décoder la
 * vidéo du Hero avant que le rideau ne se lève. Conséquence : les composants ne
 * peuvent plus se fier à leur propre montage pour savoir quand « la page
 * commence ». Ils s'abonnent à ce signal à la place — les animations d'entrée
 * et la rotation des scènes ne démarrent qu'une fois le rideau levé, jamais
 * pendant.
 */
let done = false;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const markIntroDone = () => {
  if (done) return;
  done = true;
  listeners.forEach((l) => l());
};

export const useIntroDone = () => useSyncExternalStore(subscribe, () => done, () => done);
