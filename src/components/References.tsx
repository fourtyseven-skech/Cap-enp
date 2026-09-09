import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import { REFERENCES } from "@/contenu";
import { urlLogo } from "@/contenu/logosClients";



/*
 * Les logos viennent de `content/accueil/references.json`, qui ne cite que des
 * noms de fichiers ; `urlLogo` les résout en adresses empreintées.
 *
 * Avant, chaque logo avait sa ligne d'import et sa variable : ajouter un client
 * demandait d'écrire du code. Un logo dont le fichier manque est écarté du
 * ruban et signalé dans la console -- un trou vaut mieux qu'une image cassée,
 * et une page blanche vaudrait bien pire.
 */
const logos = REFERENCES.logos
  .map((l) => ({ name: l.nom, src: urlLogo(l.fichier) }))
  .filter((l): l is { name: string; src: string } => {
    if (l.src) return true;
    console.warn(`[références] fichier introuvable pour « ${l.name} »`);
    return false;
  });

const textOnly: string[] = [];

const Strip = ({ reverse = false, running }: { reverse?: boolean; running: boolean }) => (
  <div className="flex overflow-hidden select-none">
    <div
      className={`flex items-center gap-4 flex-shrink-0 ${reverse ? "animate-[marquee_35s_linear_infinite_reverse]" : "animate-marquee"}`}
      style={{
        // Sans `will-change`, le navigateur ne promeut pas le ruban en calque
        // composité : il repeint les 136 cartes (ombre + bordure + logo) à
        // chaque frame. Avec, le défilement n'est plus qu'une translation de
        // texture sur le GPU.
        willChange: "transform",
        backfaceVisibility: "hidden",
        // Le ruban est mis en pause hors écran : deux animations infinies qui
        // tournent en permanence volaient des frames au reste de la page.
        animationPlayState: running ? "running" : "paused",
      }}
    >
      {[...Array(2)].map((_, dup) => (
        <div key={dup} className="flex items-center gap-5" aria-hidden={dup === 1}>
          {logos.map((logo) => (
            <div
              key={`${dup}-${logo.name}`}
              className="flex items-center justify-center h-24 md:h-28 px-10 rounded-2xl bg-white border border-black/5 shadow-sm flex-shrink-0"
            >
              <img
                src={logo.src}
                alt={logo.name}
                // Pas de `loading="lazy"` : le ruban défile horizontalement,
                // les logos apparaîtraient en trous blancs au fil du
                // défilement. On les sort simplement du chemin critique.
                fetchpriority="low"
                decoding="async"
                draggable={false}
                className="h-12 md:h-14 w-auto object-contain max-w-[180px]"
              />
            </div>
          ))}
          {textOnly.map((name) => (
            <div
              key={`${dup}-${name}`}
              className="flex items-center gap-2.5 h-24 md:h-28 px-8 rounded-2xl bg-white border border-black/5 shadow-sm flex-shrink-0"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-ms-blue" />
              <span className="text-lg md:text-xl font-bold text-ms-ink/70 whitespace-nowrap">{name}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const References = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stripsRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);

  // Les rubans ne défilent que lorsqu'ils sont réellement à l'écran.
  useEffect(() => {
    const el = stripsRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), {
      rootMargin: "200px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="references"
      ref={sectionRef}
      className="py-24 md:py-32 relative scroll-mt-24 overflow-hidden bg-ms-paper/60"
    >
      {/* Section accent watermark */}
      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          { text: "CONFIANCE", position: "top-6 md:top-10 left-3 md:left-[-1%]", size: "text-[13vw] md:text-[8vw]", variant: "outline", color: "var(--ms-green)", parallax: 40, opacity: 0.06 },
        ]}
      />
      {/* Seam into Contact below: top half of "300+" */}
      {/* Couture avec Témoignage au-dessus : bas du « 12K ». */}
      <BoundaryWatermark boundary={BOUNDARIES.temoignage_references} edge="top" />
      <BoundaryWatermark boundary={BOUNDARIES.references_contact} edge="bottom" />

      {/* Two soft brand-color washes bracketing the marquee strips */}
      <div className="absolute -top-20 -left-20 w-[220px] h-[220px] md:w-[420px] md:h-[420px] rounded-full bg-ms-green/[0.07] blur-[50px] md:blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[220px] h-[220px] md:w-[420px] md:h-[420px] rounded-full bg-ms-pink/[0.07] blur-[50px] md:blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
            Ils nous font confiance
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight">
            De la PME familiale au groupe international
          </h2>
        </motion.div>
      </div>

      <div
        ref={stripsRef}
        className="space-y-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      >
        <Strip running={running} />
        <Strip reverse running={running} />
      </div>
    </section>
  );
};

export default References;
