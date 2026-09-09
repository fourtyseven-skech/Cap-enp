/*
 * ⚠️ CETTE LISTE DE SECTIONS DOIT SUIVRE CELLE DE `pages/Index.tsx`.
 *
 * Deux listes existent : celle-ci produit le HTML pré-généré, l'autre ce que
 * voit le visiteur une fois React démarré. Une section ajoutée d'un seul côté
 * n'apparaît que dans l'un des deux — et le défaut se voit UNIQUEMENT sur le
 * site construit, jamais en développement.
 *
 * C'est arrivé en ajoutant `SectionsLibres` : le bloc s'affichait à l'écran
 * mais était absent du HTML servi, donc invisible pour les moteurs de recherche
 * et pour un visiteur dont le JavaScript n'a pas encore chargé.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";

import Header from "./components/Header";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import QuiSommesNous from "./components/QuiSommesNous";
import Solutions from "./components/Solutions";
import MegaErp from "./components/MegaErp";
import PourquoiNous from "./components/PourquoiNous";
import Partenaires from "./components/Partenaires";
import Temoignage from "./components/Temoignage";
import References from "./components/References";
import ContactSection from "./components/ContactSection";
import SectionsLibres from "./components/SectionsLibres";
import PageFaq from "./pages/Faq";
import { questions } from "./data/faq";
import { ContexteRenduStatique } from "./lib/renduStatique";
import { SITE_URL } from "./lib/seo";
import { SECTIONS_LIBRES } from "./contenu";

/**
 * Pré-génération de la page d'accueil — le pendant, pour l'accueil, de ce que
 * `entry-blog.tsx` fait déjà pour les articles.
 *
 * LE PROBLÈME QU'IL RÉSOUT. L'accueil est une application React : le fichier
 * livré ne contenait qu'un `<div id="root">` vide. Mesuré avant ce module, le
 * texte lisible sans exécuter JavaScript tenait en 272 caractères — et c'était
 * des fragments de commentaires HTML. Googlebot s'en sort (il exécute le JS,
 * avec retard et budget limité) ; GPTBot, ClaudeBot et PerplexityBot, non : ils
 * ne voyaient tout simplement rien de l'offre Megasoft.
 *
 * CE QUE CE MODULE PRODUIT. Le HTML complet des sections de l'accueil, écrit
 * dans le document par `scripts/build-accueil.mjs`. Ce n'est pas une reprise du
 * contenu à la main : ce sont les VRAIS composants du site qui sont rendus, donc
 * une correction de texte dans Solutions.tsx se répercute ici sans rien à
 * ressaisir — et il est impossible que les deux versions divergent.
 *
 * POURQUOI PAS D'HYDRATATION. Le HTML est placé dans `#root`, que React vide au
 * montage pour rendre l'application normalement. On ne réhydrate pas : la page
 * d'accueil a une chorégraphie d'introduction dont l'état de départ dépend de
 * `sessionStorage`, impossible à reproduire fidèlement côté serveur — toute
 * tentative d'hydratation produirait un décalage. Le visiteur ne voit jamais ce
 * HTML : le squelette d'attente (`#ms-squelette`, position fixed) le recouvre
 * jusqu'à ce que React ait peint. Les robots, eux, le lisent.
 *
 * Ce n'est pas du cloaking : le contenu servi aux robots est exactement celui
 * que le visiteur voit une fois la page montée, généré depuis la même source.
 *
 * `renderToStaticMarkup` et non `renderToString` : sans hydratation, les
 * marqueurs de React seraient du poids mort.
 */

/**
 * La coquille commune : en-tête, contenu, pied de page.
 *
 * Elle reproduit ce que `Layout` monte côté navigateur. Une seule définition,
 * sinon l'accueil et la FAQ finiraient par ne plus se ressembler — et le
 * décalage ne se verrait que dans le HTML livré, là où personne ne regarde.
 *
 * `accueil` : sur la page d'accueil le hero passe SOUS l'en-tête (pas de
 * marge haute) ; partout ailleurs le contenu démarre en dessous, comme dans
 * `Layout`.
 */
function coquille(contenu: React.ReactNode, { accueil }: { accueil: boolean }) {
  return renderToStaticMarkup(
    <ContexteRenduStatique.Provider value={true}>
      <StaticRouter location={accueil ? "/" : "/faq"}>
        <div className="flex flex-col min-h-screen bg-transparent font-sans text-foreground">
          <div id="ms-header">
            <Header />
          </div>
          <main className={`flex-grow w-full ${accueil ? "" : "pt-24"}`}>{contenu}</main>
          <div id="ms-footer">
            <Footer />
          </div>
        </div>
      </StaticRouter>
    </ContexteRenduStatique.Provider>
  );
}

/** Le HTML des sections de l'accueil, prêt à être injecté dans `#root`. */
export function renderAccueil(): string {
  return nettoyer(
    coquille(
      <div className="relative min-h-screen bg-background">
        <main>
          <Hero />
          <Stats />
          <QuiSommesNous />
          <Solutions />
          <MegaErp />
          <PourquoiNous />
          <Partenaires />
          <Temoignage />
          <References />
          <SectionsLibres />
          <ContactSection
            coutureHaut={SECTIONS_LIBRES.blocs.length ? "libres_contact" : "references_contact"}
          />
        </main>
      </div>,
      { accueil: true }
    )
  );
}

/** Le HTML de la page « Questions fréquentes ». */
export function renderPageFaq(): string {
  return nettoyer(coquille(<PageFaq />, { accueil: false }));
}

/**
 * Les sections entrent en scène avec framer-motion, qui pose son état INITIAL
 * dans l'attribut `style` du HTML rendu : `opacity:0`, un `translateY`… Côté
 * navigateur c'est le point de départ d'une animation, et personne ne le voit.
 * Dans un document statique, en revanche, c'est du texte durablement invisible
 * — exactement le motif qu'un moteur de recherche pénalise, et une raison
 * possible de ne pas indexer le contenu du tout.
 *
 * On retire donc ces deux propriétés du HTML pré-généré. Sans effet pour le
 * visiteur (React remplace ce HTML au montage), déterminant pour les robots.
 */
function nettoyer(html: string): string {
  return html.replace(/style="([^"]*)"/g, (balise, contenu: string) => {
    const garde = contenu
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .filter((d) => !/^opacity\s*:\s*0(\.0+)?$/i.test(d))
      .filter((d) => !/^transform\s*:/i.test(d));
    return garde.length ? `style="${garde.join("; ")}"` : "";
  });
}

/**
 * Données structurées de la FAQ.
 *
 * Le format `FAQPage` est celui que Google sait afficher en accordéon sous le
 * résultat, et celui qu'un moteur génératif reprend le plus volontiers : une
 * question, une réponse, sans le reste de la page à interpréter.
 */
export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.reponse },
    })),
  };
}
