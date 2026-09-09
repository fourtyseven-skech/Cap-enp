import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import heroPoster from "@/assets/megasoft/hero-poster.jpg";
import PoleReveal from "@/components/brand/PoleReveal";
import { useIntroDone } from "@/lib/introState";
import { HERO } from "@/contenu";

// Three looping clips, each standing in for one part of the Megasoft stack —
// they crossfade in sequence instead of a single static loop.
//
// Chaque scène existe en deux tailles. Les clips étaient livrés en 1080p à
// 4,4 Mbit/s : 8,4 Mo pour sept secondes de décor, derrière un voile sombre à
// 75 % qui en masque l'essentiel du détail. Sur une connexion mobile, c'était
// le poids de la page entière multiplié par vingt, dépensé avant même que le
// visiteur ait lu le titre. La version 854 px sert les téléphones, la 1280 px
// les ordinateurs — le tout pèse désormais 1,6 Mo sur mobile.
//
// Le choix se fait par l'attribut `media` des <source> : c'est le navigateur
// qui tranche, avant la requête, sans une ligne de JavaScript.
/** Largeur au-delà de laquelle on sert la version 1280 px. */
const SEUIL_GRAND_ECRAN = "(min-width: 768px)";

/**
 * Les sources d'une scène, dans l'ordre où le navigateur les examine.
 *
 * DEUX ORIGINES, DEUX TRAITEMENTS
 * -------------------------------
 *   · « /videos/nom » — les vidéos livrées avec le site, déclinées à la main en
 *     480p et 720p. Deux sources, la large d'abord ;
 *   · « /medias/<identifiant>.mp4 » — une vidéo ENVOYÉE depuis le panel. Faute
 *     de `ffmpeg` sur l'hébergement, il n'en existe qu'une taille : une seule
 *     source, servie telle quelle à tous les écrans.
 *
 * Le jour où le transcodage sera possible, c'est ici que la seconde source
 * s'ajoutera — et nulle part ailleurs.
 */
const sourcesDeLaScene = (base: string): { src: string; type: string; media?: string }[] => {
  if (base.startsWith("/medias/")) {
    return [{ src: base, type: base.endsWith(".webm") ? "video/webm" : "video/mp4" }];
  }
  return [
    { src: `${base}-720.mp4`, type: "video/mp4", media: SEUIL_GRAND_ECRAN },
    { src: `${base}-480.mp4`, type: "video/mp4" },
  ];
};

/* Les scènes viennent de `content/accueil/hero.json` — voir `sourcesDeLaScene`
   ci-dessus pour les deux formes que `base` peut prendre. */
const heroScenes = HERO.scenes.map((s) => ({ base: s.base, label: s.libelle }));

// Durée du fondu enchaîné entre deux scènes, en secondes.
const CROSSFADE = 1;

// Les entrées du Hero ne se jouent qu'une fois le rideau d'intro remonté : la
// page est montée derrière lui, donc sans ce garde-fou la chorégraphie se
// jouerait à huis clos et l'utilisateur découvrirait un Hero déjà figé.
const reveal = {
  hidden: { opacity: 0, y: 30 },
  shown: { opacity: 1, y: 0 },
};
const revealSmall = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0 },
};
const fade = { hidden: { opacity: 0 }, shown: { opacity: 1 } };

