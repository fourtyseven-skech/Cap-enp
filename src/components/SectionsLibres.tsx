import { useRef } from "react";
import { motion } from "framer-motion";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import { SECTIONS_LIBRES } from "@/contenu";
import type { BlocAnnonce, BlocTexteImage, BlocTroisPoints } from "@/contenu/schemas";
import { icone } from "@/contenu/icones";
import { urlLogo } from "@/contenu/logosClients";

/**
 * ---------------------------------------------------------------------------
 * SECTIONS LIBRES
 * ---------------------------------------------------------------------------
 *
 * Ce que le client peut ajouter lui-même à la page d'accueil, à partir de trois
 * gabarits soignés. Voir `schemaSectionsLibres` pour le pourquoi de ceux-là.
 *
 * OÙ ELLES S'INSÈRENT, ET POURQUOI PAS AILLEURS
 * ---------------------------------------------
 * Entre Références et Contact — le seul endroit qui n'oblige pas à repenser un
 * enchaînement.
 *
 * Chaque section du site est reliée à la suivante par une COUTURE : un chiffre
 * dont la moitié haute est dans l'une et la moitié basse dans l'autre. Insérer
 * un bloc au milieu d'une paire séparerait les deux moitiés, et le filigrane
 * apparaîtrait coupé. Ici, le bloc reprend la couture à son compte :
 *
 *   Références  ── « 300+ » bas ──▸  Sections libres  ── « + » bas ──▸  Contact
 *
 * `ContactSection` reçoit donc en paramètre la couture qu'elle doit afficher en
 * haut, au lieu de la connaître d'avance.
 *
 * QUAND IL N'Y A RIEN
 * -------------------
 * Le composant ne rend RIEN — pas même un conteneur vide. La chaîne des
 * coutures redevient celle d'origine, et le HTML produit est identique à ce
 * qu'il était avant l'existence de ce fichier. C'est ce qui a permis de
 * l'ajouter sans rien changer au site.
 */

/* -------------------------------------------------------- texte et image */

const TexteEtImage = ({
  bloc,
}: {
  bloc: BlocTexteImage;
}) => {
  const source = urlLogo(bloc.image);

  return (
    <div
      className={`grid gap-8 md:gap-12 md:grid-cols-2 items-center ${
        // `md:[direction:rtl]` inverserait aussi le texte : on réordonne les
        // deux enfants, ce qui laisse chaque bloc lu dans le bon sens.
        bloc.cote === "gauche" ? "" : "md:[&>*:first-child]:order-2"
      }`}
    >
      {source ? (
        <img
          src={source}
          alt={bloc.alt}
          loading="lazy"
          decoding="async"
          className="w-full rounded-2xl border border-black/5 shadow-sm object-cover aspect-[4/3]"
        />
      ) : (
        /* Image introuvable : un cadre neutre plutôt qu'une icône cassée. Le
           texte, lui, reste lisible — c'est l'essentiel du bloc. */
        <div className="w-full rounded-2xl border border-dashed border-black/10 aspect-[4/3]" />
      )}

      <div>
        <h3 className="text-xl md:text-3xl font-extrabold tracking-tight text-ms-ink mb-4 leading-[1.15]">
          {bloc.titre}
        </h3>
        <p className="text-sm md:text-base text-ms-ink/60 leading-relaxed whitespace-pre-line">
          {bloc.texte}
        </p>
      </div>
    </div>
  );
};

/* --------------------------------------------------------- trois points */

