import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

// Brand palette (matches src/index.css tokens)
const BLUE = "#3B82F6"; // Office
const GREEN = "#22C55E"; // Service
const PINK = "#EC4899"; // Digital

/**
 * Intro concept nº2 — "Éditorial" (light).
 *
 * Where V1 is cosmic and dark (streaks colliding into the mark), V2 speaks the
 * site's own light editorial language: paper background, hairline grid, white
 * card, and the page's signature ghost lettering. Its centrepiece watermark is
 * ALIVE — a giant outlined year that rolls 1990 → 2026 behind the logo while
 * the lockup assembles, retelling the company timeline in one gesture.
 */
const IntroAnimationV2 = ({ onComplete }: { onComplete: () => void }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  // Les tweens infinis (dérive de l'année, des mots-clés, respiration de la
  // carte). On les garde sous la main pour pouvoir figer complètement l'écran
  // au moment du relais — voir plus bas.
  const continuous = useRef<gsap.core.Tween[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => {
        // La chorégraphie est terminée : on ARRÊTE tout mouvement avant de
        // rendre la main. App.tsx enchaîne en montant la page, ce qui bloque le
        // thread principal quelques centaines de ms — un blocage strictement
        // invisible tant que plus rien ne bouge à l'écran. C'est ce qui permet
        // de ne plus jamais monter la page pendant une animation.
        continuous.current.forEach((t) => t.pause());
        onComplete();
      },
      reduce ? 1600 : 3500
    );
    return () => clearTimeout(timer);
  }, [onComplete]);

  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef);

      // Tracé du M par interpolation de la géométrie même du chemin (attribut
      // "d") : à chaque frame le chemin va du départ à la position de la
      // plume. Les deux extrémités sont de VRAIS caps ronds natifs — aucun
      // dash, aucun masque, aucune transformation. Au départ, "M x y" sans
      // segment ne rend rien (spec SVG) : écran garanti vierge.
      // `selector()` déduit le type d'élément du nom de balise ; « path » n'est
      // pas du HTML, il retombe donc sur l'union des éléments HTML. Le détour
      // par `unknown` est la seule voie : les deux types ne se recouvrent pas.
      const markPaths = q(".i2-mark path") as unknown as SVGPathElement[];
      const traits: [number, number][][] = [
        [[23, 106], [104, 27]],
        [[118, 106], [201, 27], [205, 106]],
      ];
      const traceTrait = (i: number, t: number) => {
        const pts = traits[i];
        let remaining =
          t *
          pts.slice(1).reduce((acc, p, k) => acc + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let k = 1; k < pts.length && remaining > 0; k++) {
          const [ax, ay] = pts[k - 1];
          const [bx, by] = pts[k];
          const segLen = Math.hypot(bx - ax, by - ay);
          if (remaining >= segLen) {
            d += ` L ${bx} ${by}`;
            remaining -= segLen;
          } else {
            const r = remaining / segLen;
            d += ` L ${(ax + (bx - ax) * r).toFixed(2)} ${(ay + (by - ay) * r).toFixed(2)}`;
            remaining = 0;
          }
        }
        markPaths[i]?.setAttribute("d", d);
      };

      // Accessibilité + machines modestes : si l'utilisateur préfère moins
      // d'animation, on rend directement l'état final (logo tracé, année 2026),
      // sans timeline ni tweens en boucle — quasi aucun coût GPU.
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) {
        gsap.set(".i2-band", { xPercent: 130 });
        traceTrait(0, 1);
        traceTrait(1, 1);
        if (yearRef.current) yearRef.current.textContent = "2026";
        return;
      }

      // ---- Initial states -------------------------------------------------
      gsap.set(".i2-band", { xPercent: -115 });
      gsap.set(".i2-grid-v", { scaleY: 0, transformOrigin: "top" });
      gsap.set(".i2-grid-h", { scaleX: 0, transformOrigin: "left" });
      gsap.set(".i2-card", { opacity: 0, scale: 1.45, filter: "blur(10px)" });
      gsap.set(".i2-ripple", { opacity: 0, scale: 0.6, transformOrigin: "center" });
      gsap.set(".i2-word-img", { yPercent: 112 });
      gsap.set(".i2-office", { opacity: 0, y: 10, scale: 0.8 });
      gsap.set(".i2-rule", { scaleX: 0 });
      gsap.set(".i2-tagline", { opacity: 0, letterSpacing: "0.9em" });
      gsap.set(".i2-swatch", { opacity: 0, scale: 0, transformOrigin: "center" });
      gsap.set(".i2-year-wrap", { opacity: 0 });
      gsap.set(".i2-kw", { opacity: 0 });
      gsap.set(".i2-corner", { opacity: 0 });
      gsap.set(".i2-corner-h", { scaleX: 0 });
      gsap.set(".i2-corner-v", { scaleY: 0 });
      gsap.set(".i2-label", { opacity: 0, y: 6 });

      const tl = gsap.timeline();

      // 1. Three pôle-coloured bands sweep across the paper like a print pass.
      tl.to(".i2-band", {
        xPercent: 115,
        duration: 0.65,
        ease: "power3.inOut",
        stagger: 0.09,
      }, 0);

      // 2. The editorial hairline grid draws itself.
      tl.to(".i2-grid-v", { scaleY: 1, duration: 0.55, ease: "power3.inOut", stagger: 0.07 }, 0.25)
        .to(".i2-grid-h", { scaleX: 1, duration: 0.55, ease: "power3.inOut", stagger: 0.07 }, 0.35);

      // 3. The living watermark fades up and the year starts rolling 1990 → 2026.
      tl.to(".i2-year-wrap", { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.55);
      const counter = { y: 1990 };
      tl.to(counter, {
        y: 2026,
        duration: 2.1,
        ease: "power2.inOut",
        onUpdate: () => {
          if (yearRef.current) yearRef.current.textContent = String(Math.round(counter.y));
        },
      }, 0.7);

      // Corner keywords whisper in.
      tl.to(".i2-kw", { opacity: 1, duration: 0.8, ease: "power2.out", stagger: 0.15 }, 0.8);

      // Viewfinder corner marks draw in, like a frame locking onto the page.
      tl.to(".i2-corner", { opacity: 1, duration: 0.4, ease: "power1.out", stagger: 0.05 }, 0.15)
        .to(".i2-corner-h", { scaleX: 1, duration: 0.45, ease: "power3.out", stagger: 0.05 }, 0.15)
        .to(".i2-corner-v", { scaleY: 1, duration: 0.45, ease: "power3.out", stagger: 0.05 }, 0.15);

      // Editorial coordinate label breathes in near the end.
      tl.to(".i2-label", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 2.5);

      // 4. The mark's card stamps onto the page, with an ink ripple.
      tl.to(".i2-card", { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.6, ease: "back.out(1.5)" }, 0.7)
        .to(".i2-ripple", { opacity: 0.3, scale: 1, duration: 0.1 }, 0.78)
        .to(".i2-ripple", { opacity: 0, scale: 2.1, duration: 0.7, ease: "power2.out" }, 0.88);

      // 4b. Le M se trace au fur et à mesure, d'un seul geste :
      //  · durées proportionnelles aux longueurs des traits (114 vs 194
      //    unités) → la plume garde une vitesse constante d'un trait à
      //    l'autre, comme une seule main qui écrit ;
      //  · le trait 2 part quand la plume du trait 1 se pose (~95 %) —
      //    continuité du mouvement, aucun temps mort ;
      //  · power3.out : départ vif, atterrissage long et soyeux.
      const trace1 = { t: 0 };
      const trace2 = { t: 0 };
      tl.to(trace1, { t: 1, duration: 0.4, ease: "power3.out", onUpdate: () => traceTrait(0, trace1.t) }, 1.35)
        .to(trace2, { t: 1, duration: 0.62, ease: "power3.out", onUpdate: () => traceTrait(1, trace2.t) }, 1.65);

      // 5. Wordmark rises from its baseline (masked), then "Office" pops in.
      tl.to(".i2-word-img", { yPercent: 0, duration: 0.6, ease: "power3.out" }, 1.25)
        .to(".i2-office", { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 1.6);

      // 6. Signature: tri-colour rule + over-tracked tagline breathing into place.
      tl.to(".i2-rule", { scaleX: 1, duration: 0.55, ease: "power2.inOut" }, 1.85)
        .to(".i2-tagline", { opacity: 1, letterSpacing: "0.34em", duration: 1.0, ease: "power3.out" }, 1.95);

      // 7. The three pôle swatches clip onto the rule, one per colour.
      tl.to(".i2-swatch", { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.5)", stagger: 0.12 }, 2.9);

      // ---- Continuous tweens ----------------------------------------------
      // The giant year drifts very slowly upward, like the site's watermarks.
      const yearDrift = gsap.to(q(".i2-year-wrap"), { y: -26, duration: 4.2, ease: "sine.out" });
      // Corner keywords drift.
      const kwDrift = gsap.to(q(".i2-kw"), {
        y: "+=12",
        duration: 3.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.4, from: "end" },
      });
      // The card breathes once settled.
      const cardBreath = gsap.to(q(".i2-card"), { y: -6, duration: 2.0, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.6 });

      continuous.current = [yearDrift, kwDrift, cardBreath];
    },
    { scope: rootRef }
  );

  return (
    <motion.div
      key="intro-component"
      initial={{ y: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
      exit={{ y: "-100%", borderBottomLeftRadius: "3rem", borderBottomRightRadius: "3rem" }}
      transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-ms-paper"
    >
      <div ref={rootRef} className="absolute inset-0 flex items-center justify-center">
        {/* ---------- Print-pass colour bands (sweep once, then leave) ---------- */}
        {[BLUE, PINK, GREEN].map((c) => (
          <div
            key={c}
            className="i2-band absolute inset-y-[-10%] left-0 right-0 pointer-events-none"
            style={{ background: c, opacity: 0.16, transform: "skewX(-14deg)" }}
          />
        ))}

        {/* ---------- Editorial hairline grid ---------- */}
        {["25%", "50%", "75%"].map((x) => (
          <div key={`v-${x}`} className="i2-grid-v absolute top-0 bottom-0 w-px bg-ms-ink/[0.06]" style={{ left: x }} />
        ))}
        {["33%", "66%"].map((y) => (
          <div key={`h-${y}`} className="i2-grid-h absolute left-0 right-0 h-px bg-ms-ink/[0.06]" style={{ top: y }} />
        ))}

        {/* Faint dot-grid + soft tri-colour auras, same vocabulary as the site */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_55%_55%_at_50%_50%,black,transparent)]"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--ms-ink)/0.12) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-[12%] right-[10%] w-[30vw] h-[30vw] max-w-[420px] max-h-[420px] rounded-full bg-ms-blue/[0.07] blur-[64px] pointer-events-none" />
        <div className="absolute bottom-[8%] left-[8%] w-[26vw] h-[26vw] max-w-[360px] max-h-[360px] rounded-full bg-ms-mauve/[0.05] blur-[64px] pointer-events-none" />

        {/* Viewfinder corner marks — a frame locking onto the page */}
        {[
          { pos: "top-[7%] left-[6%]", h: "left-0 top-0", v: "left-0 top-0", oh: "left" as const, ov: "top" as const },
          { pos: "top-[7%] right-[6%]", h: "right-0 top-0", v: "right-0 top-0", oh: "right" as const, ov: "top" as const },
          { pos: "bottom-[7%] left-[6%]", h: "left-0 bottom-0", v: "left-0 bottom-0", oh: "left" as const, ov: "bottom" as const },
          { pos: "bottom-[7%] right-[6%]", h: "right-0 bottom-0", v: "right-0 bottom-0", oh: "right" as const, ov: "bottom" as const },
        ].map((c, i) => (
          <div key={i} className={`i2-corner absolute w-4 h-4 md:w-5 md:h-5 pointer-events-none ${c.pos}`}>
            <div
              className={`i2-corner-h absolute h-px w-full bg-ms-ink/25 ${c.h}`}
              style={{ transformOrigin: c.oh }}
            />
            <div
              className={`i2-corner-v absolute w-px h-full bg-ms-ink/25 ${c.v}`}
              style={{ transformOrigin: c.ov }}
            />
          </div>
        ))}

        {/* Editorial coordinate label, bottom-centre — a small "printer's mark" */}
        <div className="i2-label absolute bottom-[6%] left-1/2 -translate-x-1/2 text-[9px] md:text-[10px] font-semibold tracking-[0.3em] uppercase text-ms-ink/30 select-none pointer-events-none whitespace-nowrap">
          Alger · Algérie — Depuis 1990
        </div>

        {/* ---------- The living watermark: giant year rolling 1990 → 2026 ---------- */}
        <div
          className="i2-year-wrap absolute inset-x-0 top-1/2 -translate-y-[62%] text-center font-black leading-none tracking-tighter select-none pointer-events-none text-[38vw] md:text-[24vw]"
          style={{ color: "transparent", WebkitTextStroke: "2px hsl(var(--ms-ink) / 0.07)" }}
        >
          <span ref={yearRef} className="tabular-nums">1990</span>
        </div>

        {/* Corner keyword watermarks (corner-slot discipline: TL stays clean) */}
        <span className="i2-kw absolute top-[10%] right-[6%] font-black tracking-tighter uppercase select-none pointer-events-none text-[6vw] md:text-[3.4vw] text-ms-blue/10">
          ERP · MES
        </span>
        <span className="i2-kw absolute bottom-[10%] left-[6%] font-black tracking-tighter uppercase select-none pointer-events-none text-[6vw] md:text-[3.4vw] text-ms-green/10">
          CLOUD · TMS
        </span>

        {/* ---------- Foreground lockup ---------- */}
        <div className="relative flex flex-col items-center">
          {/* Ink ripple behind the card stamp */}
          <div className="i2-ripple absolute -top-6 w-40 h-40 rounded-[2rem] border-2 border-ms-ink/20 pointer-events-none" />

          {/* The mark, stamped on a white site-style card — vectoriel. Chaque
              trait porte un translate hors-cadre DANS le markup (invisible dès
              le premier rendu), puis glisse en place le long de son axe. */}
          {/* The mark, stamped on a white site-style card — tracé vectoriel.
              Dans le markup, chaque chemin ne contient qu'un point de départ
              ("M x y" sans segment) : la spec SVG garantit qu'il ne rend
              RIEN, pas même un point, tant que le tracé n'a pas commencé. */}
          <div className="i2-card relative bg-white rounded-[2rem] border border-black/5 shadow-[0_24px_70px_rgba(0,0,0,0.10)] px-10 py-8 md:px-12 md:py-10">
            <svg viewBox="-3 -3 233 139" className="i2-mark h-12 md:h-16 w-auto" aria-hidden="true" focusable="false">
              <g className="text-ms-blue" stroke="currentColor" strokeWidth={50} strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M 23 106" />
                <path d="M 118 106" />
              </g>
            </svg>
          </div>

          {/* Wordmark rising from a masked baseline — même animation que la
              version de base, en texte vectoriel */}
          <div
            className="flex items-end gap-[0.4em] mt-8 leading-none text-[26px] md:text-[34px]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <div className="relative overflow-hidden">
              <span className="i2-word-img block font-extrabold tracking-[-0.02em] text-ms-ink">MEGASOFT</span>
            </div>
            <span className="i2-office font-medium text-ms-blue">Office</span>
          </div>

          {/* Tri-colour rule + pôle swatches + tagline */}
          <div className="flex flex-col items-center mt-7">
            <div className="relative flex items-center">
              <div
                className="i2-rule h-px w-44 md:w-64 origin-center"
                style={{ background: `linear-gradient(90deg, transparent, ${BLUE}, ${PINK}, ${GREEN}, transparent)` }}
              />
              <div className="absolute inset-x-0 -top-[3px] flex justify-center gap-10 md:gap-14">
                {[BLUE, PINK, GREEN].map((c) => (
                  <span key={c} className="i2-swatch w-[7px] h-[7px] rounded-sm" style={{ background: c }} />
                ))}
              </div>
            </div>
            <p className="i2-tagline mt-5 text-[10px] md:text-xs font-bold uppercase text-ms-ink/50 whitespace-nowrap">
              Éditeur de logiciels de gestion
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default IntroAnimationV2;
