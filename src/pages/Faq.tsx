import { ArrowRight } from "lucide-react";
import Faq from "@/components/Faq";
import { seoByPath, useSeo } from "@/lib/seo";

/**
 * La page « Questions fréquentes ».
 *
 * POURQUOI UNE PAGE, ET NON UNE SECTION DE L'ACCUEIL
 * ---------------------------------------------------
 * La FAQ occupait 1 451 px de la page d'accueil, soit 12,5 % de sa hauteur —
 * la deuxième section la plus haute. Surtout : un moteur de recherche ne classe
 * pas une section, il classe une URL. Noyées dans une page qui vise « éditeur
 * de logiciels de gestion », les réponses ne pouvaient pas se positionner sur
 * les requêtes qu'elles traitent réellement (« logiciel de paie conforme SCF »,
 * « qu'est-ce qu'un MES »). Une page dédiée le peut.
 *
 * ⚠️ Ce qu'il ne fallait PAS faire, et pourquoi c'est écrit ici : masquer la
 * FAQ aux visiteurs en la laissant lisible par les robots. C'est du cloaking,
 * sanctionné par une action manuelle — et Google exige explicitement que les
 * questions-réponses d'un balisage `FAQPage` soient VISIBLES sur la page qui le
 * porte. Le contenu n'est donc pas caché : il a déménagé.
 */
const PageFaq = () => {
  useSeo(seoByPath["/faq"]);

  return (
    <div className="relative min-h-screen bg-background">
      <main>
        <Faq />

        {/* Une sortie vers le contact : c'est la question qui n'est pas dans la
            liste qui amène un appel. */}
        <section className="pb-24 md:pb-32">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto rounded-[2rem] bg-ms-ink p-8 md:p-12 text-center">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mb-3">
                Votre question n'y est pas ?
              </h2>
              <p className="text-white/60 mb-8 max-w-lg mx-auto leading-relaxed">
                Décrivez-nous votre besoin : nos équipes répondent avec le détail de votre secteur
                et de votre organisation, pas avec une brochure.
              </p>
              <a
                href="/#contact"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ms-blue hover:bg-ms-blue/90 text-white font-bold text-sm uppercase tracking-wide transition-colors"
              >
                Poser votre question
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PageFaq;
