import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import {
  Warehouse,
  Wrench,
  Cloud,
  Server,
  Factory,
  Truck,
  Monitor,
  ShoppingCart,
  Banknote,
  Users,
  Puzzle,
  Lightbulb,
  Boxes,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import MegasoftLogo, { MegasoftPoleBadge, Pole } from "@/components/brand/MegasoftLogo";
import ListeCoulissante, { type EntreeListe, type IconeListe } from "@/components/ListeCoulissante";
import LogoMyExobrain from "@/components/brand/LogoMyExobrain";
import { products } from "@/data/products";
import { SOLUTIONS } from "@/contenu";
import { icone } from "@/contenu/icones";
import { useIntroDone } from "@/lib/introState";

// NOTE : MEGA MES / TMS / APS avaient chacun une vignette SVG dédiée (tuile
// sombre à coins arrondis, façon icône d'application). Trois pavés sombres au
// milieu d'une page claire, alignés à côté d'icônes en trait fin : le contraste
// de style sautait aux yeux et écrasait le reste de la liste. Tous les produits
// partagent désormais le même traitement — icône en trait, pastille claire,
// teintée par la couleur du pôle actif. Les fichiers SVG restent dans
// src/assets/products/ si la piste des vignettes est reprise un jour.

/**
 * L'HABILLAGE des pôles. Le CONTENU est dans `content/accueil/solutions.json`.
 *
 * Ce qui reste ici ne se traduit pas en champ de formulaire : des classes
 * Tailwind et une couleur de halo. Tailwind lit les fichiers source tels
 * quels et ne verrait pas une classe assemblée à l'exécution -- écrire
 * `bg-ms-${couleur}` produirait un bouton sans fond.
 *
 * L'appariement se fait sur l'identifiant du pôle, qui est aussi son ancre
 * (`/#solutions-digital`). Le schéma le contraint et le panel ne devra pas
 * proposer de le modifier : le renommer casserait des liens déjà partagés.
 */
const HABILLAGE = {
  office: {
    accent: "text-ms-blue",
    ring: "border-ms-blue",
    solidBg: "bg-ms-blue hover:bg-ms-blue/90",
    // Couleur concrète (et non hsl(var(--…))) : framer-motion doit pouvoir
    // parser les canaux pour interpoler le glow. Une var() imbriquée casse
    // l'interpolation et fait « disparaître » le halo.
    glow: "hsl(217, 91%, 60%)",
  },
  digital: {
    accent: "text-ms-pink",
    ring: "border-ms-pink",
    solidBg: "bg-ms-pink hover:bg-ms-pink/90",
    glow: "hsl(330, 81%, 60%)",
  },
  service: {
    accent: "text-ms-green",
    ring: "border-ms-green",
    solidBg: "bg-ms-green hover:bg-ms-green/90",
    glow: "hsl(142, 71%, 45%)",
  },
} as const;

type CleHabillage = keyof typeof HABILLAGE;

/** Un pôle complet : son contenu, réuni à son habillage. */
const tabs = SOLUTIONS.poles.map((pole) => ({
  id: pole.id,
  label: pole.libelle,
  heading: pole.titre,
  cta: pole.bouton,
  items: pole.entrees,
  ...(HABILLAGE[pole.id as CleHabillage] ?? HABILLAGE.office),
}));

/** Nombre d'entrées par page coulissante — le compte des six domaines d'Office. */
const PAR_PAGE = 6;

/** Découpe une liste en pages de `PAR_PAGE` entrées. */
function enPages(entrees: EntreeListe[]): EntreeListe[][] {
  const pages: EntreeListe[][] = [];
  for (let i = 0; i < entrees.length; i += PAR_PAGE) pages.push(entrees.slice(i, i + PAR_PAGE));
  return pages;
}

/**
 * Les pages d'un pôle.
 *
 * Première page : les domaines du pôle, à l'endroit exact où ils étaient.
 * Pages suivantes, pour Office seulement : les logiciels métiers desktop, dans
 * la MÊME présentation — ils ne sont pas une annexe du catalogue, ils sont la
 * déclinaison concrète des domaines qui précèdent.
 */
function pagesDuPole(tab: (typeof tabs)[number]): EntreeListe[][] {
  const domaines: EntreeListe[] = tab.items.map((item) => ({
    titre: item.titre,
    texte: item.texte,
    // L'icône est un CHAMP du contenu, plus une déduction faite sur le titre :
    // renommer « GPAO » ne doit pas la faire disparaître en silence.
    icone: icone(item.icone),
  }));

  /*
   * TOUS les pôles se paginent, pas seulement Office.
   *
   * La version précédente renvoyait `[domaines]` d'un bloc pour Digital et
   * Services : ajouter une septième entrée à l'un d'eux depuis le panel aurait
   * produit une page trop chargée, sans que les flèches de défilement
   * apparaissent — elles ne se montrent qu'à partir de deux pages.
   *
   * Tant que le contenu tenait dans le code, personne n'ajoutait d'entrée sans
   * s'en rendre compte. Ce n'est plus le cas.
   */
  const pagesDeDomaines = enPages(domaines);

  if (tab.id !== "office") return pagesDeDomaines;

  const logiciels: EntreeListe[] = products.map((produit) => ({
    titre: produit.name,
    texte: produit.text,
    icone: produit.icon,
  }));

  return [...pagesDeDomaines, ...enPages(logiciels)];
}

/** Décalage identique à celui du menu, pour que la barre ne coiffe pas le titre. */
const MARGE_ENTETE = 100;

/**
 * Le pôle demandé par l'ancre, s'il y en a un.
 *
 * Forme attendue : `#solutions-digital`. Elle est produite par les liens du
 * pied de page, et par eux seuls pour l'instant.
 */
function poleDeLAncre(): string | null {
  if (typeof window === "undefined") return null;
  const m = decodeURIComponent(window.location.hash.slice(1)).match(/^solutions-(.+)$/);
  if (!m) return null;
  return tabs.some((t) => t.id === m[1]) ? m[1] : null;
}

const Solutions = () => {
  const [activeId, setActiveId] = useState(() => poleDeLAncre() ?? "office");

  const active = tabs.find((t) => t.id === activeId)!;

  const sectionRef = useRef<HTMLElement>(null);

  /*
   * ARRIVÉE PAR UNE ANCRE DE PÔLE — « /#solutions-digital ».
   *
   * Deux chemins mènent ici, et il faut les traiter tous les deux :
   *
   *  · le visiteur est déjà sur l'accueil et clique un pôle dans le pied de
   *    page — le navigateur ne recharge rien, il émet `hashchange` ;
   *  · il vient d'une autre page (la FAQ, un article) — la page se charge avec
   *    l'ancre déjà en place, et `hashchange` ne se déclenche jamais.
   *
   * L'onglet est donc choisi dès l'état initial, et l'amenée à l'écran attend
   * la fin du rideau d'introduction : défiler derrière lui ne servirait à rien.
   */
  const introFinie = useIntroDone();

  /* L’onglet courant, lisible depuis un écouteur : la fermeture de
     `surAncre` est posée une fois pour toutes et ne verrait sinon que la
     valeur du premier rendu. */
  const ongletRef = useRef(activeId);
  ongletRef.current = activeId;

  /**
   * Amène la section à l'écran.
   *
   * ⚠️ LA CIBLE BOUGE PENDANT LE TRAJET, ET C'EST POURQUOI ON VISE DEUX FOIS.
   * Les sections de l'accueil sont chargées à la demande (voir pages/Index.tsx)
   * et arrivent les unes après les autres : la hauteur de la page change sous
   * les pieds du défilement, et un long trajet finissait à côté — mesuré, la
   * section restait 1 741 px plus bas. On revise donc la visée une fois les
   * arrivées calmées, et seulement si l'écart le justifie.
   *
   * @param doux vrai pour un clic en cours de visite (le mouvement se voit),
   *             faux à l'ouverture de la page (il n'y a rien à animer, et un
   *             défilement animé au chargement se fait interrompre).
   */
  /**
   * Amène la section à l'écran — EXACTEMENT comme le fait le menu.
   *
   * C'est volontairement le même geste que `handleNav` dans Header.tsx : on
   * mesure la position de la section, on retranche la hauteur de la barre, on
   * défile en douceur. Une seule fois, sans rattrapage.
   *
   * ⚠️ NE PAS Y AJOUTER DE MALICE. Une version précédente vérifiait la cible à
   * intervalles courts et se recalait tant qu'elle bougeait, pour couvrir le cas
   * où les sections voisines arrivent encore. Le résultat se voyait : la page
   * se réajustait toute seule après coup, ce que personne n'attend d'un clic
   * dans un pied de page. Un défilement doit se comporter comme tous les autres
   * défilements du site, même si cela veut dire rater de quelques pixels dans la
   * première seconde qui suit un chargement.
   */
  const amenerALEcran = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.pageYOffset - MARGE_ENTETE,
      behavior: "smooth",
    });
  }, []);

  /*
   * Arrivée sur la page avec l'ancre déjà en place — le visiteur vient de la
   * FAQ, d'un article ou d'un lien externe. On attend la levée du rideau
   * d'introduction : défiler derrière lui ne servirait à rien.
   *
   * Une frame d'attente ensuite, comme le fait pages/Index.tsx pour les ancres
   * ordinaires : le panneau vient d'être monté, sa position n'est mesurable
   * qu'après la mise en page.
   */
  useEffect(() => {
    if (!introFinie || !poleDeLAncre()) return;
    /*
     * Un délai avant de défiler, et c'est encore ce que fait le menu : quand on
     * arrive d'une autre page, `handleNav` (Header.tsx) attend 300 ms après la
     * navigation avant de viser. Même raison ici — les sections de l'accueil
     * sont chargées à la demande et arrivent les unes après les autres ; viser
     * à la première frame, c'est viser une page qui n'a pas encore sa hauteur.
     */
    const t = window.setTimeout(amenerALEcran, 400);
    return () => window.clearTimeout(t);
  }, [introFinie, amenerALEcran]);

  /* Clic dans le pied de page alors qu'on est déjà sur la page : le navigateur
     ne recharge rien, il émet seulement `hashchange`. */
  useEffect(() => {
    const surAncre = () => {
      const pole = poleDeLAncre();
      if (!pole) return;
      const changeDOnglet = pole !== ongletRef.current;
      setActiveId(pole);

      /*
       * ⚠️ ATTENDRE LA FIN DU CHANGEMENT D'ONGLET AVANT DE VISER.
       *
       * Quand le pôle demandé n'est pas celui affiché, le panneau anime sa
       * hauteur sur 0,45 s (voir la `motion.div` plus bas) et rafraîchit
       * ScrollTrigger en fin de course. Viser avant, c'est viser une page dont
       * la hauteur va changer sous le défilement : mesuré, le trajet était
       * simplement emporté et la section restait à 2 581 px de l'écran, alors
       * que le même clic depuis le menu — qui ne change pas d'onglet —
       * fonctionnait.
       *
       * Sans changement d'onglet, rien à attendre : on vise tout de suite,
       * exactement comme le menu.
       */
      window.setTimeout(amenerALEcran, changeDOnglet ? 520 : 0);
    };
    window.addEventListener("hashchange", surAncre);
    return () => window.removeEventListener("hashchange", surAncre);
  }, [amenerALEcran]);

  // Les panneaux restent tous montés (empilés) ; le conteneur anime sa hauteur
  // vers celle du panneau actif pour que le switch soit fluide, sans saut ni vide.
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = panelRefs.current[activeId];
    if (!el) return;
    const update = () => setPanelHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId]);

  return (
    <section id="solutions" ref={sectionRef} className="py-24 md:py-32 relative scroll-mt-24 overflow-hidden">
      {/* Section accent watermark */}
      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          { text: "SOLUTIONS", position: "bottom-8 md:bottom-16 right-3 md:right-[-1%]", size: "text-[12vw] md:text-[8vw]", variant: "outline", parallax: 50, opacity: 0.05 },
        ]}
      />
      {/* Seam with the section above (Qui sommes-nous): bottom half of "1990" */}
      <BoundaryWatermark boundary={BOUNDARIES.quisommes_solutions} edge="top" />
      {/* Couture vers MEGA ERP en dessous : haut du « 3 ». */}
      <BoundaryWatermark boundary={BOUNDARIES.solutions_megaerp} edge="bottom" />

      {/* Faint dot-grid backdrop, present under every pole */}
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,black,transparent)]"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--ms-ink)/0.15) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Large color-shifting glow tied to the active pole — the "background" element.
          La couleur est appliquée en style inline + transition CSS (et non via
          l'animation de framer-motion) : framer interpolait mal certaines
          couleurs — notamment le vert — qui finissaient invisibles. */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full pointer-events-none blur-[50px] md:blur-[100px]"
        style={{
          backgroundColor: active.glow,
          opacity: 0.14,
          transition: "background-color 0.6s ease-in-out",
        }}
      />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
            Nos pôles
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight">
            Un métier par pôle, une seule équipe
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-white rounded-[2rem] md:rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.08)] border border-black/5 p-5 sm:p-8 md:p-16 max-w-7xl mx-auto overflow-hidden"
        >
          {/* Soft corner wash echoing the active accent, inside the card.
              Même principe : couleur en style inline + transition CSS. */}
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none blur-3xl"
            style={{
              backgroundColor: active.glow,
              opacity: 0.1,
              transition: "background-color 0.6s ease-in-out",
            }}
          />

          {/* Tab selector — always three-across, so the poles read as one row */}
          <div className="relative grid grid-cols-3 gap-2.5 md:gap-6 mb-9 md:mb-14">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`flex items-center justify-center px-2 sm:px-4 md:px-8 py-5 md:py-8 rounded-2xl border-2 transition-all ${
                  activeId === tab.id
                    ? `${tab.ring} bg-ms-paper`
                    : "border-transparent bg-ms-paper opacity-40 hover:opacity-70"
                }`}
              >
                {/* Trois logotypes complets sur une rangée de téléphone
                    tombaient à 11 px — « MEGASOFT » y devenait illisible et le
                    nom du pôle, seul élément qui distingue les trois boutons,
                    avec lui. En dessous de md, chaque bouton porte donc le
                    monogramme du pôle et son nom dessous. */}
                <span className="md:hidden">
                  <MegasoftPoleBadge pole={tab.id as Pole} className="text-[10px] sm:text-xs" />
                </span>
                <span className="hidden md:block">
                  <MegasoftLogo pole={tab.id as Pole} className="text-xl lg:text-2xl" />
                </span>
              </button>
            ))}
          </div>

          {/* Tous les panneaux restent montés : l'actif est dans le flux (il définit
              donc la hauteur de la carte), les inactifs sont en `absolute` (retirés
              du flux) pour ne pas gonfler la hauteur. Le conteneur anime sa hauteur
              vers celle du panneau actif : switch fluide, sans saut ni espace vide. */}
          <motion.div
            className="relative overflow-hidden"
            initial={false}
            animate={panelHeight !== null ? { height: panelHeight } : undefined}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            // La hauteur de la page change quand on change de pôle : les sections
            // en dessous se décalent, il faut que ScrollTrigger recalcule ses
            // positions (sinon le stack de "Pourquoi nous" se désynchronise).
            onAnimationComplete={() => ScrollTrigger.refresh()}
          >
            {tabs.map((tab) => {
              const isActive = activeId === tab.id;
              return (
                <motion.div
                  key={tab.id}
                  ref={(el) => (panelRefs.current[tab.id] = el)}
                  initial={false}
                  animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  aria-hidden={!isActive}
                  className={isActive ? "relative" : "absolute inset-x-0 top-0 pointer-events-none select-none"}
                >
                  <div className="grid md:grid-cols-2 gap-9 md:gap-14 items-start">
                    <div>
                      <MegasoftLogo pole={tab.id as Pole} className="text-xl md:text-2xl mb-7" />
                      <h3 className="text-xl md:text-3xl font-extrabold text-ms-ink tracking-tight mb-4 leading-tight">
                        {tab.heading}
                      </h3>

                      {/*
                       * La mention desktop est ici, sous le titre, et nulle part
                       * ailleurs : elle vaut pour toute la gamme métier qui
                       * coulisse en face, et la répéter sur chaque ligne
                       * n'apprendrait rien de plus. Le site ne la portait nulle
                       * part, alors que c'est ce que la plupart des clients
                       * installent aujourd'hui.
                       */}
                      {tab.id === "office" && (
                        <p className="text-[13px] text-ms-ink/60 leading-relaxed mb-7 max-w-sm">
                          Tous nos logiciels métiers sont disponibles en{" "}
                          <strong className="font-bold text-ms-ink">version desktop</strong>,
                          installée sur poste ou en réseau local — toujours commercialisée,
                          toujours maintenue et mise à jour.
                        </p>
                      )}

                      {tab.id !== "office" && <div className="mb-7" />}
                      <a
                        href="#contact"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`inline-flex items-center px-7 py-3.5 rounded-full text-white font-bold text-sm transition-colors ${tab.solidBg}`}
                      >
                        {tab.cta}
                      </a>
                    </div>

                    <ListeCoulissante pages={pagesDuPole(tab)} accent={tab.accent} />
                  </div>


                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Solutions;
