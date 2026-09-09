import { useEffect } from "react";
import { creerEtat, detendre, estAuRepos, creerBoucle, type EtatRessort } from "@/lib/ressort";

/*
 * Entrée au défilement de la section sombre « Pourquoi nous ».
 *
 * D'OÙ VIENT CE CODE
 * ------------------
 * Il est repris du projet MyExoBrain, où il avait été réglé non pas au goût
 * mais par balayage contre le site d'origine — voir l'en-tête de
 * `lib/ressort.ts` pour le relevé. Les constantes de course et le ressort n'ont
 * pas bougé d'un chiffre : c'est précisément ce mouvement-là qui était demandé.
 *
 * MÉTHODE — pourquoi ce n'est pas une animation CSS ni un `whileInView`
 * ---------------------------------------------------------------------
 * Une apparition déclenchée une fois se joue puis s'oublie. Ici la progression
 * est LIÉE À LA POSITION DE DÉFILEMENT : elle se rejoue à l'envers quand on
 * remonte, et le texte retrouve exactement son état de départ. C'est ce qui
 * donne à la section son impression de matière plutôt que de diaporama.
 *
 * Chaque élément avance entre deux positions de défilement, relevées image par
 * image sur l'original (fenêtre de 900 px de haut) :
 *
 *   texte     course 419 px   translateY 64 → 0    opacité 0 → 1
 *   carte 1   course 154 px   translateY 320 → 0   échelle 0,3 → 1
 *   carte 2   course 154 px   idem, décalée de 178 px
 *   carte 3   course 154 px   idem
 *   carte 4   course 130 px   idem
 *
 * Les seuils comptent à partir du moment où le haut de la section atteint le
 * bas de la fenêtre : ils restent donc justes quelle que soit sa hauteur.
 *
 * La progression ne suit pas le défilement à l'instant près : elle le poursuit,
 * retenue par le ressort de `lib/ressort.ts`.
 *
 * ⚠️ Les éléments sont visés par l'attribut `data-entree`, jamais par une
 * classe. Une classe engendrée par l'outillage change au premier remaniement,
 * et rien ne signalerait la panne : la page resterait identique, simplement
 * immobile.
 */

type Sujet = {
  sel: string;
  rang?: number;
  /** Pixels de défilement APRÈS que le haut de la section a atteint le bas de la fenêtre. */
  debut: number;
  fin: number;
  ty: number;
  fondu?: boolean;
  echelle?: number;
  angle?: number;
};

const SUJETS: Sujet[] = [
  { sel: '[data-entree="texte"]', debut: 196, fin: 615, ty: 64, fondu: true },
  { sel: '[data-entree="carte"]', rang: 0, debut: 196, fin: 350, ty: 320, echelle: 0.3, angle: -4 },
  { sel: '[data-entree="carte"]', rang: 1, debut: 374, fin: 528, ty: 320, echelle: 0.3, angle: 4 },
  { sel: '[data-entree="carte"]', rang: 2, debut: 552, fin: 706, ty: 320, echelle: 0.3, angle: -4 },
  { sel: '[data-entree="carte"]', rang: 3, debut: 730, fin: 860, ty: 320, echelle: 0.3, angle: 4 },
];

/** Le visiteur a-t-il demandé moins d'animations ? */
const mouvementReduit = () =>
  typeof window === "undefined" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type SujetVivant = Sujet & EtatRessort & { el: HTMLElement };

const EntreeAuDefilement = ({ section = "#pourquoi" }: { section?: string }) => {
  useEffect(() => {
    const cadre = document.querySelector(section);
    if (!cadre) return;

    const sujets = SUJETS.map((s) => ({
      ...s,
      el: cadre.querySelectorAll<HTMLElement>(s.sel)[s.rang ?? 0],
    })).filter((s): s is Sujet & { el: HTMLElement } => Boolean(s.el));
    if (!sujets.length) return;

    /*
     * Réglage système « réduire les animations » : on pose tout en place. Le
     * contenu est entier — rien n'est caché derrière une animation qui ne
     * jouera pas.
     */
    if (mouvementReduit()) {
      for (const s of sujets) {
        // L'inclinaison des cartes est leur aspect AU REPOS, pas un effet :
        // on la garde même ici.
        s.el.style.transform = s.angle ? `perspective(1200px) rotate(${s.angle}deg)` : "none";
        s.el.style.opacity = "1";
      }
      return;
    }

    const vivants: SujetVivant[] = sujets.map((s) => ({ ...s, ...creerEtat() }));

    /*
     * Haut de la section, en coordonnées de page.
     *
     * Mesuré une fois et non à chaque image : `getBoundingClientRect()` force
     * un recalcul de mise en page, et pendant un défilement animé cela suffit à
     * faire tomber une image en plein milieu du trajet.
     */
    let sommetCache = 0;
    const mesurerSommet = () => {
      sommetCache = cadre.getBoundingClientRect().top + window.scrollY;
    };
    mesurerSommet();

    /** Progression visée par un sujet à la position de défilement actuelle. */
    const consigne = (s: SujetVivant, parcouru: number) =>
      Math.min(1, Math.max(0, (parcouru - s.debut) / (s.fin - s.debut)));

    const boucle = creerBoucle((ecoule) => {
      const origine = sommetCache - window.innerHeight;
      const parcouru = window.scrollY - origine;

      let bouge = false;
      for (const s of vivants) {
        const cible = consigne(s, parcouru);

        // `p === null` : premier passage, on se pose en place sans jouer la
        // course — un chargement en milieu de page ne rejoue pas tout.
        if (s.p === null || ecoule > 0) detendre(s, cible, ecoule);

        if (!estAuRepos(s, cible)) {
          bouge = true;
        } else {
          s.p = cible;
          s.v = 0;
        }

        const p = s.p ?? cible;
        const y = s.ty * (1 - p);
        if (s.echelle !== undefined) {
          const e = s.echelle + (1 - s.echelle) * p;
          /*
           * L'inclinaison de ±4° ne fait pas partie de l'animation : la carte
           * la garde une fois posée, c'est ce qui donne au groupe son allure de
           * jeu de cartes étalé. La perspective, elle, appartient à l'état de
           * départ relevé sur l'original et donne sa profondeur à la montée.
           */
          s.el.style.transform = `perspective(1200px) translateY(${y}px) scale(${e}) rotate(${s.angle}deg)`;
        } else {
          s.el.style.transform = p === 1 ? "none" : `translateY(${y}px)`;
        }
        if (s.fondu) s.el.style.opacity = String(p);
      }

      // Tant que quelque chose bouge, on redemande une image ; sinon on rend la
      // main et c'est le prochain défilement qui relancera.
      return bouge;
    });

    const relancer = () => boucle.relancer();
    /*
     * Au redimensionnement, le sommet de la section a bougé : il faut le
     * remesurer AVANT de relancer, sinon la course repart d'une origine fausse.
     */
    const auRedimensionnement = () => {
      mesurerSommet();
      boucle.relancer();
    };

    relancer();
    window.addEventListener("scroll", relancer, { passive: true });
    window.addEventListener("resize", auRedimensionnement);
    return () => {
      boucle.arreter();
      window.removeEventListener("scroll", relancer);
      window.removeEventListener("resize", auRedimensionnement);
    };
  }, [section]);

  return null;
};

export default EntreeAuDefilement;
