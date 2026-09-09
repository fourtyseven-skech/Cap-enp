import { useRef } from "react";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import { AVIS } from "@/contenu";

/**
 * « Avis » — les témoignages clients.
 *
 * TROIS CARTES EN ÉVENTAIL, SUR UNE SEULE VUE.
 *
 * La section n'affichait qu'un seul témoignage — ce qui laisse entendre qu'on
 * n'en a trouvé qu'un. Les trois avis sont désormais posés côte à côte, comme
 * trois cartes qu'on aurait étalées sur une table : celle du milieu bien en
 * face, celle de gauche inclinée vers la gauche, celle de droite vers la
 * droite. Tout est visible d'un coup d'œil, sans défilement.
 *
 * ⚠️ PAS D'EMPILEMENT ICI. Une version précédente les empilait en `sticky`,
 * comme la section « Pourquoi nous ». Écarté volontairement : deux sections qui
 * se suivent avec le même effet, c'est un tic, pas une identité — et surtout,
 * l'empilement cache les avis les uns derrière les autres alors que l'enjeu est
 * précisément de montrer qu'il y en a plusieurs.
 */

/**
 * Les avis publiés.
 *
 * ⚠️ CE SONT DES PAROLES DE CLIENTS. On ne réécrit pas un avis pour qu'il
 * « sonne mieux » : cela le transforme en faux témoignage. Seule exception
 * assumée à ce jour, à la demande du commanditaire : le tutoiement de l'avis de
 * Farouk Bensaid est passé au vouvoiement (« tu devrais » → « vous devriez »),
 * pour l'accorder au reste du site. Le sens est intact ; toute retouche plus
 * large ne le serait pas.
 *
 * ⚠️ `note` EST À CONFIRMER. Les textes proviennent d'avis réels, mais le
 * nombre d'étoiles de chacun n'a pas été relevé — il est ici supposé à 5.
 * Vérifier avant mise en ligne : une note affichée plus haute que la note
 * réelle est un faux avis, quelle que soit la sincérité du texte.
 */
/**
 * L'ORDRE de l'éventail et les accents restent ici : ce sont des choix de mise
 * en page, pas du contenu. Le texte des avis vit dans
 * `content/accueil/avis.json`.
 *
 * La correspondance se fait par position -- premier avis à gauche, deuxième au
 * centre, troisième à droite -- et le schéma en impose exactement trois. La
 * place du centre n'est pas neutre : c'est le seul avis signé d'une entreprise
 * identifiable, et l'œil doit le prendre en premier.
 */
const DISPOSITION = [
  { place: "gauche", accent: "mauve" },
  { place: "centre", accent: "blue" },
  { place: "droite", accent: "green" },
] as const;

const avis = AVIS.avis.map((a, i) => ({
  ...a,
  place: DISPOSITION[i].place,
  accent: DISPOSITION[i].accent,
}));

/* Les classes sont écrites en toutes lettres : Tailwind lit le fichier tel
   quel et ne verrait pas une classe assemblée à l'exécution. */
const ACCENTS = {
  mauve: { puce: "bg-ms-mauve", etoile: "text-ms-mauve", halo: "bg-ms-mauve/10" },
  blue: { puce: "bg-ms-blue", etoile: "text-ms-blue", halo: "bg-ms-blue/10" },
  green: { puce: "bg-ms-green", etoile: "text-ms-green", halo: "bg-ms-green/10" },
} as const;

/**
 * L'éventail, place par place.
 *
 * Les latérales penchent chacune vers son bord, la centrale reste droite, un
 * peu plus grande et devant : c'est elle que l'œil doit prendre en premier, et
 * c'est aussi le seul avis signé d'une entreprise identifiable.
 *
 * ⚠️ PAS DE MARGES NÉGATIVES pour resserrer l'éventail. Une première version en
 * posait : les cartes se recouvraient et la centrale rognait le texte des deux
 * autres — « professionnel » et le « U » de « Un logiciel » disparaissaient
 * sous elle. L'inclinaison suffit à faire l'éventail ; l'écart doit rester
 * assez large pour que l'agrandissement de la centrale ne mange personne.
 *
 * Tout est préfixé `lg:` : en dessous, les cartes se suivent, droites.
 */
const PLACES = {
  gauche: "lg:-rotate-[5deg] lg:translate-y-8",
  centre: "lg:z-10 lg:scale-[1.06]",
  droite: "lg:rotate-[5deg] lg:translate-y-8",
} as const;

