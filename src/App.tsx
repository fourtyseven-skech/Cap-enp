import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { markIntroDone } from "@/lib/introState";

// Components
import IntroAnimationV2 from "./components/IntroAnimationV2";
import DefilementAdouci from "./components/DefilementAdouci";
import Layout from "./components/Layout";

// La page d'accueil est importée directement : elle s'affiche juste après
// l'intro, donc son fondu doit être instantané (pas de fallback Suspense).
import Index from "./pages/Index";

// NotFound reste en lazy : rarement atteinte, inutile de l'inclure dans le
// chunk critique.
const NotFound = lazy(() => import("./pages/NotFound"));
// La FAQ a sa propre page : secondaire, elle part dans son propre chunk.
const PageFaq = lazy(() => import("./pages/Faq"));
/**
 * PANEL D'ADMINISTRATION — INCLUS OU NON DANS LE SITE CONSTRUIT
 * ------------------------------------------------------------
 * Le chargement différé évitait déjà de servir le panel au visiteur ordinaire,
 * mais ses fichiers restaient publiquement téléchargeables : n'importe qui
 * pouvait récupérer `AdminApp-*.js` et lire la logique interne.
 *
 * Le panel est donc désormais absent PAR DÉFAUT du site construit. Il faut le
 * demander explicitement :
 *
 *   npm run build          → site public seul (le cas normal)
 *   npm run build:panel    → site + panel, via le mode `panel`
 *
 * `import.meta.env` est remplacé par une constante à la compilation : quand la
 * variable vaut autre chose que "1", le ternaire ci-dessous se réduit à `null`
 * et Rollup élimine les `import()` avec — le chunk n'est pas produit du tout.
 * Ce n'est pas une simple condition d'affichage : le code n'existe plus.
 *
 * `scripts/verifier-dist.mjs` le vérifie après chaque build et interrompt la
 * publication si un fichier du panel a malgré tout été émis.
 */
/*
 * En DÉVELOPPEMENT, le panel est toujours là : sans cela, `/admin` renvoie la
 * page « introuvable » sur le serveur de développement et il devient
 * impossible de travailler dessus. La première version de cette ligne
 * l'oubliait — le site construit était correct, mais le panel avait disparu de
 * la machine du développeur.
 *
 * En PRODUCTION, `import.meta.env.DEV` vaut `false` : l'expression se réduit à
 * la seule variable, et le panel reste absent sauf demande explicite.
 */
const AVEC_PANEL = import.meta.env.DEV || import.meta.env.VITE_AVEC_PANEL === "1";

const AdminApp = AVEC_PANEL ? lazy(() => import("./admin/AdminApp")) : null;
const Barriere = AVEC_PANEL ? lazy(() => import("./admin/Barriere")) : null;

/**
 * Trois phases, et le montage de la page n'a lieu dans AUCUNE phase animée.
 *
 *  · "intro" — le rideau joue sa chorégraphie. React ne monte rien d'autre :
 *    le thread principal est entièrement à l'intro. (Monter la page ici, même
 *    tard, faisait tomber des frames pile au moment du tracé du « M ».)
 *  · "hold"  — la chorégraphie est finie, le rideau est FIGÉ sur son image
 *    finale. C'est là qu'on monte la page : le blocage du thread principal
 *    n'est plus visible, puisqu'il n'y a plus rien qui bouge à l'écran.
 *  · "done"  — la page a réellement peint : le rideau remonte. Le mouvement
 *    est alors garanti fluide, il ne reste plus rien à calculer.
 */
type Phase = "intro" | "hold" | "done";

// Garde-fou : même si la page traîne à se peindre (réseau lent, machine
// modeste), on ne fait jamais patienter l'utilisateur au-delà de ce délai.
const MAX_HOLD = 1400;

