import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

// --- IMPORT YOUR LOGO HERE ---
import logoCap from "@/assets/logo.png"; 

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Detect scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // --- LISTE MISE À JOUR ---
  const navLinks = [
    { href: "/#hero", label: "Accueil", type: "anchor" },
    { href: "/#projects", label: "Projets", type: "anchor" },
    { href: "/#sections", label: "Sections", type: "anchor" },
    { href: "/#values", label: "Valeurs", type: "anchor" },
    { href: "#footer", label: "Contact", type: "footer-link" },
    // Nouveaux éléments avec indicateur
    { href: "/souvenirs", label: "Souvenirs", type: "page", isNew: true },
    { href: "/polymag", label: "PolyMag", type: "page", isNew: true },
  ];

  // --- LOGIQUE DE NAVIGATION ---
  const handleNav = (e: React.MouseEvent, link: { href: string; type: string }) => {
    e.preventDefault();
    setIsMenuOpen(false);

    if (link.type === "footer-link") {
        const footerElement = document.getElementById("footer");
        if (footerElement) {
            footerElement.scrollIntoView({ behavior: "smooth" });
        }
        return;
    }

    if (link.type === "page") {
      navigate(link.href);
      window.scrollTo(0, 0);
    } 
    else if (link.type === "anchor") {
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
          const element = document.querySelector(link.href.replace("/", ""));
          element?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        const element = document.querySelector(link.href.replace("/", ""));
        element?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // Animation variants
  const menuVariants = {
    closed: { opacity: 0, x: "100%" },
    open: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 80, damping: 15 } }
  };

  const linkVariants = {
    closed: { opacity: 0, x: 50 },
    open: (i: number) => ({ 
      opacity: 1, 
      x: 0, 
      transition: { delay: i * 0.1, duration: 0.4 } 
    })
  };

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ 
            y: 0,
            paddingTop: isScrolled ? "12px" : "24px",
            paddingBottom: isScrolled ? "12px" : "24px",
            backgroundColor: isScrolled ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0)", 
            backdropFilter: isScrolled ? "blur(20px)" : "blur(0px)",
            borderBottom: isScrolled ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0)",
            boxShadow: isScrolled ? "0 8px 32px 0 rgba(0, 0, 0, 0.2)" : "none"
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="fixed top-0 w-full z-50"
      >
        <div className="container mx-auto flex justify-between items-center px-4 md:px-8">
          
          {/* --- LOGO --- */}
          <a 
            href="/" 
            onClick={(e) => { e.preventDefault(); navigate("/"); window.scrollTo(0,0); }}
            className="z-50 relative group"
          >
            <div className="relative">
                <div className="absolute -inset-2 bg-cap-cyan/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                    src={logoCap} 
                    alt="CAP Club Logo" 
                    className="h-10 md:h-12 w-auto object-contain relative z-10 brightness-110 group-hover:brightness-125 transition-all duration-300 transform group-hover:scale-105 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                />
            </div>
          </a>

          {/* --- DESKTOP NAVIGATION --- */}
          <nav className="hidden lg:flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5 backdrop-blur-sm">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNav(e, link as any)}
                className={`relative px-5 py-2 text-sm font-bold transition-colors uppercase tracking-wider group overflow-visible rounded-full ${
                    location.pathname === link.href ? "text-cap-cyan" : "text-gray-300 hover:text-white"
                }`}
              >
                <span className="relative z-10 flex items-center gap-1">
                    {link.label}
                    
                    {/* --- BADGE "NEW" DESKTOP CORRIGÉ --- */}
                    {/* J'ai changé -right-2 en -right-5 et -top-2 en -top-3 pour écarter le badge */}
                    {(link as any).isNew && (
                        <span className="absolute -top-3 -right-5 flex h-4 w-auto pointer-events-none">
                           <span className="relative inline-flex rounded-full h-4 px-1.5 bg-gradient-to-r from-cap-blue to-cap-cyan text-[9px] text-white items-center justify-center leading-none shadow-[0_0_10px_rgba(6,182,212,0.6)]">
                              NEW
                           </span>
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cap-cyan opacity-40"></span>
                        </span>
                    )}
                </span>
                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
              </a>
            ))}
          </nav>

          {/* --- DESKTOP CTA --- */}
          <div className="hidden md:flex items-center">
             <a
                href="#footer"
                onClick={(e) => handleNav(e as any, { href: "#footer", type: "footer-link", label: "Contact" })}
                className="group relative inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cap-blue to-cap-cyan rounded-full text-white text-sm font-bold uppercase tracking-wide overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105"
            >
                <span className="relative z-10 flex items-center gap-2">
                    Rejoindre <Sparkles className="w-4 h-4" />
                </span>
                <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 group-hover:animate-shine" />
            </a>
          </div>

          {/* --- MOBILE TOGGLE --- */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden z-50 p-2 text-white hover:text-cap-cyan transition-colors"
          >
            {isMenuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
          </button>
        </div>
      </motion.header>

      {/* --- MOBILE FULLSCREEN MENU --- */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="lg:hidden fixed inset-0 w-full h-screen bg-[#050505] z-40 flex flex-col justify-center items-center overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cap-blue/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cap-cyan/10 rounded-full blur-[80px]" />
                <div 
                  className="absolute inset-0" 
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)',
                    backgroundSize: '30px 30px' 
                  }}
                />
            </div>
            
            <h1 className="absolute text-[20vw] font-black text-white/5 pointer-events-none select-none tracking-tighter">
                CAP
            </h1>

            <nav className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-6">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.label}
                  custom={index}
                  variants={linkVariants}
                  href={link.href}
                  onClick={(e) => handleNav(e as any, link as any)}
                  className="w-full text-center group relative"
                >
                  <div className="relative inline-block">
                    <span className="block text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 group-hover:to-cap-cyan transition-all duration-300">
                        {link.label}
                    </span>

                    {/* --- BADGE "NEW" MOBILE CORRIGÉ --- */}
                    {/* J'ai décalé beaucoup plus à droite (-right-11) et remonté (top-0) */}
                    {(link as any).isNew && (
                        <span className="absolute top-0 -right-11 px-2 py-0.5 rounded-full bg-gradient-to-r from-cap-blue to-cap-cyan text-[10px] font-bold text-white shadow-lg transform rotate-12 pointer-events-none">
                            NEW
                        </span>
                    )}
                  </div>
                  <span className="block h-[2px] w-0 bg-gradient-to-r from-cap-blue to-cap-cyan mx-auto mt-2 group-hover:w-16 transition-all duration-300" />
                </motion.a>
              ))}

              <motion.div 
                custom={navLinks.length} 
                variants={linkVariants}
                className="pt-8 w-full"
              >
                  <a 
                    href="#footer" 
                    onClick={(e) => handleNav(e as any, { href: "#footer", type: "footer-link", label: "Contact" })}
                    className="flex items-center justify-center gap-3 w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest hover:bg-cap-cyan hover:border-cap-cyan transition-all duration-300"
                  >
                    Rejoindre <ArrowRight className="w-5 h-5" />
                  </a>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;