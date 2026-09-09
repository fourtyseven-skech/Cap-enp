import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Phone, Plus } from "lucide-react";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import { PARTENAIRES } from "@/contenu";

/* Le contenu vient de `content/accueil/partenaires.json`. Les noms de champs
   restent en anglais côté composant : les renommer n'apporterait rien et
   ferait diverger le HTML pendant la migration. */
const partners = PARTENAIRES.partenaires.map((p) => ({
  name: p.nom,
  region: p.region,
  address: p.adresse,
  phone: p.telephone,
}));

const Partenaires = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const watermarkText = openIndex !== null ? partners[openIndex].region : "RÉSEAU";

  return (
    <section id="partenaires" ref={sectionRef} className="py-24 md:py-32 relative scroll-mt-24 overflow-hidden">
      {/* Seam with Pourquoi nous above: bottom half of "?" */}
      <BoundaryWatermark boundary={BOUNDARIES.pourquoi_partenaires} edge="top" />
      {/* Seam into Témoignage below: top half of "05" */}
      <BoundaryWatermark boundary={BOUNDARIES.partenaires_temoignage} edge="bottom" />

      {/* Faint dot-grid backdrop, same vocabulary as the neighbouring sections */}
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none [mask-image:radial-gradient(ellipse_60%_55%_at_50%_40%,black,transparent)]"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--ms-ink)/0.15) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="absolute -top-20 -left-20 w-[220px] h-[220px] md:w-[420px] md:h-[420px] rounded-full bg-ms-blue/[0.07] blur-[50px] md:blur-[100px] pointer-events-none" />

      {/* Living watermark: the city currently open, in giant outlined type.
          Falls back to "RÉSEAU" when nothing is selected — the section's
          identity crossfades to match whatever the visitor is exploring. */}
      <div className="absolute inset-0 flex items-center justify-end pointer-events-none overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={watermarkText}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="font-titrage font-black uppercase tracking-tighter leading-none select-none whitespace-nowrap text-[15vw] md:text-[8vw] pr-[-2%]"
            style={{ color: "transparent", WebkitTextStroke: "1.5px hsl(var(--ms-blue) / 0.1)" }}
          >
            {watermarkText}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
            Réseau national
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight mb-4">
            {PARTENAIRES.titre}
          </h2>
          <p className="text-ms-ink/60">
            {PARTENAIRES.accroche}
          </p>
        </div>

        <div className="max-w-2xl mx-auto border-t border-black/10">
          {partners.map((p, i) => {
            const open = openIndex === i;
            return (
              <div key={p.name} className="border-b border-black/10">
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 py-6 text-left group"
                >
                  <span className="flex items-center gap-4 md:gap-6 min-w-0">
                    <span className="text-xs font-bold text-ms-ink/30 tabular-nums flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`text-xl md:text-3xl font-extrabold tracking-tight transition-colors truncate ${
                        open ? "text-ms-blue" : "text-ms-ink group-hover:text-ms-blue"
                      }`}
                    >
                      {p.region}
                    </span>
                  </span>
                  <Plus
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
                      open ? "rotate-45 text-ms-blue" : "text-ms-ink/40 group-hover:text-ms-blue"
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-500 ease-in-out ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pb-7 pl-[44px] md:pl-[64px] flex flex-col sm:flex-row sm:flex-wrap gap-x-8 gap-y-2.5">
                      <span className="font-bold text-ms-ink">{p.name}</span>
                      {p.address && (
                        <span className="flex items-center gap-2 text-sm text-ms-ink/60">
                          <MapPin className="w-4 h-4 text-ms-ink/30 flex-shrink-0" />
                          {p.address}
                        </span>
                      )}
                      <span className="flex items-center gap-2 text-sm text-ms-ink/60">
                        <Phone className="w-4 h-4 text-ms-ink/30 flex-shrink-0" />
                        {p.phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Partenaires;