const App = () => {
  const [phase, setPhase] = useState<Phase>(() => {
    // Le rideau d'introduction est la porte d'entrée du SITE : il n'a de sens
    // qu'à l'arrivée sur l'accueil. Le panel d'administration est un outil ; et
    // une page secondaire — /faq — est presque toujours atteinte depuis un
    // moteur de recherche ou un lien, où faire patienter derrière une animation
    // de marque n'apporte rien.
    if (window.location.pathname !== "/") return "done";

    // Le visiteur arrive depuis le blog : il a déjà vu le site, le rideau
    // d'introduction n'a plus de sens. Le drapeau est posé par les pages du
    // blog (voir scripts/build-blog.mjs). Il court-circuite aussi le rejeu
    // systématique en développement, sans quoi le retour blog → accueil
    // paraîtrait cassé pendant les relectures.
    const venuDuBlog = sessionStorage.getItem("msIntroSkip") === "1";
    if (venuDuBlog) return "done";

    // En développement, l'intro se rejoue à chaque rafraîchissement pour
    // pouvoir la revoir facilement.
    if (import.meta.env.DEV) return "intro";

    return sessionStorage.getItem("hasSeenIntro") === "true" ? "done" : "intro";
  });

  const mountApp = phase !== "intro";
  const showIntro = phase !== "done";

  useEffect(() => {
    if (phase === "done") markIntroDone();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Le rideau est en position fixed : sans ce verrou, la page montée derrière
  // rend le document scrollable (molette = décor qui bouge sous le rideau).
  useEffect(() => {
    if (!showIntro) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showIntro]);

  // Le préchauffage a fait son travail : on libère l'élément. Surtout PAS au
  // montage du Hero — retirer l'élément annule sa requête, et si celle-ci était
  // encore en vol le préchargement aurait été fait pour rien. On attend donc
  // que le rideau soit levé, moment où la vidéo du Hero est déjà prête.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => document.getElementById("hero-warmup")?.remove(), 1000);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase "hold" : on attend que la page soit VRAIMENT peinte et que la vidéo
  // du Hero ait de quoi jouer, puis seulement on lève le rideau.
  useEffect(() => {
    if (phase !== "hold") return;
    let cancelled = false;
    const startedAt = performance.now();

    const lift = () => {
      if (cancelled) return;
      setPhase("done");
      sessionStorage.setItem("hasSeenIntro", "true");
      // Le rideau met encore 0,85 s à remonter : on ne libère les animations
      // d'entrée de la page qu'à la fin de ce mouvement, pour ne pas faire
      // tourner deux chorégraphies en même temps.
      setTimeout(() => {
        markIntroDone();
        // Les sections ont été mesurées pendant que le scroll était verrouillé :
        // on redonne à ScrollTrigger des repères à jour avant le premier scroll.
        // Import dynamique : GSAP est tiré par des sections sous la ligne de
        // flottaison, il n’a rien à faire dans le chunk critique. Le seul
        // besoin d’App est ce rafraîchissement, qui arrive bien après la
        // première peinture.
        void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => ScrollTrigger.refresh());
      }, 850);
    };

    const check = () => {
      if (cancelled) return;
      const video = document.querySelector<HTMLVideoElement>("#hero video");
      // HAVE_FUTURE_DATA : assez de données pour jouer sans re-buffériser.
      const ready = !video || video.readyState >= 3;
      if (ready || performance.now() - startedAt > MAX_HOLD) {
        // Double rAF : on ne lève le rideau qu'après la frame où le navigateur
        // a effectivement peint ce que React vient de committer.
        requestAnimationFrame(() => requestAnimationFrame(lift));
        return;
      }
      requestAnimationFrame(check);
    };

    // On laisse React committer l'arbre avant de commencer à sonder.
    requestAnimationFrame(() => requestAnimationFrame(check));

    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Fin de la chorégraphie de l'intro : on passe en "hold" (rideau figé), ce
  // qui déclenche le montage de la page à l'abri des regards.
  // useCallback obligatoire : l'intro arme son minuteur de fin dans un effet
  // qui dépend de cette fonction — une nouvelle identité le réarmerait.
  const handleIntroComplete = useCallback(() => setPhase("hold"), []);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />

      {mountApp && (
        <div className="w-full min-h-screen bg-transparent">
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                {/* Le panel est hors Layout : ni en-tête, ni pied de page, ni
                    animations. C'est un outil, pas une page du site.

                    Absent du site public : la route n'est même pas déclarée, et
                    /admin retombe sur la page « introuvable » comme n'importe
                    quelle adresse inconnue. */}
                {AVEC_PANEL && AdminApp && Barriere && (
                  <Route
                    path="/admin/*"
                    element={
                      <Barriere>
                        <AdminApp />
                      </Barriere>
                    }
                  />
                )}
                <Route
                  path="*"
                  element={
                    <Layout>
                      {/* Défilement adouci — sur le SITE seulement.
                          Le panel est un outil : on y attend un défilement
                          immédiat, pas une glissade. Monté ici, il ne s'applique
                          donc jamais à /admin. */}
                      <DefilementAdouci />
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/faq" element={<PageFaq />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </div>
      )}

      <AnimatePresence>
        {showIntro && <IntroAnimationV2 key="intro" onComplete={handleIntroComplete} />}
      </AnimatePresence>
    </TooltipProvider>
  );
};

export default App;