const Temoignage = () => {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      id="temoignages"
      ref={sectionRef}
      className="relative scroll-mt-24 py-24 md:py-32 overflow-hidden bg-ms-mauve/5"
    >
      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          {
            text: "“",
            position: "top-2 md:top-4 right-[1%]",
            size: "text-[28vw] md:text-[15vw]",
            color: "var(--ms-mauve)",
            parallax: -30,
            rotate: -4,
            opacity: 0.08,
          },
          {
            text: "AVIS",
            position: "bottom-6 md:bottom-12 left-3 md:left-[-1%]",
            size: "text-[16vw] md:text-[10vw]",
            variant: "outline",
            color: "var(--ms-mauve)",
            parallax: 40,
            opacity: 0.09,
          },
        ]}
      />
      {/* Couture avec Partenaires au-dessus : bas du « 05 ». */}
      <BoundaryWatermark boundary={BOUNDARIES.partenaires_temoignage} edge="top" />
      {/* Couture vers Références en dessous : haut du « 12K ». */}
      <BoundaryWatermark boundary={BOUNDARIES.temoignage_references} edge="bottom" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mx-auto text-center mb-14 md:mb-20"
        >
          <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
            Avis clients
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight mb-4">
            Ce qu'en disent nos clients
          </h2>
          <p className="text-ms-ink/60">
            Des entreprises qui travaillent sur nos logiciels au quotidien, parfois depuis plus de
            dix ans.
          </p>
        </motion.div>

        {/* `items-center` : les trois textes n'ont pas la même longueur, donc
            les cartes pas la même hauteur. Centrées, l'éventail reste équilibré ;
            étirées, la plus courte se retrouverait pleine de vide. */}
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-center lg:items-center lg:gap-5">
          {avis.map((a, i) => {
            const accent = ACCENTS[a.accent];
            /*
             * DEUX ÉLÉMENTS IMBRIQUÉS, ET C'EST INDISPENSABLE.
             *
             * Le cadre extérieur porte l'inclinaison de l'éventail ; la figure
             * animée est dedans. Les deux sur le même élément ne cohabitent
             * pas : framer-motion écrit son propre `transform` en ligne, qui
             * écrase la rotation posée par Tailwind — la carte se redressait à
             * la fin de l'animation d'entrée et l'éventail disparaissait.
             * Constaté en capture, pas supposé.
             */
            return (
              <div
                key={a.auteur}
                className={`relative w-full max-w-md lg:w-1/3 lg:max-w-none transition-transform duration-500 ease-out hover:z-20 hover:rotate-0 hover:scale-[1.06] ${PLACES[a.place]}`}
              >
                <motion.figure
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="relative rounded-[1.75rem] bg-white border border-black/5 p-7 md:p-8 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.10),0_20px_45px_-15px_rgba(0,0,0,0.18)] overflow-hidden"
                >
                {/* Guillemet fantôme : le filigrane propre à la carte. */}
                <Quote
                  className={`absolute -bottom-6 -right-4 w-32 h-32 ${accent.etoile} opacity-[0.06] pointer-events-none`}
                  strokeWidth={1.25}
                  aria-hidden
                />

                <div
                  className="relative flex items-center gap-1 mb-5"
                  aria-label={`${a.note} étoiles sur 5`}
                >
                  {Array.from({ length: 5 }, (_, e) => (
                    <Star
                      key={e}
                      className={`w-[18px] h-[18px] ${
                        e < a.note ? `${accent.etoile} fill-current` : "text-ms-ink/15"
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>

                <blockquote className="relative text-base md:text-lg text-ms-ink font-bold leading-snug tracking-tight mb-7">
                  {a.texte}
                </blockquote>

                <figcaption className="relative flex items-center gap-3.5">
                  <span
                    className={`w-10 h-10 rounded-full ${accent.halo} flex items-center justify-center flex-shrink-0`}
                  >
                    <span className={`w-2 h-2 rounded-full ${accent.puce}`} />
                  </span>
                  <span>
                    <span className="block font-extrabold text-ms-ink text-sm">{a.auteur}</span>
                    {a.organisation && (
                      <span className="block text-ms-ink/50 text-xs uppercase tracking-wider font-semibold">
                        {a.organisation}
                      </span>
                    )}
                  </span>
                </figcaption>
                </motion.figure>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Temoignage;
