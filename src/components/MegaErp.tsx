import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import { MegasoftMark } from "@/components/brand/MegasoftLogo";
import { MODULES } from "@/components/erp/ecrans";
import { MEGA_ERP } from "@/contenu";

/**
 * Démonstration animée de MEGA ERP.
 *
 * Placée juste après « Solutions » : le visiteur vient d'apprendre que MEGA ERP
 * existe, c'est le moment de le lui montrer plutôt que de continuer à le lui
 * décrire.
 *
 * L'interface réelle n'étant pas disponible, elle est reconstituée en léger,
 * dans la charte du site. Un curseur parcourt la barre latérale, clique, et
 * chaque module apparaît en glissant — la visite se regarde sans rien faire,
 * mais reste interruptible : cliquer soi-même sur un module arrête la boucle et
 * rend la main.
 *
 * Le navigateur qui l'entoure est volontairement générique et sans marque : il
 * sert à poser le contexte (c'est une application web, ouverte dans un onglet)
 * sans suggérer un éditeur ou un navigateur particulier.
 */

const DUREE_ETAPE = 3.4; // secondes passées sur chaque module

/**
 * Notification affichée à l'arrivée sur un module. Elle achève l'illusion
 * d'une application vivante : quelque chose se passe, l'outil réagit.
 */
const NOTIFS: Record<string, string> = {
  tableau: "Indicateurs actualisés",
  commercial: "Facture FA-2026-0913 relancée",
  stocks: "Seuil atteint sur ART-41302",
  compta: "Balance vérifiée — aucun écart",
  production: "OF-2026-0341 terminé",
  paie: "342 bulletins générés",
};