const Hero = () => {
  const [sceneIndex, setSceneIndex] = useState(0);
  // Les scènes 2 et 3 ne sont pas téléchargées au chargement : elles ne le sont
  // qu'une fois l'intro passée et la première scène en train de jouer.
  const [warm, setWarm] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const introDone = useIntroDone();
  const [prefersReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  /**
   * Deux cas où le décor animé ne doit pas être téléchargé du tout, et où
   * l'image d'affiche prend sa place — 110 Ko au lieu de 1,6 Mo :
   *
   *  · le visiteur a activé l'économiseur de données de son navigateur. C'est
   *    une demande explicite, adressée à tous les sites : la respecter n'est
   *    pas une optimisation mais une politesse élémentaire, et sur un forfait
   *    limité elle se compte en dinars.
   *  · le système est réglé sur « animations réduites ». Une vidéo de fond qui
   *    tourne en boucle est précisément ce que ce réglage demande d'éviter ;
   *    jusqu'ici seule la rotation entre scènes s'arrêtait, la boucle, elle,
   *    continuait de jouer.
   */
  const [sansVideo] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const co = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return co?.saveData === true;
  });
  const decorFige = sansVideo || prefersReduced;

  // La rotation ne tourne que quand elle a un sens : intro terminée, Hero à
  // l'écran, et animations non réduites.
  const rotating = introDone && onScreen && !decorFige;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Préchargement différé des scènes 2 et 3. Les charger d'emblée mettait trois
  // téléchargements de plusieurs Mo en concurrence avec le premier rendu — la
  // cause principale du à-coup au lever du rideau.
  useEffect(() => {
    if (!introDone || decorFige) return;
    const t = setTimeout(() => setWarm(true), 1200);
    return () => clearTimeout(t);
  }, [introDone, decorFige]);

  useEffect(() => {
    if (!warm) return;
    videoRefs.current.forEach((v, i) => {
      if (v && i !== 0) v.load();
    });
  }, [warm]);

  // Une seule vidéo décode à la fois : les autres restent MONTÉES (leur tampon
  // et leur texture sont conservés, donc plus aucun re-téléchargement à chaque
  // tour de boucle) mais en pause, et rembobinées pour être prêtes à repartir
  // instantanément au tour suivant.
  useEffect(() => {
    if (decorFige) return;
    const active = videoRefs.current[sceneIndex];
    // Hors écran, on ne décode rien du tout : le Hero occupe tout l'écran, une
    // vidéo qui continue de tourner pendant qu'on lit le bas de page coûte des
    // frames au scroll pour rien.
    if (onScreen) active?.play().catch(() => {});
    else active?.pause();

    const t = setTimeout(() => {
      videoRefs.current.forEach((v, i) => {
        if (!v || i === sceneIndex) return;
        v.pause();
        try {
          v.currentTime = 0;
        } catch {
          /* la vidéo n'est pas encore cherchable — sans conséquence */
        }
      });
    }, CROSSFADE * 1000 + 100);

    return () => clearTimeout(t);
  }, [sceneIndex, onScreen, decorFige]);

  // On enchaîne sur la scène suivante quand la scène courante approche de sa
  // fin, plutôt que sur un minuteur de 7 s indépendant du média : le fondu
  // tombe ainsi sur la fin du plan au lieu d'arriver au hasard en plein milieu.
  // La marge (CROSSFADE + 0,6 s) tient compte de la granularité de
  // `timeupdate` (~250 ms) et garantit que le clip sortant est mis en pause
  // AVANT de reboucler — sinon on le verrait repartir à zéro pendant le fondu.
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v.duration || Number.isNaN(v.duration)) return;
    if (v.duration - v.currentTime <= CROSSFADE + 0.6) {
      setSceneIndex((i) => (i + 1) % heroScenes.length);
    }
  }, []);

  const scrollToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} id="hero" className="hero-plein relative w-full overflow-hidden pb-28 md:pb-32 bg-ms-dark">
      {/* Video Background: three scenes crossfading in sequence.
          Les trois éléments restent montés en permanence — seule l'opacité
          change. L'ancienne version les démontait/remontait à chaque bascule,
          ce qui obligeait le navigateur à re-télécharger et re-décoder un clip
          de plusieurs Mo à chaque tour : d'où la saccade de la boucle. */}
      <div className="absolute inset-0 z-0 w-full h-full">
        {decorFige ? (
          <img
            src={heroPoster}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            /* Image du premier écran : ni différée, ni reléguée en fin de file.
               `lazy` ici retarderait précisément ce que le visiteur regarde. */
            /* React 18 ne connaît pas la forme camelCase et retire
               silencieusement l'attribut : l'image du Hero perdait donc la
               priorité haute qu'on croyait lui donner. En minuscules, React la
               laisse passer telle quelle et le navigateur l'applique. */
            fetchpriority="high"
            decoding="async"
          />
        ) : (
          heroScenes.map((scene, i) => (
            <video
              key={scene.base}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: i === sceneIndex ? 1 : 0,
                transition: `opacity ${CROSSFADE}s ease-in-out`,
                willChange: "opacity",
              }}
              poster={heroPoster}
              preload={i === 0 || warm ? "auto" : "none"}
              autoPlay={i === 0}
              onTimeUpdate={rotating && i === sceneIndex ? handleTimeUpdate : undefined}
              muted
              loop
              playsInline
              aria-hidden="true"
            >
              {/* L'ordre compte : le navigateur retient la PREMIÈRE source dont
                  la condition est vraie. La version large d'abord, la version
                  téléphone en repli sans condition. */}
              {sourcesDeLaScene(scene.base).map((s) => (
                <source key={s.src} src={s.src} type={s.type} media={s.media} />
              ))}
            </video>
          ))
        )}
      </div>

      {/* Dark scrim for legibility + a single subtle brand-blue glow (no rainbow gradient) */}
      <div className="absolute inset-0 z-10 bg-ms-dark/75" />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--ms-blue)/0.25),transparent_60%)]" />

      {/* Decorative concentric rings, myexobrain-style */}
      <div className="absolute inset-0 z-10 flex items-center justify-center opacity-20 pointer-events-none">
        {[220, 340, 460, 580].map((size) => (
          <div
            key={size}
            className="absolute rounded-full border border-white/40"
            style={{ width: size, height: size }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="hero-plein relative z-20 flex flex-col justify-center items-center text-center text-white px-5 pt-28">
        <motion.div
          variants={reveal}
          initial="hidden"
          animate={introDone ? "shown" : "hidden"}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] max-w-3xl">
            {HERO.titre}
          </h1>
        </motion.div>

        <motion.p
          variants={reveal}
          initial="hidden"
          animate={introDone ? "shown" : "hidden"}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-5 text-sm md:text-base text-white/80 max-w-lg font-medium"
        >
          {HERO.sous_titre}
        </motion.p>

        <motion.div
          variants={revealSmall}
          initial="hidden"
          animate={introDone ? "shown" : "hidden"}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-8"
        >
          <a
            href="#contact"
            onClick={scrollToContact}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-ms-blue text-white font-bold uppercase tracking-wide text-sm shadow-lg hover:bg-ms-blue/90 hover:scale-[1.03] transition-all"
          >
            {HERO.bouton}
          </a>
        </motion.div>

        {/* M vectorisé cliquable : éclate en trois M colorés (Office/Digital/Service) */}
        <motion.div
          variants={revealSmall}
          initial="hidden"
          animate={introDone ? "shown" : "hidden"}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-8"
        >
          <PoleReveal />
        </motion.div>

        {/* Scene label + progress dots — makes the video rotation legible, not just decorative */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate={introDone ? "shown" : "hidden"}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-8 flex flex-col items-center gap-2"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={heroScenes[sceneIndex].label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50"
            >
              {heroScenes[sceneIndex].label}
            </motion.span>
          </AnimatePresence>
          <div className="flex items-center gap-1.5">
            {heroScenes.map((scene, i) => (
              <button
                key={scene.base}
                onClick={() => setSceneIndex(i)}
                aria-label={scene.label}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === sceneIndex ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
