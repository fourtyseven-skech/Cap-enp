import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import introMark from "@/assets/megasoft/intro-mark.png";
import introMegasoft from "@/assets/megasoft/intro-megasoft-white.png";
import introOffice from "@/assets/megasoft/intro-office.png";

// Brand palette (matches src/index.css tokens)
const BLUE = "#3B82F6"; // Office
const GREEN = "#22C55E"; // Service
const PINK = "#EC4899"; // Digital
const MAUVE = "#A855F7"; // transition

// The three pôles, as streaks converging from three directions into the mark.
const STREAKS = [
  { x: 0, y: -116, c: BLUE },
  { x: -100, y: 60, c: GREEN },
  { x: 100, y: 60, c: PINK },
];

// Orbit dots (one per brand hue) placed at the cardinal points of the ring.
const ORBIT = [
  { x: 0, y: -108, c: BLUE },
  { x: 108, y: 0, c: GREEN },
  { x: 0, y: 108, c: MAUVE },
  { x: -108, y: 0, c: PINK },
];

// Spark particles ejected by the collision — one burst of brand-coloured debris.
const PARTICLE_COLORS = [BLUE, GREEN, PINK, MAUVE];
const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + 0.35;
  const dist = 70 + (i % 4) * 26;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    r: i % 3 === 0 ? 3.4 : 2.2,
    c: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  };
});

// Drifting keyword watermarks — the domains Megasoft covers.
const KEYWORDS = [
  { t: "ERP", cls: "top-[16%] left-[12%]", c: "text-ms-blue/10" },
  { t: "MES", cls: "top-[26%] right-[14%]", c: "text-ms-green/10" },
  { t: "CLOUD", cls: "bottom-[24%] left-[16%]", c: "text-ms-pink/10" },
  { t: "APS", cls: "bottom-[18%] right-[18%]", c: "text-ms-mauve/10" },
  { t: "TMS", cls: "top-[44%] left-[6%]", c: "text-ms-green/10" },
  { t: "SUPPLY CHAIN", cls: "bottom-[38%] right-[6%]", c: "text-ms-blue/10" },
];

const ARC_R = 96;
const ARC_C = 2 * Math.PI * ARC_R;

const IntroAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const streakRefs = useRef<(SVGLineElement | null)[]>([]);
  const tipRefs = useRef<(SVGCircleElement | null)[]>([]);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    const timer = setTimeout(onComplete, 3800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef);

      // ---- Initial states -------------------------------------------------
      gsap.set(".intro-mark", { opacity: 0, scale: 0.2, rotate: -35 });
      gsap.set(".intro-conic", { opacity: 0, scale: 0.6, rotate: -90 });
      gsap.set(".intro-orbit", { opacity: 0, scale: 0.9 });
      gsap.set(".intro-dashed", { opacity: 0 });
      gsap.set(".intro-flash", { opacity: 0, scale: 0, transformOrigin: "center" });
      gsap.set(".intro-shock", { opacity: 0, scale: 0.2, transformOrigin: "center" });
      gsap.set(".intro-word-wrap", { opacity: 0 });
      gsap.set(".intro-word-img", { xPercent: -108 });
      gsap.set(".intro-shine", { xPercent: -160, opacity: 0 });
      gsap.set(".intro-office", { opacity: 0, scale: 0.6, y: 6 });
      gsap.set(".intro-tagline", { opacity: 0, letterSpacing: "1.2em" });
      gsap.set(".intro-tagline-rule", { scaleX: 0 });
      gsap.set(".intro-arc", { strokeDashoffset: ARC_C });
      gsap.set(".intro-bar", { scaleX: 0 });
      particleRefs.current.forEach((p) => {
        if (p) gsap.set(p, { attr: { cx: 0, cy: 0 }, opacity: 0, scale: 1, transformOrigin: "center" });
      });

      // Prime the converging streaks (hidden, ready to draw toward centre).
      STREAKS.forEach((s, i) => {
        const line = streakRefs.current[i];
        const tip = tipRefs.current[i];
        const len = Math.hypot(s.x, s.y);
        if (line) gsap.set(line, { attr: { "stroke-dasharray": len, "stroke-dashoffset": len }, opacity: 1 });
        if (tip) gsap.set(tip, { attr: { cx: s.x, cy: s.y }, opacity: 0 });
      });

      const tl = gsap.timeline();

      // 1. Three pôle-coloured streaks shoot inward and collide.
      STREAKS.forEach((s, i) => {
        const line = streakRefs.current[i];
        const tip = tipRefs.current[i];
        tl.to(line, { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.in" }, 0.05 * i);
        tl.to(tip, { opacity: 1, duration: 0.12 }, 0.05 * i);
        tl.to(tip, { attr: { cx: 0, cy: 0 }, duration: 0.5, ease: "power2.in" }, 0.05 * i);
        tl.to([line, tip], { opacity: 0, duration: 0.25, ease: "power1.out" }, 0.5 + 0.05 * i);
      });

      // 2. Collision: flash + spark burst + double shockwave.
      tl.to(".intro-flash", { opacity: 0.9, scale: 1, duration: 0.18, ease: "power2.out" }, 0.5)
        .to(".intro-flash", { opacity: 0, scale: 1.6, duration: 0.45, ease: "power2.out" }, 0.62);

      particleRefs.current.forEach((p, i) => {
        if (!p) return;
        const spec = PARTICLES[i];
        tl.to(p, { opacity: 1, duration: 0.05 }, 0.55)
          .to(p, { attr: { cx: spec.x, cy: spec.y }, duration: 0.75, ease: "power3.out" }, 0.55)
          .to(p, { opacity: 0, scale: 0.2, duration: 0.4, ease: "power1.in" }, 0.95);
      });

      tl.to(".intro-shock-1", { opacity: 0.5, scale: 1, duration: 0.05 }, 0.55)
        .to(".intro-shock-1", { scale: 2.6, opacity: 0, duration: 0.8, ease: "power2.out" }, 0.6)
        .to(".intro-shock-2", { opacity: 0.35, scale: 1, duration: 0.05 }, 0.72)
        .to(".intro-shock-2", { scale: 3.4, opacity: 0, duration: 0.9, ease: "power2.out" }, 0.77);

      // 3. The mark springs out of the flash; halo + rings assemble around it.
      tl.to(".intro-mark", { opacity: 1, scale: 1, rotate: 0, duration: 0.7, ease: "back.out(2.2)" }, 0.6)
        .to(".intro-conic", { opacity: 0.55, scale: 1, rotate: 270, duration: 0.9, ease: "power2.out" }, 0.6)
        .to(".intro-orbit", { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 0.9)
        .to(".intro-dashed", { opacity: 1, duration: 0.6, ease: "power2.out" }, 1.0);

      // 4. Wordmark slides in behind a moving light sweep.
      tl.to(".intro-word-wrap", { opacity: 1, duration: 0.1 }, 1.05)
        .to(".intro-word-img", { xPercent: 0, duration: 0.65, ease: "power3.out" }, 1.05)
        .fromTo(
          ".intro-shine",
          { xPercent: -160, opacity: 0.9 },
          { xPercent: 260, opacity: 0.9, duration: 0.8, ease: "power2.inOut" },
          1.15
        )
        .to(".intro-shine", { opacity: 0, duration: 0.2 }, 1.8);

      // 5. "Office" pops in to complete the lockup.
      tl.to(".intro-office", { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(2.4)" }, 1.55);

      // 6. Signature line: "ÉDITEUR DE LOGICIELS — DEPUIS 1990" breathes open
      //    from an over-tracked whisper into place, under a growing hairline.
      tl.to(".intro-tagline-rule", { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, 1.9)
        .to(
          ".intro-tagline",
          { opacity: 1, letterSpacing: "0.42em", duration: 1.1, ease: "power3.out" },
          1.95
        );

      // ---- Continuous / long-running tweens -------------------------------
      // Progress arc draws once across the whole sequence.
      gsap.to(".intro-arc", { strokeDashoffset: 0, duration: 3.2, ease: "power1.inOut" });
      // Bottom tri-colour bar.
      gsap.to(".intro-bar", { scaleX: 1, duration: 3.2, ease: "power1.inOut" });
      // Orbit ring keeps rotating slowly.
      gsap.to(q(".intro-orbit"), { rotate: 360, duration: 14, ease: "none", repeat: -1, transformOrigin: "center" });
      // Dashed texture ring counter-rotates.
      gsap.to(q(".intro-dashed"), { rotate: -360, duration: 26, ease: "none", repeat: -1, transformOrigin: "center" });
      // Halo keeps a slow drift after its entrance.
      gsap.to(q(".intro-conic"), { rotate: "+=360", duration: 8, ease: "none", repeat: -1, delay: 1.5 });
      // Mark breathes gently once settled.
      gsap.to(q(".intro-mark"), { scale: 1.06, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
      // Ambient aura group slowly rotates.
      gsap.to(q(".intro-auras"), { rotate: 360, duration: 40, ease: "none", repeat: -1, transformOrigin: "center" });
      // Big outlined watermark M breathes.
      gsap.to(q(".intro-ghost-m"), { scale: 1.05, opacity: 0.05, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      // Keyword watermarks drift.
      gsap.to(q(".intro-kw"), {
        y: "+=14",
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.3, from: "random" },
      });
    },
    { scope: rootRef }
  );

  return (
    <motion.div
      key="intro-component"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.14, filter: "blur(8px)" }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-ms-dark"
    >
      <div ref={rootRef} className="absolute inset-0 flex flex-col items-center justify-center">
        {/* ---------- Custom watermark background ---------- */}
        {/* Tri-colour ambient auras (blue / pink / green) */}
        <div className="intro-auras absolute inset-0 pointer-events-none">
          <div className="absolute top-[8%] left-[14%] w-[42vw] h-[42vw] rounded-full bg-ms-blue/20 blur-[120px]" />
          <div className="absolute bottom-[6%] right-[12%] w-[40vw] h-[40vw] rounded-full bg-ms-pink/15 blur-[120px]" />
          <div className="absolute top-[40%] right-[26%] w-[34vw] h-[34vw] rounded-full bg-ms-green/15 blur-[120px]" />
        </div>

        {/* Faint dot-grid */}
        <div
          className="absolute inset-0 opacity-[0.5] pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
          style={{
            backgroundImage: "radial-gradient(hsl(0 0% 100% / 0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {/* Giant outlined "M" watermark behind everything */}
        <div
          className="intro-ghost-m absolute text-[64vw] md:text-[40vw] font-black leading-none select-none pointer-events-none"
          style={{ color: "transparent", WebkitTextStroke: "2px hsl(0 0% 100% / 0.04)", opacity: 0.035 }}
        >
          M
        </div>

        {/* Drifting keyword watermarks */}
        {KEYWORDS.map((k) => (
          <span
            key={k.t}
            className={`intro-kw absolute font-black tracking-tighter uppercase select-none pointer-events-none text-[7vw] md:text-[4vw] ${k.cls} ${k.c}`}
          >
            {k.t}
          </span>
        ))}

        {/* ---------- Logo stage ---------- */}
        <div className="relative flex flex-col items-center">
          {/* Icon + rings + streaks + halo */}
          <div className="relative flex items-center justify-center w-[240px] h-[240px] md:w-[280px] md:h-[280px]">
            {/* Rotating tri-colour conic halo */}
            <div
              className="intro-conic absolute w-[190px] h-[190px] md:w-[220px] md:h-[220px] rounded-full pointer-events-none"
              style={{
                background: `conic-gradient(from -90deg, ${BLUE}, ${MAUVE}, ${PINK}, ${GREEN}, ${BLUE})`,
                WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 61%, black 74%, transparent 77%)",
                maskImage: "radial-gradient(circle, transparent 58%, black 61%, black 74%, transparent 77%)",
                filter: "blur(1px)",
              }}
            />

            {/* SVG: converging streaks, progress arc, orbit ring, sparks, shockwaves */}
            <svg
              viewBox="-120 -120 240 240"
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            >
              <defs>
                <linearGradient id="introArc" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={BLUE} />
                  <stop offset="45%" stopColor={MAUVE} />
                  <stop offset="75%" stopColor={PINK} />
                  <stop offset="100%" stopColor={GREEN} />
                </linearGradient>
              </defs>

              {/* Faint base ring */}
              <circle cx="0" cy="0" r={ARC_R} fill="none" stroke="hsl(0 0% 100% / 0.06)" strokeWidth="2" />
              {/* Progress arc */}
              <circle
                className="intro-arc"
                cx="0"
                cy="0"
                r={ARC_R}
                fill="none"
                stroke="url(#introArc)"
                strokeWidth="3"
                strokeLinecap="round"
                transform="rotate(-90)"
                style={{ strokeDasharray: ARC_C }}
              />

              {/* Dashed texture ring, counter-rotating */}
              <circle
                className="intro-dashed"
                cx="0"
                cy="0"
                r="86"
                fill="none"
                stroke="hsl(0 0% 100% / 0.08)"
                strokeWidth="1"
                strokeDasharray="2 9"
              />

              {/* Orbit ring + pôle dots */}
              <g className="intro-orbit">
                <circle cx="0" cy="0" r="108" fill="none" stroke="hsl(0 0% 100% / 0.05)" strokeWidth="1" />
                {ORBIT.map((o, i) => (
                  <circle key={i} cx={o.x} cy={o.y} r="4" fill={o.c} style={{ filter: `drop-shadow(0 0 5px ${o.c})` }} />
                ))}
              </g>

              {/* Converging streaks + glowing tips */}
              {STREAKS.map((s, i) => (
                <line
                  key={`l-${i}`}
                  ref={(el) => (streakRefs.current[i] = el)}
                  x1={s.x}
                  y1={s.y}
                  x2={0}
                  y2={0}
                  stroke={s.c}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ))}
              {STREAKS.map((s, i) => (
                <circle
                  key={`t-${i}`}
                  ref={(el) => (tipRefs.current[i] = el)}
                  cx={s.x}
                  cy={s.y}
                  r="4"
                  fill={s.c}
                  style={{ filter: `drop-shadow(0 0 6px ${s.c})` }}
                />
              ))}

              {/* Collision spark particles */}
              {PARTICLES.map((p, i) => (
                <circle
                  key={`p-${i}`}
                  ref={(el) => (particleRefs.current[i] = el)}
                  cx="0"
                  cy="0"
                  r={p.r}
                  fill={p.c}
                  style={{ filter: `drop-shadow(0 0 4px ${p.c})` }}
                />
              ))}

              {/* Double shockwave rings */}
              <circle className="intro-shock intro-shock-1" cx="0" cy="0" r="34" fill="none" stroke="hsl(0 0% 100% / 0.7)" strokeWidth="1.6" />
              <circle className="intro-shock intro-shock-2" cx="0" cy="0" r="34" fill="none" stroke={`${BLUE}AA`} strokeWidth="1.2" />

              {/* Collision flash */}
              <circle className="intro-flash" cx="0" cy="0" r="30" fill="hsl(0 0% 100% / 0.9)" />
            </svg>

            {/* The mark */}
            <img
              src={introMark}
              alt=""
              className="intro-mark relative h-14 md:h-16 w-auto object-contain"
              style={{ filter: `drop-shadow(0 0 22px ${BLUE}66)` }}
            />
          </div>

          {/* Wordmark lockup */}
          <div className="flex items-end gap-2 mt-6">
            <div className="intro-word-wrap relative overflow-hidden">
              <img src={introMegasoft} alt="Megasoft" className="intro-word-img h-7 md:h-9 w-auto object-contain" />
              {/* Light sweep */}
              <div
                className="intro-shine absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
                style={{
                  background: "linear-gradient(105deg, transparent, hsl(0 0% 100% / 0.85), transparent)",
                  filter: "blur(2px)",
                }}
              />
            </div>
            <img src={introOffice} alt="Office" className="intro-office h-7 md:h-9 w-auto object-contain" />
          </div>

          {/* Signature line replacing the old chips */}
          <div className="flex flex-col items-center mt-8">
            <div
              className="intro-tagline-rule h-px w-40 md:w-56 origin-center"
              style={{ background: `linear-gradient(90deg, transparent, ${BLUE}, ${MAUVE}, ${PINK}, transparent)` }}
            />
            <p className="intro-tagline mt-4 text-[10px] md:text-xs font-bold uppercase text-white/60 whitespace-nowrap">
              Éditeur de logiciels · depuis 1990
            </p>
          </div>
        </div>

        {/* Bottom tri-colour progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
          <div
            className="intro-bar h-full origin-left"
            style={{ background: `linear-gradient(90deg, ${BLUE}, ${MAUVE}, ${PINK}, ${GREEN})` }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default IntroAnimation;