const MegaErp = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [actif, setActif] = useState(0);
  const [visite, setVisite] = useState(true); // la visite guidée tourne-t-elle ?
  /** La timeline de la visite, pour ne suspendre qu'elle. */
  const visiteTl = useRef<gsap.core.Timeline | null>(null);
  const [reduit] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const module = MODULES[actif];

  // Léger redressement 3D à l'approche : la fenêtre se « pose » face au
  // lecteur au fil du défilement. Discret — 6 degrés suffisent à créer la
  // profondeur sans donner l'impression d'un effet gratuit.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "center center"] });
  const inclinaison = useTransform(scrollYProgress, [0, 1], reduit ? [0, 0] : [7, 0]);
  const echelle = useTransform(scrollYProgress, [0, 1], reduit ? [1, 1] : [0.955, 1]);

  /** Interruption : le visiteur prend la main, la visite s'arrête. */
  const choisir = useCallback((i: number) => {
    setVisite(false);
    setActif(i);
  }, []);

  /**
   * Le contenu de l'écran se dépose élément par élément — KPI, puis tableau,
   * puis lignes. Un écran qui apparaît d'un bloc paraît statique ; un écran qui
   * se construit paraît chargé en direct.
   */
  useGSAP(
    () => {
      if (reduit) return;
      const cibles = scene.current?.querySelectorAll(".erp-ecran [data-anim]");
      if (!cibles?.length) return;
      gsap.fromTo(
        cibles,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.035, overwrite: true }
      );
    },
    { scope: scene, dependencies: [actif, reduit] }
  );

  useGSAP(
    () => {
      if (reduit || !visite) return;

      const curseur = scene.current?.querySelector(".erp-curseur");
      const onde = scene.current?.querySelector(".erp-onde");
      if (!curseur || !onde) return;

      // Position de repos du curseur, hors de la barre latérale.
      gsap.set(curseur, { xPercent: -50, yPercent: -50, left: "62%", top: "78%", opacity: 0 });
      gsap.set(onde, { scale: 0, opacity: 0 });

      const tl = gsap.timeline({ repeat: -1 });
      visiteTl.current = tl;
      tl.to(curseur, { opacity: 1, duration: 0.4 });

      MODULES.forEach((_, i) => {
        const cible = scene.current?.querySelector(`[data-rail="${i}"]`) as HTMLElement | null;
        const zone = scene.current as HTMLElement | null;
        if (!cible || !zone) return;

        tl.add(() => {
          // Coordonnées relatives à la scène, recalculées au vol : la fenêtre
          // peut avoir changé de taille depuis le montage.
          const r = cible.getBoundingClientRect();
          const rz = zone.getBoundingClientRect();
          gsap.to(curseur, {
            left: r.left - rz.left + r.width / 2,
            top: r.top - rz.top + r.height / 2,
            duration: 0.85,
            ease: "power3.inOut",
          });
        });
        tl.to({}, { duration: 0.85 });

        // Halo de visée : l'icône « s'allume » juste avant que le clic tombe.
        tl.add(() => {
          gsap.fromTo(
            cible.querySelector(".erp-vise"),
            { scale: 0.6, opacity: 0 },
            { scale: 1.4, opacity: 0, duration: 0.55, ease: "power2.out" }
          );
        });

        // Le clic : le curseur s'écrase, une onde part du point de contact.
        tl.to(curseur, { scale: 0.78, duration: 0.09, ease: "power2.in" })
          .add(() => {
            const r = cible.getBoundingClientRect();
            const rz = zone.getBoundingClientRect();
            gsap.set(onde, {
              left: r.left - rz.left + r.width / 2,
              top: r.top - rz.top + r.height / 2,
              scale: 0,
              opacity: 0.55,
            });
            gsap.to(onde, { scale: 3.2, opacity: 0, duration: 0.62, ease: "power2.out" });
            setActif(i);
          })
          .to(curseur, { scale: 1, duration: 0.22, ease: "back.out(3)" })
          .to({}, { duration: DUREE_ETAPE });
      });

      // Le curseur se retire avant de recommencer.
      tl.to(curseur, { left: "62%", top: "78%", opacity: 0, duration: 0.7, ease: "power2.inOut" });
    },
    { scope: scene, dependencies: [visite, reduit] }
  );

  // La visite ne tourne que lorsque la section est à l'écran.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || reduit) return;
    // Ne suspendre QUE la visite : passer par la timeline globale aurait figé
    // toutes les animations du site dès qu'on quitte cette section.
    const obs = new IntersectionObserver(
      ([e]) => {
        const tl = visiteTl.current;
        if (!tl) return;
        if (e.isIntersecting) tl.resume();
        else tl.pause();
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduit]);

  return (
    <section
      id="megaerp"
      ref={sectionRef}
      className="relative py-24 md:py-32 overflow-hidden bg-ms-paper/60 scroll-mt-24"
    >
      {/* Couture avec Solutions au-dessus : bas du « 3 ». */}
      <BoundaryWatermark boundary={BOUNDARIES.solutions_megaerp} edge="top" />
      {/* Couture vers Pourquoi nous en dessous : haut du « ERP ». */}
      <BoundaryWatermark boundary={BOUNDARIES.megaerp_pourquoi} edge="bottom" />

      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          {
            text: "MEGA ERP",
            position: "top-8 md:top-12 left-3 md:left-[-1%]",
            size: "text-[13vw] md:text-[8vw]",
            variant: "outline",
            parallax: 45,
            opacity: 0.05,
          },
        ]}
      />
      <div className="absolute top-1/4 -right-32 w-[270px] h-[270px] md:w-[520px] md:h-[520px] rounded-full bg-ms-blue/[0.10] blur-[55px] md:blur-[110px] pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
            {MEGA_ERP.badge}
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight mb-4">
            {MEGA_ERP.titre}
          </h2>
          <p className="text-sm text-ms-ink/60 leading-relaxed">
            {MEGA_ERP.accroche}
          </p>
        </motion.div>

        {/* ---------- La fenêtre ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-5xl mx-auto"
        >
          <motion.div
            ref={scene}
            style={{ rotateX: inclinaison, scale: echelle, transformPerspective: 1400 }}
            className="relative rounded-t-2xl rounded-b-xl overflow-hidden bg-white shadow-[0_40px_100px_rgba(15,23,42,0.22)] border border-black/10"
          >
            {/* Barre du navigateur — générique, sans marque */}
            <div className="bg-slate-200/80 border-b border-black/5 px-3 pt-2.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex gap-1.5">
                  {["bg-red-400", "bg-amber-400", "bg-green-400"].map((c) => (
                    <span key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                  ))}
                </span>
                <div className="flex items-end gap-1 ml-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg bg-white max-w-[210px]">
                    <span className="w-3 h-3 rounded-sm bg-ms-blue shrink-0" />
                    <span className="text-[10px] font-semibold text-ms-ink/70 truncate">
                      MEGA ERP — {module.nom}
                    </span>
                  </div>
                  {["Tableau de bord", "Documentation"].map((t) => (
                    <div
                      key={t}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg bg-slate-300/50 max-w-[150px]"
                    >
                      <span className="w-3 h-3 rounded-sm bg-slate-400/70 shrink-0" />
                      <span className="text-[10px] text-ms-ink/35 truncate">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pb-2.5">
                <span className="flex gap-1 text-slate-400 text-[11px]">‹ ›</span>
                <div className="flex-1 flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-white/90">
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-ms-green" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span className="text-[10px] text-ms-ink/45 font-mono truncate">
                    erp.megasoft-office.com/{module.cle}
                  </span>
                </div>
              </div>
            </div>

            {/* ---------- L'application ---------- */}
            <div className="flex bg-ms-paper/50 min-h-[300px] md:min-h-[360px]">
              {/* Barre latérale */}
              <nav className="w-14 md:w-[70px] shrink-0 bg-ms-dark flex flex-col items-center py-3 gap-1">
                <span className="mb-3 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <MegasoftMark className="w-4 h-auto text-white" />
                </span>
                {MODULES.map((m, i) => (
                  <button
                    key={m.cle}
                    data-rail={i}
                    onClick={() => choisir(i)}
                    title={m.nom}
                    aria-label={m.nom}
                    aria-current={actif === i}
                    className={`relative w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center p-2 md:p-2.5 transition-colors ${
                      actif === i ? "bg-ms-blue text-white" : "text-white/40 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="erp-vise absolute inset-0 rounded-lg bg-white pointer-events-none opacity-0" />
                    <m.Icone />
                    {actif === i && (
                      <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-ms-blue" />
                    )}
                  </button>
                ))}
              </nav>

              {/* Contenu */}
              <div className="flex-1 min-w-0 flex flex-col">
                {/* En-tête de l'application : le logotype MEGA ERP en haut à gauche */}
                <header className="h-11 shrink-0 bg-white border-b border-black/5 flex items-center justify-between px-3.5">
                  <span
                    className="flex items-baseline gap-[0.3em] leading-none text-[15px]"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    <MegasoftMark className="h-[0.72em] w-auto text-ms-blue self-center" />
                    <span className="font-extrabold tracking-[-0.02em] text-ms-ink">MEGA</span>
                    <span className="font-medium text-ms-blue">ERP</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden sm:flex items-center gap-1.5 text-[9.5px] font-semibold text-ms-ink/35">
                      <span className="erp-direct w-1.5 h-1.5 rounded-full bg-ms-green" />
                      En direct · Exercice 2026
                    </span>
                    <span className="w-6 h-6 rounded-full bg-ms-blue/10 border border-ms-blue/20" />
                  </span>
                </header>

                {/* L'écran du module — remonté à chaque changement */}
                <div key={module.cle} className="erp-ecran relative flex-1 p-3.5 md:p-5 overflow-hidden">
                  {/* Balayage : la lumière traverse le panneau au changement */}
                  {!reduit && (
                    <span
                      className="erp-balayage absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none z-10"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, hsl(var(--ms-blue)/0.14), transparent)",
                      }}
                      aria-hidden="true"
                    />
                  )}

                  <module.Ecran />

                  {/* Notification : l'application réagit */}
                  {!reduit && (
                    <span
                      className="erp-notif absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-ms-dark text-white text-[9px] md:text-[10px] font-semibold shadow-lg pointer-events-none"
                      aria-hidden="true"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-ms-green" />
                      {NOTIFS[module.cle]}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Curseur et onde de clic — purement décoratifs */}
            {!reduit && visite && (
              <>
                <span
                  className="erp-onde absolute w-10 h-10 rounded-full border-2 border-ms-blue pointer-events-none z-20"
                  style={{ marginLeft: -20, marginTop: -20 }}
                  aria-hidden="true"
                />
                <span className="erp-curseur absolute z-30 pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="#0F172A" strokeWidth="1.4" strokeLinejoin="round">
                    <path d="M5 2.5l13.5 8.2-6 1.1 3.3 6.6-2.6 1.3-3.3-6.6L5 17.6z" />
                  </svg>
                </span>
              </>
            )}
          </motion.div>

          {/* Argument du module affiché, sous la fenêtre */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
            <span className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ms-blue/10 text-ms-blue text-[11px] font-bold uppercase tracking-wider">
              <span className="w-3.5 h-3.5">
                <module.Icone />
              </span>
              {module.nom}
            </span>
            <p key={module.cle} className="text-sm text-ms-ink/65 leading-relaxed animate-[erp-entree_400ms_ease-out]">
              {module.argument}
            </p>
          </div>

          {/* Progression de la visite */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {MODULES.map((m, i) => (
              <button
                key={m.cle}
                onClick={() => choisir(i)}
                aria-label={m.nom}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  actif === i ? "w-7 bg-ms-blue" : "w-1.5 bg-ms-ink/15 hover:bg-ms-ink/30"
                }`}
              />
            ))}
            {!visite && (
              <button
                onClick={() => setVisite(true)}
                className="ml-3 text-[10px] font-bold uppercase tracking-wider text-ms-ink/40 hover:text-ms-blue transition-colors"
              >
                {MEGA_ERP.bouton_visite}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MegaErp;
