/**
 * « Pourquoi nous » — la variante TÉLÉPHONE de la section sombre.
 *
 * CE FICHIER EST LE CODE MEGASOFT D'ORIGINE, REPRIS TEL QUEL.
 *
 * La section a été refaite sur le gabarit du projet MyExoBrain : en-tête
 * accroché, cartes qui s'empilent en éventail, montée liée au défilement. Cette
 * mise en page suppose deux colonnes et une hauteur d'écran confortable ; sur un
 * téléphone, en une seule colonne, l'en-tête et la pile se disputent la même
 * bande et le résultat n'est pas tenable.
 *
 * Plutôt que de dénaturer le portage par des exceptions, le téléphone reçoit la
 * version d'origine du site — celle qui avait été conçue pour ce format, avec sa
 * propre chorégraphie GSAP (`mm.add("(max-width: 1023px)")` plus bas : la
 * séquence s'y joue sans épinglage, pendant que le bloc traverse l'écran).
 *
 * C'est `PourquoiNous.tsx` qui aiguille entre les deux, à 810 px.
 *
 * ⚠️ Les deux variantes affichent le MÊME contenu — quatre arguments, quatre
 * engagements. Modifier un texte ici sans le reporter dans
 * `PourquoiNousBureau.tsx` ferait diverger le site selon l'appareil, et
 * personne ne s'en apercevrait avant longtemps.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CalendarCheck, ShieldCheck, Compass, Lightbulb } from "lucide-react";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import { POURQUOI_NOUS } from "@/contenu";

gsap.registerPlugin(ScrollTrigger);

/*
 * Le TEXTE vient de `content/accueil/pourquoi-nous.json`, comme pour la
 * variante bureau. Les classes, elles, restent ici : les deux affichages ne
 * s'habillent pas pareil -- l'un empile des cartes épinglées, l'autre les fait
 * se suivre -- et Tailwind ne verrait pas une classe assemblée à l'exécution.
 *
 * L'appariement se fait sur la TEINTE, pas sur la position : réordonner les
 * cartes dans le contenu ne doit pas échanger leurs couleurs.
 */
const HABILLAGE = {
  vert: { bg: "bg-emerald-50", dot: "bg-ms-green", wm: "text-ms-green/[0.12]" },
  orange: { bg: "bg-pink-50", dot: "bg-ms-pink", wm: "text-ms-pink/[0.12]" },
  violet: { bg: "bg-violet-50", dot: "bg-ms-mauve", wm: "text-ms-mauve/[0.12]" },
  bleu: { bg: "bg-sky-50", dot: "bg-ms-blue", wm: "text-ms-blue/[0.12]" },
} as const;

const cards = POURQUOI_NOUS.cartes.map((c) => ({
  title: c.titre,
  text: c.texte,
  ...HABILLAGE[c.teinte],
}));

const PICTOS = {
  calendrier: CalendarCheck,
  bouclier: ShieldCheck,
  boussole: Compass,
  ampoule: Lightbulb,
} as const;

const statRow = POURQUOI_NOUS.engagements.map((e) => ({
  icon: PICTOS[e.icone],
  title: e.titre,
  text: e.texte,
}));


const finalRotate = [-2, 2, -1, 1];
const finalTop = [0, 130, 260, 390];

