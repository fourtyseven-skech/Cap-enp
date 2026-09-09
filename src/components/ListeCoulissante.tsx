import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * La liste d'un pôle, en pages qui coulissent horizontalement.
 *
 * CE QU'ELLE RÉSOUT
 * -----------------
 * L'onglet « Megasoft Office » portait ses six domaines, puis les onze
 * logiciels métiers en grille dessous : quatre rangées de cartes de plus, la
 * hauteur de l'onglet doublait et repoussait tout le reste de la page.
 *
 * Les six domaines restent donc EN PREMIÈRE PAGE, à l'endroit exact où ils
 * étaient. Les logiciels desktop occupent les pages suivantes, dans la même
 * présentation — pastille, nom, phrase — parce qu'ils sont de même nature :
 * pas une annexe, la déclinaison concrète des domaines qui précèdent.
 *
 * ⚠️ TOUTES LES PAGES SONT DANS LE DOCUMENT, tout le temps. Le défilement est
 * un simple `overflow-x-auto` : rien n'est démonté, donc un robot lit les onze
 * logiciels comme les six domaines, et ils restent dans le HTML pré-généré.
 * C'est la raison de ne pas avoir monté/démonté les pages à la demande.
 *
 * LE DÉFILEMENT EST NATIF
 * -----------------------
 * `scroll-snap` cale l'arrêt sur une page ; les flèches ne font qu'appeler
 * `scrollTo`. Le glissement au doigt et au trackpad est celui du système, avec
 * son inertie — et il fonctionne même sans JavaScript.
 *
 * L'AVANCE AUTOMATIQUE démarre seule et n'a pas de bouton : c'est le
 * comportement demandé. Elle s'efface devant le visiteur — survol, glissement,
 * flèche ou pastille la suspendent — et reprend après quelques secondes sans
 * intervention. Elle ne démarre jamais si le système demande de réduire les
 * animations.
 */

/**
 * L'icône d'une entrée.
 *
 * Volontairement plus large que `LucideIcon` : la plupart des entrées portent
 * une icône Lucide, mais « My Exobrain » porte son propre monogramme
 * (`brand/LogoMyExobrain`). Le contrat minimal est donc « un composant qui
 * accepte une classe », ce que les deux respectent.
 */
export type IconeListe = ComponentType<{ className?: string }>;

export type EntreeListe = {
  titre: string;
  texte: string;
  icone: IconeListe;
};

/**
 * Intervalle entre deux avances automatiques.
 *
 * Une page porte six entrées avec leur phrase : à 5 s, elle s’échappait avant
 * d’avoir été lue. 6,5 s laisse le temps de parcourir la page sans donner
 * l’impression que rien ne bouge. C’est le seul réglage à toucher pour doser
 * le rythme.
 */
const CADENCE = 6500;

/** Délai sans intervention avant que l'avance automatique reprenne la main. */
const REPRISE = 7000;