const TroisPoints = ({
  bloc,
}: {
  bloc: BlocTroisPoints;
}) => (
  <div>
    <div className="max-w-2xl mb-10">
      <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-5">
        {bloc.surtitre}
      </span>
      <h3 className="text-xl md:text-3xl font-extrabold tracking-tight text-ms-ink leading-[1.15]">
        {bloc.titre}
      </h3>
    </div>

    <div className="grid gap-4 md:grid-cols-3 md:gap-0 md:divide-x md:divide-black/10">
      {bloc.points.map((point, i) => {
        const Icone = icone(point.icone);
        return (
          <div
            key={`${point.titre}-${i}`}
            className="rounded-2xl bg-white border border-black/5 shadow-sm p-6 md:rounded-none md:bg-transparent md:border-0 md:shadow-none md:p-0 md:px-10 md:first:pl-0 md:last:pr-0"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-ms-blue/10 text-ms-blue">
              <Icone className="w-4.5 h-4.5" />
            </span>
            <h4 className="font-bold text-lg text-ms-ink mt-4 mb-3">{point.titre}</h4>
            <p className="text-ms-ink/60 text-sm leading-relaxed">{point.texte}</p>
          </div>
        );
      })}
    </div>
  </div>
);

/* ---------------------------------------------------------------- annonce */

/**
 * Un titre en grand, le fichier en pleine largeur, quelques lignes.
 *
 * Le gabarit de l'événement — un prix remporté, un salon, une certification.
 * C'est le seul qui accepte une VIDÉO : c'est là qu'il y a quelque chose à
 * montrer plutôt qu'à expliquer.
 *
 * LA VIDÉO NE DÉMARRE PAS TOUTE SEULE
 * -----------------------------------
 * Contrôles apparents, pas de lecture automatique, `preload="metadata"` : la
 * page ne télécharge que l'entête tant que personne ne clique. Une vidéo
 * d'annonce qui se lancerait seule ferait exactement ce que les seuils de poids
 * cherchent à éviter — quelques mégaoctets imposés à un visiteur mobile qui ne
 * les a pas demandés.
 */
const Annonce = ({ bloc }: { bloc: BlocAnnonce }) => {
  const estVideo = /\.(mp4|webm)$/i.test(bloc.media);
  const source = estVideo ? bloc.media : urlLogo(bloc.media);

  return (
    <div className="max-w-4xl mx-auto text-center">
      <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-5">
        {bloc.surtitre}
      </span>
      <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight text-ms-ink leading-[1.1] mb-8">
        {bloc.titre}
      </h3>

      {estVideo && source ? (
        <video
          src={source}
          controls
          playsInline
          preload="metadata"
          aria-label={bloc.alt}
          className="w-full rounded-2xl border border-black/5 shadow-sm bg-black aspect-video"
        />
      ) : source ? (
        <img
          src={source}
          alt={bloc.alt}
          loading="lazy"
          decoding="async"
          className="w-full rounded-2xl border border-black/5 shadow-sm object-cover aspect-video"
        />
      ) : (
        /* Fichier introuvable : un cadre neutre, jamais une icône cassée. */
        <div className="w-full rounded-2xl border border-dashed border-black/10 aspect-video" />
      )}

      <p className="text-sm md:text-base text-ms-ink/60 leading-relaxed whitespace-pre-line mt-8">
        {bloc.texte}
      </p>
    </div>
  );
};

/* ========================================================================= */

const SectionsLibres = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { blocs } = SECTIONS_LIBRES;

  // Rien à afficher : on ne pose même pas de conteneur, pour que la chaîne des
  // coutures reste exactement celle d'origine.
  if (!blocs.length) return null;

  return (
    <section
      id="autres"
      ref={sectionRef}
      className="relative scroll-mt-24 py-24 md:py-32 overflow-hidden"
    >
      {/* Moitié haute de la couture venue de Références. */}
      <BoundaryWatermark boundary={BOUNDARIES.references_contact} edge="top" />
      {/* Moitié basse de la couture vers Contact. */}
      <BoundaryWatermark boundary={BOUNDARIES.libres_contact} edge="bottom" />

      <div className="container mx-auto px-4 relative space-y-20 md:space-y-28">
        {blocs.map((bloc, i) => (
          <motion.div
            key={`${bloc.gabarit}-${i}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {bloc.gabarit === "texte-image" ? (
              <TexteEtImage bloc={bloc} />
            ) : bloc.gabarit === "annonce" ? (
              <Annonce bloc={bloc} />
            ) : (
              <TroisPoints bloc={bloc} />
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default SectionsLibres;
