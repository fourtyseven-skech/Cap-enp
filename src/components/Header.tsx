import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import IconeBlog from "@/components/brand/IconeBlog";
import { useLocation, useNavigate } from "react-router-dom";

import MegasoftLogo from "@/components/brand/MegasoftLogo";
import { ENTETE } from "@/contenu";

/**
 * Toutes les entrées du menu sont désormais des ANCRES de la page d'accueil.
 *
 * « ERP » ouvrait une page dédiée qui reprenait, en plus long, ce que la
 * section « En images » montre déjà en démonstration animée. Deux pages pour un
 * même sujet se disputent le référencement et obligent le visiteur à choisir
 * sans savoir laquelle regarder : le menu mène maintenant à la démonstration,
 * et la page séparée a été retirée.
 *
 * Le blog, lui, sort du menu — c'est une destination, pas une section — et
 * prend son propre bouton à côté de l'appel à l'action.
 */
type NavLink = { href: string; label: string; anchor: string };

/* Le menu vient de `content/accueil/entete.json`. L'adresse se DÉDUIT de
   l'ancre : les deux ne peuvent donc pas diverger, ce qui arriverait si le
   panel les proposait séparément. */
const navLinks: NavLink[] = ENTETE.liens.map((l) => ({
  href: `/#${l.ancre}`,
  label: l.libelle,
  anchor: l.ancre,
}));

/**
 * L'animation d'entrée du header n'a de sens qu'APRÈS le rideau d'introduction.
 * Rejouée à chaque montage, elle faisait glisser la barre depuis le haut au
 * retour du blog vers l'accueil — en pleine transition de page, ce qui donnait
 * exactement l'à-coup que la transition cherche à supprimer.
 */
const dejaVenu = () => {
  try {
    return sessionStorage.getItem("hasSeenIntro") === "true";
  } catch {
    return false;
  }
};

/**
 * `staticNav` : le header est monté sur une page qui ne fait PAS partie de
 * l'application (les pages du blog sont du HTML pré-généré). Deux différences,
 * invisibles à l'œil :
 *   · les liens redeviennent de vrais liens — la navigation React changerait
 *     l'URL sans jamais charger la page demandée ;
 *   · l'animation d'entrée est désactivée, sinon la barre resterait hors écran
 *     tant que le JavaScript n'est pas arrivé.
 * L'apparence au repos est rigoureusement identique à celle de l'accueil.
 */
