import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { MegasoftMark } from "@/components/brand/MegasoftLogo";

/**
 * Sur le hero : un seul M vectorisé blanc, invitant au clic.
 * Au clic, il éclate en trois M colorés (Office bleu, Digital rose,
 * Service vert) alignés côte à côte qui flottent doucement.
 * Re-cliquer les regroupe en un seul M blanc.
 *
 * Optimisations : animations 100 % transform/opacity (compositées GPU),
 * `will-change` sur les éléments animés, respect de `prefers-reduced-motion`
 * (halo/flottement désactivés → économie de batterie sur mobile), et
 * conteneur mis à l'échelle plus compacte sur petit écran.
 */

// Positions cibles (px, depuis le centre) — alignées à l'horizontale, côte à côte —
// + amplitude de flottement (léger va-et-vient vertical) propre à chaque pôle.
const poles = [
  { key: "office", label: "Office", color: "text-ms-blue", x: -58, y: 0, fy: -9, dur: 5 },
  { key: "digital", label: "Digital", color: "text-ms-pink", x: 0, y: 0, fy: 9, dur: 6 },
  { key: "service", label: "Services", color: "text-ms-green", x: 58, y: 0, fy: -8, dur: 5.5 },
] as const;

const PoleReveal = () => {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex origin-center scale-[0.85] items-center justify-center sm:scale-100"
        style={{ width: 210, height: 96 }}
      >
        <AnimatePresence mode="wait">
          {!open ? (
            /* ----- État fermé : un seul M blanc, avec halo qui pulse ----- */
            <motion.button
              key="single"
              type="button"
              onClick={() => setOpen(true)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="relative cursor-pointer outline-none"
              aria-label="Découvrir les trois pôles Megasoft"
            >
              {!reduce && (
                <motion.span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50"
                  style={{ width: 96, height: 96, willChange: "transform, opacity" }}
                  animate={{ scale: [1, 1.5], opacity: [0.55, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <motion.div
                style={{ willChange: "transform" }}
                animate={reduce ? undefined : { y: [0, -5, 0] }}
                transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <MegasoftMark className="w-16 h-auto text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]" />
              </motion.div>
            </motion.button>
          ) : (
            /* ----- État ouvert : trois M colorés qui flottent ----- */
            <motion.button
              key="three"
              type="button"
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-pointer outline-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Regrouper les pôles"
            >
              {poles.map((p, i) => (
                <span key={p.key} className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    style={{ willChange: "transform, opacity" }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                    animate={
                      reduce
                        ? { x: p.x, y: p.y, opacity: 1, scale: 1 }
                        : { x: p.x, y: [p.y, p.y + p.fy, p.y], opacity: 1, scale: 1 }
                    }
                    transition={
                      reduce
                        ? { duration: 0.3, delay: i * 0.06 }
                        : {
                            opacity: { duration: 0.4, delay: i * 0.08 },
                            scale: { type: "spring", stiffness: 260, damping: 18, delay: i * 0.08 },
                            x: { type: "spring", stiffness: 220, damping: 20, delay: i * 0.08 },
                            y: { duration: p.dur, repeat: Infinity, ease: "easeInOut" },
                          }
                    }
                  >
                    <MegasoftMark
                      className={`w-12 h-auto ${p.color} drop-shadow-[0_4px_14px_rgba(0,0,0,0.3)]`}
                    />
                  </motion.span>
                </span>
              ))}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Légende sous le M */}
      <AnimatePresence mode="wait">
        <motion.span
          key={open ? "labels" : "hint"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60"
        >
          {open ? "Office · Digital · Service" : "Cliquez pour découvrir nos pôles"}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export default PoleReveal;
