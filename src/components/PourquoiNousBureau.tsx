import { useRef } from "react";
import { CalendarCheck, ShieldCheck, Compass, Lightbulb, type LucideIcon } from "lucide-react";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import EntreeAuDefilement from "@/components/EntreeAuDefilement";
import styles from "./PourquoiNousBureau.module.css";
import { POURQUOI_NOUS } from "@/contenu";

/**
 * « Pourquoi nous » — la variante BUREAU (et tablette) de la section sombre.
 *
 * Le téléphone ne passe PAS par ici : il reçoit `PourquoiNousTelephone`, qui est
 * le code Megasoft d'origine. C'est `PourquoiNous.tsx` qui choisit. Voir
 * l'en-tête de ce fichier-là pour la raison de ce partage.
 *
 * D'OÙ VIENT CETTE SECTION
 * ------------------------
 * Sa mise en page est reprise du projet MyExoBrain (section « Industries »),
 * à la demande du commanditaire, qui voulait exactement ce mouvement-là. Le
 * squelette, la feuille de style et le moteur d'animation sont ceux de
 * l'original ; seuls le contenu, les couleurs et les polices sont ceux de
 * Megasoft. Les valeurs géométriques de `PourquoiNousBureau.module.css` ont été
 * relevées au pixel sur le site source : ne pas les « arrondir ».
 *
 * DEUX MÉCANIQUES SE SUPERPOSENT, ET IL NE FAUT PAS LES CONFONDRE
 * ---------------------------------------------------------------
 *  1. L'EMPILEMENT est du CSS : chaque carte est `position: sticky` et s'arrête
 *     32 px plus bas que la précédente (variable `--arret`). C'est ce décalage,
 *     et lui seul, qui produit l'éventail.
 *
 *  2. L'ENTRÉE est du JavaScript lié au défilement : `EntreeAuDefilement` fait
 *     monter chaque carte (translateY 320 → 0, échelle 0,3 → 1, inclinaison
 *     ±4°) en poursuivant la position de défilement, retenue par un ressort.
 *     Elle se rejoue à l'envers quand on remonte. NE PAS la remplacer par un
 *     `whileInView` : une apparition déclenchée une fois perd exactement ce qui
 *     fait l'effet.
 *
 * Les éléments animés sont désignés par `data-entree`, jamais par une classe.
 *
 * ⚠️ `overflow: hidden` NE DOIT PAS revenir sur la <section> — un ancêtre qui
 * le porte devient le conteneur de défilement de ses descendants `sticky`, et
 * l'empilement cesse de fonctionner. Le découpage dont les filigranes ont
 * besoin est porté par un calque dédié, posé À CÔTÉ du contenu.
 */

/** Les quatre arguments, dans l'ordre où ils s'empilent. */
/* Les cartes viennent de `content/accueil/pourquoi-nous.json`. Elles étaient
   recopiées à l'identique dans la variante téléphone : corriger une faute d'un
   côté la laissait de l'autre, invisible depuis un ordinateur. */
const CARTES = POURQUOI_NOUS.cartes;

/**
 * Les quatre engagements.
 *
 * Le gabarit d'origine dessinait ses pictogrammes en tracés SVG bruts. On garde
 * ici les icônes Lucide employées partout ailleurs sur le site : la feuille de
 * style pose `color`, elles héritent donc de l'encre de la section.
 */
const PICTOS = {
  calendrier: CalendarCheck,
  bouclier: ShieldCheck,
  boussole: Compass,
  ampoule: Lightbulb,
} as const;

const ENGAGEMENTS: { icone: LucideIcon; titre: string; texte: string }[] =
  POURQUOI_NOUS.engagements.map((e) => ({
    icone: PICTOS[e.icone],
    titre: e.titre,
    texte: e.texte,
  }));

/** Point d'arrêt de la première carte, puis 32 px de plus à chaque suivante. */
const ARRET_INITIAL = 164;
const PAS = 32;

