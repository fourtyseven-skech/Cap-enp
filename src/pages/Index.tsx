import { lazy, Suspense, useEffect } from "react";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import { seoByPath, useSeo } from "@/lib/seo";
import { useIntroDone } from "@/lib/introState";
import { SECTIONS_LIBRES } from "@/contenu";

/**
 * Découpage du chunk critique.
 *
 * Le premier écran, c'est le Hero et la bande de chiffres. Tout ce qui suit est
 * sous la ligne de flottaison : le visiteur ne peut pas l'avoir vu avant
 * d'avoir fait défiler. Ces sections partaient pourtant dans le même bundle que
 * l'intro et le Hero — GSAP compris, tiré par Solutions — et il fallait donc
 * les analyser AVANT de peindre quoi que ce soit. Sur mobile, c'est du temps
 * pris sur le LCP, qui est justement l'intro.
 *
 * Elles sont désormais dans leurs propres chunks, mais chargées sans attendre
 * le défilement (voir l'effet de préchargement plus bas) : le visiteur ne
 * rencontre jamais de section vide, on a seulement sorti leur analyse du
 * chemin critique.
 */
const QuiSommesNous = lazy(() => import("@/components/QuiSommesNous"));
const Solutions = lazy(() => import("@/components/Solutions"));
const MegaErp = lazy(() => import("@/components/MegaErp"));
const PourquoiNous = lazy(() => import("@/components/PourquoiNous"));
const Partenaires = lazy(() => import("@/components/Partenaires"));
const Temoignage = lazy(() => import("@/components/Temoignage"));
const References = lazy(() => import("@/components/References"));
const ContactSection = lazy(() => import("@/components/ContactSection"));
const SectionsLibres = lazy(() => import("@/components/SectionsLibres"));

/* Connu à la compilation : le contenu est intégré au bundle, il n'y a rien à
   attendre. La couture de Contact en dépend. */
const AVEC_SECTIONS_LIBRES = SECTIONS_LIBRES.blocs.length > 0;

/** Décalage identique à celui du menu, pour que la barre ne coiffe pas le titre. */
const MARGE_ENTETE = 100;

const Index = () => {
  useSeo(seoByPath["/"]);

  /**
   * Arrivée sur l'accueil avec une ancre — typiquement « ERP » cliqué depuis une
   * page du blog, qui provoque un vrai chargement de page vers `/#megaerp`.
   *
   * Le défilement natif du navigateur vers le fragment a lieu au chargement du
   * document, c'est-à-dire avant que React ait monté la section : il ne trouve
   * rien et laisse le visiteur en haut de page, avec le sentiment que le lien
   * n'a pas marché. On refait donc le trajet une fois la page réellement en
   * place — et seulement après le rideau d'introduction, sinon le défilement se
   * jouerait derrière lui.
   */
  const introFinie = useIntroDone();
  useEffect(() => {
    if (!introFinie) return;
    const cible = decodeURIComponent(window.location.hash.slice(1));
    if (!cible) return;
    // Une frame d'attente : les sections viennent d'être montées, leurs
    // positions ne sont mesurables qu'après la mise en page.
    const t = requestAnimationFrame(() => {
      const el = document.getElementById(cible);
      if (!el) return;
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.pageYOffset - MARGE_ENTETE,
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(t);
  }, [introFinie]);

  /**
   * Préchargement des sections différées, déclenché dès le montage.
   *
   * `lazy()` seul n'irait chercher le chunk qu'au moment du rendu, ce qui est
   * immédiat ici — mais l'important est ce qui suit : quand tous les chunks
   * sont arrivés, la hauteur de la page a changé. ScrollTrigger a mesuré ses
   * repères sur une page plus courte ; sans ce rafraîchissement, le déroulé
   * empilé de « Pourquoi nous » se désynchronise au premier défilement.
   */
  useEffect(() => {
    let annule = false;
    Promise.all([
      import("@/components/QuiSommesNous"),
      import("@/components/Solutions"),
      import("@/components/MegaErp"),
      import("@/components/PourquoiNous"),
      import("@/components/Partenaires"),
      import("@/components/Temoignage"),
      import("@/components/References"),
      import("@/components/ContactSection"),
      import("@/components/SectionsLibres"),
    ])
      .then(() => import("gsap/ScrollTrigger"))
      .then(({ ScrollTrigger }) => {
        if (annule) return;
        // Deux frames : les sections doivent être committées ET peintes pour
        // que leurs positions soient mesurables.
        requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
      })
      .catch(() => {
        /* Un chunk qui n'arrive pas est déjà signalé par Suspense ; inutile de
           faire remonter l'erreur jusqu'à la console du visiteur. */
      });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      <main>
        <Hero />
        <Stats />
        {/* Fallback nul : ces sections sont sous la ligne de flottaison, un
            indicateur de chargement y serait invisible et ferait sauter la
            mise en page au moment de sa disparition. */}
        <Suspense fallback={null}>
          <QuiSommesNous />
          <Solutions />
          <MegaErp />
          <PourquoiNous />
          <Partenaires />
          <Temoignage />
          <References />
          {/* Ce que le client a ajouté lui-même. Ne rend rien quand la liste
              est vide, et la chaîne des coutures reste alors celle d'origine. */}
          <SectionsLibres />
          <ContactSection coutureHaut={AVEC_SECTIONS_LIBRES ? "libres_contact" : "references_contact"} />
        </Suspense>
      </main>
    </div>
  );
};

export default Index;