const Header = ({ staticNav = false }: { staticNav?: boolean }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  // Lu une seule fois : la valeur ne doit pas changer en cours de session, sinon
  // l'animation d'entrée se rejouerait au premier rendu suivant.
  const [sansEntree] = useState(() => staticNav || dejaVenu());

  const navigate = useNavigate();
  const location = useLocation();

  // Over the dark hero video (home page, before scrolling) the header switches
  // to a dark-glass look; everywhere else it uses the white pill.
  const overHero = !isScrolled && location.pathname === "/";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    const handleScroll = () => setIsScrolled(window.scrollY > 20);

    handleResize();
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const handleNav = (e: React.MouseEvent, anchor: string) => {
    e.preventDefault();
    setIsMenuOpen(false);

    const scrollToElement = () => {
      const element = document.getElementById(anchor);
      if (element) {
        const headerOffset = 100;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      }
    };

    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(scrollToElement, isMobile ? 500 : 300);
    } else {
      scrollToElement();
    }
  };

  return (
    <>
      <motion.header
        initial={sansEntree ? false : { y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-3 md:top-4 left-0 right-0 z-50 px-4"
      >
        {/* Barre volontairement compacte : hauteur réduite, largeur plafonnée
            et une seule action principale. Avec deux boutons pleine taille et
            un padding généreux, elle mangeait le haut du Hero. */}
        {/* Deux états seulement, et non trois.
            Le troisième — barre presque transparente, hors accueil et avant tout
            défilement — rendait l'en-tête quasi invisible sur les pages du blog,
            dont le fond est clair : on arrivait sur un article sans voir qu'il y
            avait un menu. Partout ailleurs que sur la vidéo du Hero, la barre
            est donc pleinement lisible dès le premier écran. */}
        <div
          className={`mx-auto max-w-6xl flex justify-between items-center gap-4 rounded-full px-3 md:px-4 py-1.5 transition-all duration-500 ${
            overHero
              ? "bg-white/[0.08] backdrop-blur-xl border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
              : "bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-black/5"
          }`}
        >
          <a
            href="/"
            onClick={(e) => {
              if (staticNav) return;
              e.preventDefault();
              setIsMenuOpen(false);
              if (location.pathname === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                navigate("/");
                // après navigation, remonter en douceur en haut de la home
                setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), isMobile ? 500 : 300);
              }
            }}
            className="z-50 relative flex-shrink-0"
          >
            {/* Copie invisible en flux : définit la taille de la boîte.
                Les deux variantes visibles sont en absolute left-0 top-0 →
                superposées à l'identique, donc aucun décalage au crossfade. */}
            <span className="relative inline-block leading-none text-[16px] md:text-[18px]">
              <MegasoftLogo pole="office" className="opacity-0" />
              <MegasoftLogo
                pole="office"
                className={`absolute left-0 top-0 transition-opacity duration-500 ${overHero ? "opacity-0" : "opacity-100"}`}
              />
              <MegasoftLogo
                pole="office"
                variant="white"
                className={`absolute left-0 top-0 transition-opacity duration-500 ${overHero ? "opacity-100" : "opacity-0"}`}
              />
            </span>
          </a>

          {/* DESKTOP NAV */}
          <nav className="hidden lg:flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  if (staticNav) return;
                  handleNav(e, link.anchor);
                }}
                onMouseEnter={() => setHovered(link.label)}
                className={`relative px-3 py-1.5 text-[13px] font-semibold rounded-full transition-colors duration-300 ${
                  overHero ? "text-white/75 hover:text-white" : "text-ms-ink/70 hover:text-ms-ink"
                }`}
              >
                {hovered === link.label && (
                  <motion.span
                    layoutId="nav-hover-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className={`absolute inset-0 rounded-full ${overHero ? "bg-white/10" : "bg-black/5"}`}
                  />
                )}
                <span className="relative">{link.label}</span>
              </a>
            ))}
          </nav>

          {/* Deux destinations, hiérarchisées.
              Le blog n'est pas une section de la page d'accueil : le ranger
              parmi les ancres promettait un défilement et provoquait un
              changement de page. Il a donc son propre bouton — contour plutôt
              que fond plein, pour rester second derrière l'appel à l'action.

              C'est un VRAI lien, sans interception : les pages du blog sont du
              HTML pré-généré et ne chargent pas l'application. Y accéder par le
              routeur afficherait une page vide. */}
          <div className="hidden md:flex items-center gap-2">
            {/*
              Le bouton du blog.

              `group/blog` est nommé : la barre porte d'autres groupes, et une
              classe anonyme les ferait tous réagir au survol de celui-ci. C'est
              lui qui ouvre le livre de l'icône — voir brand/IconeBlog.

              Sur le hero (fond sombre) le survol éclaircit ; sur fond clair il
              prend la teinte de la marque plutôt qu'un gris neutre : le bouton
              appartient au site, il n'est pas un élément d'interface générique.
            */}
            <a
              href="/blog/"
              className={`group/blog inline-flex items-center gap-2 pl-3 pr-3.5 py-1.5 rounded-full border text-[13px] font-bold transition-colors duration-300 ${
                overHero
                  ? "border-white/25 text-white/85 hover:border-white/50 hover:bg-white/10 hover:text-white"
                  : "border-ms-ink/15 text-ms-ink/70 hover:border-ms-blue/40 hover:text-ms-blue hover:bg-ms-blue/[0.06]"
              }`}
            >
              <IconeBlog className="w-4 h-4" />
              {ENTETE.bouton_blog}
            </a>
            <a
              href="/#contact"
              onClick={(e) => { if (staticNav) return; handleNav(e, "contact"); }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-ms-blue text-white text-[13px] font-bold hover:bg-ms-blue/90 transition-colors"
            >
              {ENTETE.bouton_demo} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* MOBILE TOGGLE */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`lg:hidden z-50 p-1.5 transition-colors duration-300 ${overHero && !isMenuOpen ? "text-white" : "text-ms-ink"}`}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.header>

      {/* MOBILE FULLSCREEN MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-x-4 top-16 z-40 rounded-3xl bg-white shadow-2xl border border-black/5 p-5"
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    if (staticNav) return;
                    handleNav(e, link.anchor);
                  }}
                  className="px-4 py-3 text-base font-bold text-ms-ink rounded-2xl hover:bg-black/5 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/blog/"
                className="group/blog mt-2 inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl border border-ms-ink/15 text-ms-ink font-bold"
              >
                <IconeBlog className="w-[18px] h-[18px] text-ms-blue" />
                Blog
              </a>
              <a
                href="/#contact"
                onClick={(e) => { if (staticNav) return; handleNav(e, "contact"); }}
                className="mt-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-ms-blue text-white font-bold"
              >
                {ENTETE.bouton_demo} <ArrowRight className="w-4 h-4" />
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
