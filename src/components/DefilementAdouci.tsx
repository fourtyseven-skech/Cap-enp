import { useEffect } from "react";

/**
 * ---------------------------------------------------------------------------
 * DÉFILEMENT ADOUCI
 * ---------------------------------------------------------------------------
 *
 * Un cran de molette ne saute plus d'un bloc : il glisse jusqu'à sa
 * destination. Le mouvement est un lissage exponentiel — la page rattrape sa
 * cible d'autant plus vite qu'elle en est loin, puis ralentit en arrivant.
 *
 * POURQUOI PAS UNE BIBLIOTHÈQUE
 * -----------------------------
 * Lenis ou Locomotive pèsent entre 15 et 40 Ko pour un comportement qui tient
 * en soixante lignes, et prennent le contrôle du défilement de toute la page —
 * ce qui entre en conflit avec ScrollTrigger, dont dépend l'empilement des
 * sections de ce site. Ici, on ne remplace pas le défilement : on écrit dans
 * `window.scrollTo` image par image, donc le navigateur émet ses événements
 * `scroll` habituels et GSAP continue de travailler comme avant.
 *
 * LA CONSTANTE DE TEMPS
 * ---------------------
 * 144 ms : la même valeur que sur MyExoBrain, où elle avait été relevée image
 * par image sur le site d'origine. 90 % du trajet en ~330 ms, 99 % en ~660 ms.
 * Plus court paraît sec, plus long donne une impression de flottement.
 *
 * CE QUI N'EST PAS TOUCHÉ
 * -----------------------
 *  · le TACTILE — un téléphone a déjà son inertie, et elle est meilleure que
 *    tout ce qu'on écrirait ici ; on n'intercepte que la molette ;
 *  · le CLAVIER et la barre de défilement : ils bougent la page nativement, on
 *    se recale simplement pour que le cran suivant reparte du bon endroit ;
 *  · les zones marquées `data-defilement-propre` — un menu, un panneau interne
 *    qui défile pour son compte ;
 *  · le réglage « réduire les animations » du système : on rend la main au
 *    navigateur, sans discuter.
 */

/** Constante de temps du lissage, en millisecondes. */
const CONSTANTE = 144;

/** En deçà de ce reste, la destination est considérée atteinte. */
const SEUIL = 0.5;

/** Un cran de molette en pixels : selon le navigateur, il vient en lignes ou en pages. */
const enPixels = (e: WheelEvent) => {
  if (e.deltaMode === 1) return e.deltaY * 16;
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
  return e.deltaY;
};

const DefilementAdouci = () => {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const racine = document.documentElement;
    let cible = window.scrollY;
    let courant = window.scrollY;
    let anime = false;
    let precedent = 0;

    const maximum = () => racine.scrollHeight - window.innerHeight;

    const image = (horodatage: number) => {
      /* Écart borné : un onglet revenu au premier plan livre parfois un saut de
         plusieurs secondes, qui projetterait la page d'un bout à l'autre. */
      const ecart = Math.min(64, horodatage - precedent);
      precedent = horodatage;

      courant += (cible - courant) * (1 - Math.exp(-ecart / CONSTANTE));
      if (Math.abs(cible - courant) < SEUIL) {
        courant = cible;
        anime = false;
      }
      window.scrollTo(0, courant);
      if (anime) requestAnimationFrame(image);
    };

    const surMolette = (e: WheelEvent) => {
      if (e.ctrlKey) return; // zoom du navigateur
      if (e.target instanceof Element && e.target.closest("[data-defilement-propre]")) return;

      e.preventDefault();
      cible = Math.max(0, Math.min(maximum(), cible + enPixels(e)));
      if (!anime) {
        anime = true;
        precedent = performance.now();
        requestAnimationFrame(image);
      }
    };

    /* La page bouge aussi sans nous : clavier, barre de défilement, ancre
       cliquée. Sans ce recalage, le cran suivant la ramènerait là où nous
       croyions qu'elle était. */
    const surDefilement = () => {
      if (!anime) {
        courant = window.scrollY;
        cible = courant;
      }
    };

    window.addEventListener("wheel", surMolette, { passive: false });
    window.addEventListener("scroll", surDefilement, { passive: true });

    return () => {
      window.removeEventListener("wheel", surMolette);
      window.removeEventListener("scroll", surDefilement);
    };
  }, []);

  return null;
};

export default DefilementAdouci;
