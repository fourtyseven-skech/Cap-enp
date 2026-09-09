/*
 * Le ressort du site — la grammaire de mouvement, en un seul endroit.
 *
 * D'OU IL VIENT
 * -------------
 * Ce code n'est pas nouveau : il est EXTRAIT de `EntreeAuDefilement.jsx`, sans
 * qu'une seule constante ait bougé. Il y avait été réglé non pas au goût, mais
 * par balayage contre le site d'origine, en comparant les deux sites à position
 * de défilement égale :
 *
 *     raideur 380 / amortissement 47   écart type 24,3 px
 *     raideur 300 / amortissement 34   écart type 17,0 px
 *     raideur 200 / amortissement 24   écart type  2,9 à 8,3 px   ← retenu
 *     raideur 200 / amortissement 20   écart type 19,8 px
 *
 * Le bruit entre deux passages à la molette est de 3 à 5 px : le couple retenu
 * est donc au niveau du bruit, c'est-à-dire indiscernable de l'original.
 *
 * POURQUOI L'AVOIR SORTI DE SON COMPOSANT
 * ---------------------------------------
 * Parce que tout ce qu'on ajoutera au site doit bouger comme ça. Une animation
 * qui invente sa propre courbe ne se fond pas : elle se voit comme une pièce
 * rapportée, et c'est exactement ce qu'on veut éviter en gardant l'identité du
 * site. Un seul ressort, partagé, et la page entière parle d'une seule voix.
 *
 * CE QUE CE MODULE N'EST PAS
 * --------------------------
 * Ce n'est pas une bibliothèque d'animation. Il ne sait faire qu'une chose :
 * amener une progression normalisée (0 → 1) vers sa consigne, avec ce
 * ressort-là. Les composants décident ce que la progression pilote.
 */

/** Raideur du ressort. Relevée — voir l'en-tête. */
export const RAIDEUR = 200;

/** Amortissement du ressort. Relevé — voir l'en-tête. */
export const AMORTISSEMENT = 24;

/**
 * Pas d'intégration maximal, en secondes.
 *
 * Au-delà, le ressort diverge : à cette raideur, un pas d'une image entière
 * suffit à le faire exploser. On sous-découpe donc chaque image.
 */
export const SOUS_PAS = 1 / 240;

/** En deçà de cet écart ET de cette vitesse, on considère le sujet posé. */
export const REPOS = 0.0005;

/**
 * L'état d'un sujet animé.
 *
 * `p` est la progression AFFICHÉE — en retard sur la consigne, c'est tout
 * l'intérêt. `null` signifie « pas encore initialisée » : au premier passage on
 * se pose directement sur la consigne, pour qu'un chargement en milieu de page
 * ne joue pas toute l'animation d'un coup.
 *
 * `v` est la vitesse, entretenue par le ressort.
 */
export type EtatRessort = {
  p: number | null;
  v: number;
};

/** Un sujet neuf, pas encore initialisé. */
export function creerEtat(): EtatRessort {
  return { p: null, v: 0 };
}

/**
 * Rapproche la progression affichée de sa consigne, d'un pas de temps.
 *
 * Intégration par sous-pas courts (voir `SOUS_PAS`). La course est bornée à
 * [0, 1] : le réglage retenu est très légèrement sous-amorti et, laissé libre,
 * dépasserait sa cible d'environ 1 px avant de revenir. L'original ne le fait
 * pas.
 *
 * @param etat   l'état du sujet, modifié sur place
 * @param cible  la consigne, entre 0 et 1
 * @param ecoule le temps écoulé depuis la dernière image, en secondes
 */
export function detendre(etat: EtatRessort, cible: number, ecoule: number): void {
  if (etat.p === null) {
    // Au premier passage, rien ne traîne : on part en place.
    etat.p = cible;
    etat.v = 0;
    return;
  }

  let reste = Math.min(ecoule, 0.064);
  while (reste > 0) {
    const pas = Math.min(reste, SOUS_PAS);
    etat.v += (-RAIDEUR * (etat.p - cible) - AMORTISSEMENT * etat.v) * pas;
    etat.p += etat.v * pas;
    if (etat.p < 0) {
      etat.p = 0;
      etat.v = 0;
    } else if (etat.p > 1) {
      etat.p = 1;
      etat.v = 0;
    }
    reste -= pas;
  }
}

/** Le sujet est-il posé sur sa consigne ? */
export function estAuRepos(etat: EtatRessort, cible: number): boolean {
  if (etat.p === null) return false;
  return Math.abs(etat.p - cible) <= REPOS && Math.abs(etat.v) <= REPOS;
}

/**
 * La boucle d'images.
 *
 * Elle ne tourne QUE tant que quelque chose bouge : `peindre` renvoie `true`
 * pour demander une image de plus, `false` pour rendre la main. C'est ce qui
 * fait qu'une page immobile ne consomme rien.
 *
 * UNE SUBTILITÉ MESURÉE : la relance est datée au moment où on la demande, et
 * non à la première image. Sinon cette image-là n'intègre rien et tout le
 * mouvement accuse un retard d'une image (~14 ms), mesurable d'un bout à
 * l'autre de la course.
 *
 * @param peindre reçoit le temps écoulé en secondes, renvoie « encore ? »
 */
export function creerBoucle(peindre: (ecoule: number) => boolean) {
  let enCours = false;
  let precedent = 0;
  let vivante = true;

  function image(horodatage: number) {
    if (!vivante) {
      enCours = false;
      return;
    }
    const ecoule = (horodatage - precedent) / 1000;
    precedent = horodatage;

    if (peindre(ecoule)) requestAnimationFrame(image);
    else enCours = false;
  }

  return {
    /** Relance la boucle si elle dort. Sans effet si elle tourne déjà. */
    relancer() {
      if (enCours || !vivante) return;
      enCours = true;
      precedent = performance.now();
      requestAnimationFrame(image);
    },
    /** Arrête définitivement — à appeler au démontage du composant. */
    arreter() {
      vivante = false;
    },
  };
}