const PourquoiNousTelephone = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const stackWrapRef = useRef<HTMLDivElement>(null);
  const headingBlockRef = useRef<HTMLDivElement>(null);
  const statRowRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      // Block 1: the heading/tagline/CTA animates in on its own, independently
      // of the card stack — a simple fade + rise as it scrolls into view.
      gsap.from(headingBlockRef.current, {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: headingBlockRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });

      // Block 3: the stat row animates in separately too, once the pinned
      // card-stack sequence has released and the section resumes scrolling.
      gsap.from(gsap.utils.toArray(".pq-stat-item"), {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: statRowRef.current,
          start: "top 90%",
          toggleActions: "play none none reverse",
        },
      });

      const els = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      if (els.length === 0) return;

      // Toute la séquence (pop-in puis empilement), pilotée par le scroll.
      const buildStack = (scrollTrigger: ScrollTrigger.Vars) => {
        gsap.set(els, {
          opacity: 0,
          y: 60,
          scale: 0.7,
          rotate: 0,
          zIndex: (i) => els.length - i,
        });

        const tl = gsap.timeline({ scrollTrigger });

        // Phase 1 gets a fixed share of the scroll range so the pop-in never feels rushed.
        tl.to(els, {
          opacity: 1,
          y: 0,
          scale: 1,
          rotate: (i) => finalRotate[i],
          duration: 1,
          ease: "back.out(1.6)",
          stagger: 0.35,
        })
          // Flip the stacking order right as the collapse begins, so
          // the last card ends up on top of the pile.
          .set(els, { zIndex: (i) => i + 1 })
          // Card 1 settles into the base of the pile first...
          .to(els[0], { scale: 0.95, rotate: 0, duration: 0.6, ease: "power2.inOut" })
          // ...then card 2 stacks onto card 1...
          .to(els[1], { y: -finalTop[1] + 6, scale: 0.95, rotate: 0, duration: 0.6, ease: "power2.inOut" })
          // ...then card 3 stacks onto cards 1 + 2...
          .to(els[2], { y: -finalTop[2] + 12, scale: 0.95, rotate: 0, duration: 0.6, ease: "power2.inOut" })
          // ...then card 4 stacks onto the rest, one at a time, in scroll order.
          .to(els[3], { y: -finalTop[3] + 18, scale: 0.95, rotate: 0, duration: 0.6, ease: "power2.inOut" });
      };

      const mm = gsap.matchMedia();

      // Desktop : la rangée est épinglée à l'écran le temps que la séquence se
      // joue — l'utilisateur voit chaque carte apparaître puis s'empiler,
      // ensuite le scroll reprend normalement.
      mm.add("(min-width: 1024px)", () => {
        buildStack({
          trigger: rowRef.current,
          start: "center center",
          end: "+=1200",
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
        });
      });

      // Mobile : la colonne est trop haute pour être épinglée confortablement ;
      // la séquence se joue pendant que le bloc traverse l'écran.
      mm.add("(max-width: 1023px)", () => {
        buildStack({
          trigger: stackWrapRef.current,
          start: "top 80%",
          end: "bottom 70%",
          scrub: true,
          invalidateOnRefresh: true,
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section id="pourquoi" ref={sectionRef} className="relative scroll-mt-24 bg-ms-ink py-24 md:py-32 overflow-hidden">
      {/* Section accent watermark (white on the dark bg) */}
      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          { text: "CONFIANCE", position: "bottom-8 md:bottom-16 left-3 md:left-[-1%]", size: "text-[13vw] md:text-[9vw]", variant: "outline", color: "0 0% 100%", parallax: 45, opacity: 0.06 },
        ]}
      />
      {/* Couture avec MEGA ERP au-dessus : bas du « ERP ». */}
      <BoundaryWatermark boundary={BOUNDARIES.megaerp_pourquoi} edge="top" />
      {/* Seam into Partenaires below: top half of "?" */}
      <BoundaryWatermark boundary={BOUNDARIES.pourquoi_partenaires} edge="bottom" />

      <div className="container mx-auto px-4 relative">
        <div ref={rowRef} className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          <div ref={headingBlockRef}>
            <span className="inline-block px-3 py-1 rounded-full border border-white/15 text-xs font-bold uppercase tracking-wider text-white/60 mb-6">
              Pourquoi nous
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
              Pourquoi choisir <span className="text-ms-green">Megasoft</span> ?
            </h2>
            <p className="text-white/60 mb-8 max-w-md">
              De l'analyse de vos besoins au support quotidien, on reste impliqués bien après la mise en production.
            </p>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center px-6 py-3 rounded-full bg-ms-green hover:bg-ms-green/90 text-white font-bold text-sm transition-colors"
            >
              Contactez-nous
            </a>
          </div>

          <div ref={stackWrapRef} className="relative h-[520px] max-w-md mx-auto w-full">
            {cards.map((card, i) => (
              <div
                key={card.title}
                ref={(el) => (cardRefs.current[i] = el)}
                className={`absolute left-0 right-0 ${card.bg} rounded-2xl p-6 md:p-7 shadow-2xl overflow-hidden`}
                style={{ top: `${finalTop[i]}px`, willChange: "transform, opacity" }}
              >
                {/* Per-card watermark: the card's own index, tinted with its accent */}
                <span
                  className={`absolute -bottom-8 -right-3 text-[8rem] font-titrage font-black leading-none select-none pointer-events-none tracking-tighter ${card.wm}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${card.dot}`} />
                <h4 className="relative font-bold text-ms-ink mb-2 text-lg">{card.title}</h4>
                <p className="relative text-sm text-ms-ink/60 leading-relaxed max-w-xs">{card.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div ref={statRowRef} className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/10 border-t border-white/10 pt-10">
          {statRow.map((s, i) => (
            <div key={s.title} className="pq-stat-item relative px-4 md:px-6 first:pl-0 overflow-hidden">
              {/* Per-card watermark: an oversized ghost of the card's own icon */}
              <s.icon className="absolute -top-2 -right-1 w-24 h-24 text-white/[0.04] pointer-events-none" strokeWidth={1.5} />
              <s.icon className="relative w-6 h-6 text-ms-green mb-4" />
              <h4 className="relative font-bold text-white mb-1.5 text-sm md:text-base">{s.title}</h4>
              <p className="relative text-xs md:text-sm text-white/50 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PourquoiNousTelephone;
