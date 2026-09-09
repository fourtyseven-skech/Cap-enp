import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useInView } from "framer-motion";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import { QUI_SOMMES_NOUS, anneesDExpertise } from "@/contenu";
import { useRenduStatique } from "@/lib/renduStatique";

gsap.registerPlugin(ScrollTrigger);

const AnimatedNumber = ({ value }: { value: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  // Dans le HTML pré-généré aucun effet ne tourne : sans ce drapeau le compteur
  // y resterait figé sur son zéro et un robot lirait « 0 années d'expertise ».
  // Même mécanique que le bandeau de chiffres (`Stats.tsx`).
  const statique = useRenduStatique();

  useEffect(() => {
    if (!isInView) return;
    const controls = gsap.to(
      { n: 0 },
      {
        n: value,
        duration: 1.6,
        ease: "power2.out",
        onUpdate: function () {
          if (ref.current) ref.current.textContent = Math.round(this.targets()[0].n).toString();
        },
      }
    );
    // Accolades obligatoires : `kill()` renvoie le Tween (API chaînable), et
    // React refuse une fonction de nettoyage qui renvoie une valeur.
    return () => {
      controls.kill();
    };
  }, [isInView, value]);

  return <span ref={ref}>{statique ? value : 0}</span>;
};

/*
 * Le contenu de cette section vit dans `content/accueil/qui-sommes-nous.json`.
 *
 * Il y a été sorti avec une garantie : le HTML produit par le build est
 * identique, au caractère près, à celui d'avant l'extraction.
 *
 * Ce qui reste ici est de la MISE EN PAGE, et rien d'autre. La règle pour la
 * suite : si une valeur décrit ce que l'entreprise raconte, elle va dans le
 * JSON ; si elle décrit comment c'est affiché, elle reste dans le composant.
 *
 * Trois points que le schéma protège, et qu'il ne faut pas contourner :
 *
 *   · le titre est en DEUX champs -- la phrase est coupée en noir puis gris.
 *     Un champ unique obligerait à saisir du balisage depuis le panel ;
 *   · il y a exactement TROIS colonnes, une par pôle. La grille est en
 *     `md:grid-cols-3` ;
 *   · l'année de fondation est une DONNÉE, jamais un nombre d'années. La
 *     section affichait « 35+ » : juste à l'écriture, faux l'année suivante.
 */

const QuiSommesNous = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from(".qsn-reveal", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section id="apropos" ref={sectionRef} className="py-24 md:py-32 relative scroll-mt-24 overflow-hidden">
      {/* Section accent watermark */}
      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          /* Douze lettres : à 13 vw le mot dépassait la largeur d'un téléphone
             et perdait sa première syllabe. À 10 vw il tient entier. */
          { text: "SAVOIR-FAIRE", position: "top-6 md:top-10 right-3 md:right-[-1%]", size: "text-[10vw] md:text-[9vw]", variant: "outline", parallax: 40, opacity: 0.05 },
        ]}
      />
      {/* Seam into Solutions — top half of "1990" crossing the boundary */}
      <BoundaryWatermark boundary={BOUNDARIES.quisommes_solutions} edge="bottom" />

      <div className="container mx-auto px-4 relative">
        <span className="qsn-reveal inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-8">
          {QUI_SOMMES_NOUS.badge}
        </span>

        {/* Le chiffre est remonté à côté du titre : les colonnes sont passées de
            deux à trois pour porter les trois pôles, et occupaient donc la
            troisième place de la grille. Sur téléphone il redevient une carte
            sous le titre, comme les autres blocs. */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-16 mb-10 md:mb-20">
          <h2 className="qsn-reveal text-2xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] md:leading-[1.1] max-w-3xl">
            {QUI_SOMMES_NOUS.titre_fort}{" "}
            <span className="text-ms-ink/30">{QUI_SOMMES_NOUS.titre_doux}</span>
          </h2>

          <div className="qsn-reveal shrink-0 flex flex-col rounded-2xl bg-ms-blue/[0.06] border border-ms-blue/15 p-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:pb-2">
            <div className="text-4xl md:text-5xl font-titrage font-black text-ms-ink tracking-tight">
              <AnimatedNumber value={anneesDExpertise()} />
            </div>
            <p className="text-sm text-ms-ink/50 uppercase tracking-wider mt-2 font-semibold">
              {QUI_SOMMES_NOUS.libelle_annees}
            </p>
            <p className="text-xs text-ms-ink/40 mt-1">{QUI_SOMMES_NOUS.lieu}</p>
          </div>
        </div>

        {/* Mobile : chaque bloc devient une carte structurée ; desktop : colonnes
            séparées par des filets, exactement comme avant (restauré via md:). */}
        <div className="grid gap-4 md:grid-cols-3 md:gap-0 md:divide-x md:divide-black/10">
          {QUI_SOMMES_NOUS.colonnes.map((col) => (
            <div
              key={col.index}
              className="qsn-reveal rounded-2xl bg-white border border-black/5 shadow-sm p-6 md:rounded-none md:bg-transparent md:border-0 md:shadow-none md:p-0 md:px-10 md:first:pl-0 md:last:pr-0"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ms-blue/10 text-ms-blue text-xs font-mono font-bold md:w-auto md:h-auto md:bg-transparent md:text-ms-ink/40 md:font-normal">
                {col.index}
              </span>
              <h3 className="font-bold text-lg text-ms-ink mt-4 mb-3 md:mt-3">{col.titre}</h3>
              <p className="text-ms-ink/60 text-sm leading-relaxed">{col.texte}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default QuiSommesNous;
