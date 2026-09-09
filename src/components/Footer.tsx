import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Mail, Phone, MapPin, Facebook } from "lucide-react";

import MegasoftLogo, { MegasoftMark, Pole } from "@/components/brand/MegasoftLogo";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import { CONTACT, PIED } from "@/contenu";

/**
 * Les trois pôles, dans l'ordre où le site les présente partout ailleurs.
 *
 * ⚠️ L'ORDRE COMPTE ET IL AVAIT CHANGÉ. Cette liste commençait par « service »,
 * alors que la section Solutions, le pied de page et les métadonnées annoncent
 * tous « Office, Digital, Services ». Un pied de page qui inverse l'ordre de la
 * marque, c'est le genre d'écart que personne ne signale mais que tout le monde
 * ressent.
 *
 * Le descripteur reprend le titre du panneau correspondant dans Solutions,
 * abrégé : il doit rester une étiquette, pas une phrase.
 */
/* Les pôles viennent de `content/accueil/pied.json`. Leur identifiant est le
   même que dans `solutions.json` : c'est lui qui fait défiler vers le bon
   onglet quand on clique ici. */
const poles: { pole: Pole; nom: string; quoi: string }[] = PIED.poles.map((p) => ({
  pole: p.id as Pole,
  nom: p.nom,
  quoi: p.descriptif,
}));

/* Écrites en toutes lettres : Tailwind lit le fichier tel quel et ne verrait
   pas une classe assemblée à l'exécution. */
const TEINTE: Record<Pole, string> = {
  office: "text-ms-blue",
  digital: "text-ms-pink",
  service: "text-ms-green",
};

const Footer = () => {
  const footerRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Légère parallaxe du watermark en fonction du défilement du footer.
  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ["start end", "end start"],
  });
  const markY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [50, -50]);

  return (
    <footer ref={footerRef} className="relative bg-ms-ink rounded-t-[3rem] pt-16 pb-10 overflow-hidden">
      {/* Watermark : le logo complet « MEGASOFT Office » (M + texte), en grand et très discret.
          Centrage (div statique) et parallaxe (motion interne) séparés — sinon le transform
          inline de framer écrase les -translate-x/y de Tailwind et décale le logo. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-[0.055]">
          <motion.div style={{ y: markY, willChange: "transform" }}>
            {/* Le logotype filigrane est une seule ligne insécable : à 8,5 vw
                il dépasse la largeur d'un téléphone et se retrouve tronqué des
                deux côtés. Il est donc calibré plus bas sur petit écran, où il
                tient entier. */}
            <MegasoftLogo pole="office" variant="white" className="text-[6.5vw] md:text-[8.5vw] leading-none" />
          </motion.div>
        </div>
      </div>
      {/* Seam with Contact above: bottom half of "@" melting from blue to white */}
      <BoundaryWatermark boundary={BOUNDARIES.contact_footer} edge="top" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-14"
        >
          <div className="lg:col-span-5">
            <div className="inline-flex bg-white rounded-2xl px-5 py-3.5 shadow-lg mb-6">
              <MegasoftLogo pole="office" className="text-[22px]" />
            </div>
            <p className="text-white/70 leading-relaxed max-w-md">
              Éditeur de logiciels de gestion d'entreprise en Algérie depuis 1990.
              Office, Digital, Services : trois pôles pour accompagner votre entreprise
              au quotidien.
            </p>
            <a
              href="https://www.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors mt-6"
            >
              <Facebook className="w-5 h-5 text-white" />
            </a>
          </div>

          <div className="lg:col-span-4 lg:pl-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-5">Contact</h3>
            <ul className="space-y-4">
              {/* Les DEUX lignes fixes du standard. Elles étaient réduites à
                  une seule ici, alors que la section Contact les annonce toutes
                  les deux : un visiteur tombant sur une ligne occupée n’avait
                  pas la seconde sous les yeux. */}
              <li className="flex items-start gap-3 text-white/80">
                <Phone className="w-4 h-4 flex-shrink-0 mt-1" />
                {/* Les numéros viennent de la MÊME source que la section
                    Contact : ils étaient recopiés ici, et rien n'empêchait les
                    deux endroits de diverger au premier changement. */}
                <span className="flex flex-col gap-1">
                  {CONTACT.coordonnees.telephones
                    .slice(0, PIED.telephones_affiches)
                    .map((t) => (
                      <a
                        key={t.affiche}
                        href={`tel:${t.appel ?? ""}`}
                        className="font-medium hover:text-white transition-colors"
                      >
                        {t.affiche}
                      </a>
                    ))}
                </span>
              </li>
              <li>
                <a href={`mailto:${CONTACT.coordonnees.email}`} className="flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">{CONTACT.coordonnees.email}</span>
                </a>
              </li>
              <li className="flex items-start gap-3 text-white/80">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{CONTACT.coordonnees.adresse}</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-5">Nos pôles</h3>
            {/*
             * Trois lignes, même grammaire que la colonne Contact voisine : un
             * signe à gauche, un texte à droite.
             *
             * ⚠️ PLUS DE PAVÉ BLANC. Les trois pôles étaient posés dans des
             * boîtes blanches sur le fond sombre : elles se lisaient comme des
             * autocollants collés là, et le logotype qu'elles contenaient
             * tombait à 11 px, taille à laquelle « MEGASOFT » n'est plus qu'une
             * trace grise. Le monogramme seul, à sa couleur, tient sur le fond
             * sombre sans qu'on ait à lui découper une fenêtre.
             *
             * Et la ligne entière est un lien : à l'endroit le plus fonctionnel
             * de la page, trois logos qui ne mènent nulle part sont une place
             * perdue.
             */}
            <ul className="space-y-4">
              {poles.map(({ pole, nom, quoi }) => (
                <li key={pole}>
                  <a
                    /*
                     * Le pôle voyage dans l'ancre : la section Solutions la lit
                     * et sélectionne l'onglet correspondant avant de s'amener à
                     * l'écran. Un simple « /#solutions » aurait déposé le
                     * visiteur sur Office quel que soit le pôle cliqué — le
                     * lien aurait menti.
                     */
                    href={`/#solutions-${pole}`}
                    className="group flex items-start gap-3.5 text-white/80 hover:text-white transition-colors"
                  >
                    <MegasoftMark className={`h-5 w-auto flex-shrink-0 mt-0.5 ${TEINTE[pole]}`} />
                    <span className="min-w-0">
                      <span className="block font-bold text-[15px] leading-tight text-white">{nom}</span>
                      <span className="block text-[13px] text-white/45 leading-snug group-hover:text-white/70 transition-colors">
                        {quoi}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Barre du bas : la mention légale, et les pages qui ne sont pas des
            sections de l'accueil. Ces deux liens ne sont pas décoratifs — une
            page qu'aucune autre ne pointe est une page que les moteurs
            explorent tard et classent mal. */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50 font-medium">
          <p>&copy; {new Date().getFullYear()} {PIED.mention_legale}</p>
          <nav className="flex items-center gap-6">
            <a href="/faq" className="hover:text-white transition-colors">
              Questions fréquentes
            </a>
            <a href="/blog/" className="hover:text-white transition-colors">
              Blog
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
