import { useEffect, useRef } from "react";
import { motion, useInView, animate } from "framer-motion";
import { useRenduStatique } from "@/lib/renduStatique";
import { CHIFFRES } from "@/contenu";

const AnimatedCounter = ({ value, duration = 2 }: { value: number; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  // Dans le HTML pré-généré, aucun effet ne tourne : le compteur y resterait
  // figé sur son zéro de départ et un robot lirait « 0 Clients accompagnés ».
  const statique = useRenduStatique();

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, value, {
        duration,
        ease: "easeOut",
        onUpdate: (latest) => {
          if (ref.current) {
            ref.current.textContent = Math.round(latest).toString();
          }
        },
      });
      return () => controls.stop();
    }
  }, [isInView, value, duration]);

  return <span ref={ref}>{statique ? value : 0}</span>;
};

/*
 * Les chiffres ne sont plus écrits ici.
 *
 * Ils viennent de `content/accueil/chiffres.json`, validé au build contre son
 * schéma. C'est ce qui permettra de les modifier depuis le panel sans toucher
 * au code -- et c'est déjà ce qui a permis de corriger « 10 logiciels métiers »
 * en 11 sans relire un composant.
 */
const stats = CHIFFRES.chiffres.map((c) => ({
  value: c.valeur,
  label: c.libelle,
  suffix: c.suffixe,
}));

const Stats = () => {
  return (
    <div className="relative z-30 container mx-auto px-4 -mt-16 md:-mt-20">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        {/* Soft brand-blue glow beneath the floating card for extra pop against the hero */}
        <div className="absolute inset-x-6 -bottom-6 top-6 bg-ms-blue/25 blur-3xl rounded-[2rem] -z-10" />

        <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-black/5 grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-black/5">
          {stats.map((stat, index) => (
            <div key={index} className="relative p-6 md:p-8 text-center md:text-left overflow-hidden">
              {/* Per-card watermark: the card's own index, faint in the corner */}
              <span className="absolute -top-4 right-2 text-5xl md:text-6xl font-titrage font-black leading-none text-ms-ink/[0.035] select-none pointer-events-none tracking-tighter">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="relative text-2xl md:text-4xl font-extrabold text-ms-ink flex justify-center md:justify-start items-baseline">
                <AnimatedCounter value={stat.value} />
                <span>{stat.suffix}</span>
              </div>
              <p className="relative text-xs md:text-sm text-ms-ink/50 mt-2 font-semibold uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Stats;