const PourquoiNousBureau = () => {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section id="pourquoi" ref={sectionRef} className={styles.section}>
      <EntreeAuDefilement section="#pourquoi" />

      {/*
       * Calque de découpe des filigranes : il porte `overflow: hidden` pour
       * rogner les lettres sur les bords, mais il est posé À CÔTÉ du contenu.
       * L'englober annulerait le `sticky` des cartes (voir l'en-tête).
       */}
      <div className={styles.calqueFiligranes} aria-hidden>
        <SectionWatermark
          sectionRef={sectionRef}
          layers={[
            {
              text: "CONFIANCE",
              position: "bottom-8 md:bottom-16 left-3 md:left-[-1%]",
              size: "text-[13vw] md:text-[9vw]",
              variant: "outline",
              color: "0 0% 100%",
              parallax: 45,
              opacity: 0.06,
            },
          ]}
        />
        {/* Couture avec MEGA ERP au-dessus : bas du « ERP ». */}
        <BoundaryWatermark boundary={BOUNDARIES.megaerp_pourquoi} edge="top" />
        {/* Couture vers Partenaires en dessous : haut du « ? ». */}
        <BoundaryWatermark boundary={BOUNDARIES.pourquoi_partenaires} edge="bottom" />
      </div>

      <div className={styles.colonnes}>
        <div className={styles.entete} data-entree="texte">
          <p className={styles.pastille}>
            <span>{POURQUOI_NOUS.surtitre}</span>
            <span>distingue vraiment</span>
          </p>

          <h2 className={styles.titre}>{POURQUOI_NOUS.titre}</h2>

          <p className={styles.accroche}>
            De l'analyse de vos besoins au support quotidien, on reste impliqués bien après la mise
            en production.
          </p>

          <div className={styles.bouton}>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={styles.lienBouton}
            >
              Contactez-nous
            </a>
          </div>
        </div>

        {/*
         * Les quatre cartes. Chacune s'arrête 32 px plus bas que la
         * précédente : c'est ce décalage qui donne l'empilement.
         */}
        <div className={styles.cartes}>
          {CARTES.map(({ teinte, pin, titre, texte }, i) => (
            <div
              key={titre}
              className={styles.carteCadre}
              data-entree="carte"
              style={{ "--arret": ARRET_INITIAL + i * PAS + "px" } as React.CSSProperties}
            >
              <article className={styles.carte} data-teinte={teinte}>
                <h3 className={styles.carteTitre}>{titre}</h3>
                <p className={styles.carteTexte}>{texte}</p>
                <span className={styles.pin} data-pin={pin}>
                  <span className={styles.pastilleCarte} />
                </span>
              </article>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.bloc}>
        <div className={styles.blocHaut}>
          <div className={styles.atouts}>
            {ENGAGEMENTS.map(({ icone, titre, texte }, i) => (
              <Engagement key={titre} icone={icone} titre={titre} texte={texte} avecTrait={i > 0} />
            ))}
          </div>

          <div className={styles.separateur}>
            <span className={styles.traitFin}>
              {/*
               * L'image garde son enveloppe : posée en absolu par-dessus la
               * boîte, elle ne change rien à la géométrie mais bien à la
               * rastérisation d'un dessin étiré.
               */}
              <span className={styles.traitCalque}>
                <img
                  src="/assets/images/industries-trait-separateur.svg"
                  alt=""
                  width="493"
                  height="7"
                  loading="lazy"
                  decoding="async"
                  className={styles.traitImage}
                />
              </span>
            </span>
            <span className={styles.pilule}>
              <span className={styles.piluleTexte}>{POURQUOI_NOUS.pilule_engagements}</span>
              <span className={styles.piluleTrait} />
            </span>
            <span className={styles.traitFin} data-retourne="">
              <span className={styles.traitCalque}>
                <img
                  src="/assets/images/industries-trait-separateur.svg"
                  alt=""
                  width="493"
                  height="7"
                  loading="lazy"
                  decoding="async"
                  className={styles.traitImage}
                />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

/** Un engagement : son pictogramme, son titre, sa phrase — et le filet qui le précède. */
const Engagement = ({
  icone: Icone,
  titre,
  texte,
  avecTrait,
}: {
  icone: LucideIcon;
  titre: string;
  texte: string;
  avecTrait: boolean;
}) => (
  <>
    {avecTrait && <span className={styles.trait} />}
    <div className={styles.atout}>
      <span className={styles.icone}>
        <Icone aria-hidden strokeWidth={1.6} />
      </span>
      <div className={styles.atoutTexte}>
        <h3 className={styles.atoutTitre}>{titre}</h3>
        <p className={styles.atoutPhrase}>{texte}</p>
      </div>
    </div>
  </>
);

export default PourquoiNousBureau;