const mouvementReduit = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ListeCoulissante = ({
  pages,
  accent,
}: {
  pages: EntreeListe[][];
  accent: string;
}) => {
  const piste = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  /*
   * LA PISTE GARDE UNE HAUTEUR CONSTANTE : CELLE DE LA PAGE LA PLUS HAUTE.
   *
   * Elle a d'abord suivi la page affichée, pour coller les commandes sous le
   * dernier élément. Effet de bord : la carte changeait de taille à chaque
   * page, et les flèches se déplaçaient avec elle — le visiteur devait
   * rattraper du regard le bouton qu'il venait d'utiliser. Une commande qui
   * bouge coûte plus cher que quelques pixels de vide sous la dernière ligne.
   *
   * C'est devenu peu coûteux depuis que chaque description tient sur UNE
   * ligne : les trois pages ne diffèrent plus que d'une entrée, et le vide se
   * réduit à une seule rangée, sur la dernière page seulement.
   */
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hauteur, setHauteur] = useState<number | null>(null);

  const [suspendu, setSuspendu] = useState(false);
  const minuteur = useRef<number>();

  const coulisse = pages.length > 1;

  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el || el.clientWidth === 0) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    const el = piste.current;
    if (!el) return;
    mesurer();
    el.addEventListener("scroll", mesurer, { passive: true });
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", mesurer);
      ro.disconnect();
    };
  }, [mesurer]);

  /*
   * La hauteur retenue est le MAXIMUM des pages, pas celle de la page active :
   * c'est ce qui la rend constante. Remesurée au redimensionnement, où le
   * repli du texte change la hauteur des entrées.
   */
  useEffect(() => {
    const majHauteur = () => {
      const hauteurs = pageRefs.current.filter(Boolean).map((el) => el!.offsetHeight);
      if (hauteurs.length) setHauteur(Math.max(...hauteurs));
    };
    majHauteur();
    const ro = new ResizeObserver(majHauteur);
    for (const el of pageRefs.current) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [pages]);

  /** Va à la page demandée, en bouclant aux deux extrémités. */
  const allerA = useCallback(
    (cible: number) => {
      const el = piste.current;
      if (!el || el.clientWidth === 0) return;
      const index = ((cible % pages.length) + pages.length) % pages.length;
      el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    },
    [pages.length]
  );

  /** Une action du visiteur : on se tait, puis on reprend après un délai. */
  const suspendreUnMoment = useCallback(() => {
    setSuspendu(true);
    window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => setSuspendu(false), REPRISE);
  }, []);

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  /*
   * L'avance automatique relit la position réelle à chaque battement plutôt que
   * de compter ses propres tours : si le visiteur a fait coulisser à la main
   * entre-temps, elle repart de là où il s'est arrêté au lieu de sauter.
   */
  useEffect(() => {
    if (!coulisse || suspendu || mouvementReduit()) return;
    const t = window.setInterval(() => {
      const el = piste.current;
      if (!el || el.clientWidth === 0) return;
      allerA(Math.round(el.scrollLeft / el.clientWidth) + 1);
    }, CADENCE);
    return () => window.clearInterval(t);
  }, [coulisse, suspendu, allerA]);

  return (
    <div
      /* Le survol suspend tant qu'il dure : personne n'aime voir la ligne qu'il
         lit s'échapper sous le curseur. */
      onMouseEnter={() => coulisse && setSuspendu(true)}
      onMouseLeave={() => setSuspendu(false)}
    >
      <div
        ref={piste}
        onPointerDown={suspendreUnMoment}
        /*
         * `items-start` est indispensable : sans lui les pages s'étirent à la
         * hauteur du conteneur, leur `offsetHeight` vaut alors celle du
         * conteneur, et la mesure ci-dessus tourne en rond.
         *
         * `overflow-y-hidden` va avec la hauteur imposée : rien ne doit
         * déborder sous les commandes.
         *
         * `scrollbar-none` : la barre native ferait doublon avec les flèches et
         * réserverait une bande grise sous la liste (voir index.css).
         */
        style={{ height: hauteur ?? undefined }}
        className="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-none"
      >
        {pages.map((entrees, p) => (
          <div
            key={p}
            ref={(el) => (pageRefs.current[p] = el)}
            className="snap-start shrink-0 w-full divide-y divide-black/5"
          >
            {entrees.map((entree) => {
              const Icone = entree.icone;
              return (
                <div key={entree.titre} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-ms-paper border border-black/5">
                    <Icone className={`w-[18px] h-[18px] ${accent}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-ms-ink text-[15px] mb-1">{entree.titre}</h4>
                    <p className="text-[13px] text-ms-ink/60 leading-relaxed">{entree.texte}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* --- La commande : pastilles de page à gauche, flèches à droite --- */}
      {coulisse && (
        <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-black/5">
          <div className="flex items-center gap-2">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  suspendreUnMoment();
                  allerA(i);
                }}
                aria-label={`Aller à la page ${i + 1} sur ${pages.length}`}
                aria-current={i === page}
                className={`h-1.5 rounded-full transition-all ${
                  i === page ? "w-7 bg-ms-blue" : "w-1.5 bg-ms-ink/20 hover:bg-ms-ink/40"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                suspendreUnMoment();
                allerA(page - 1);
              }}
              aria-label="Page précédente"
              className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center text-ms-ink/60 hover:border-black/25 hover:text-ms-ink transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                suspendreUnMoment();
                allerA(page + 1);
              }}
              aria-label="Page suivante"
              className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center text-ms-ink/60 hover:border-black/25 hover:text-ms-ink transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListeCoulissante;
