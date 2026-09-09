import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Mail,
  MapPin,
  Phone,
  ArrowRight,
  Facebook,
  Plus,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import BoundaryWatermark, { BOUNDARIES } from "@/components/BoundaryWatermark";
import SectionWatermark from "@/components/SectionWatermark";
import { CONTACT } from "@/contenu";

/* Classes partagées par tous les champs : une seule définition, sinon les
   dix champs dérivent les uns des autres au premier ajustement de style. */
const FIELD =
  "w-full bg-ms-paper border border-black/5 rounded-xl p-3.5 text-ms-ink placeholder:text-ms-ink/30 focus:border-ms-blue focus:outline-none transition-all";
/* Les <select> natifs n'héritent pas de la police du parent sur Safari/iOS et
   affichent une flèche système ; on force la police et on garde la flèche. */
const FIELD_SELECT = `${FIELD} font-[inherit] cursor-pointer`;

/* Les listes déroulantes et les coordonnées viennent de
   `content/accueil/contact.json`. Les couleurs des pôles, elles, restent
   ci-dessous : ce sont des classes Tailwind, pas du contenu. */
const SECTEURS = CONTACT.secteurs;
const TAILLES = CONTACT.tailles;

/* Chaque pôle porte sa couleur de marque jusque dans le formulaire : c'est le
   seul champ où le visiteur choisit une entité, autant qu'il la reconnaisse. */
const POLES = [
  { value: "Megasoft Office", label: "Megasoft Office", dot: "bg-ms-blue", border: "border-ms-blue", text: "text-ms-blue", on: "border-ms-blue bg-ms-blue/5" },
  { value: "Megasoft Digital", label: "Megasoft Digital", dot: "bg-ms-pink", border: "border-ms-pink", text: "text-ms-pink", on: "border-ms-pink bg-ms-pink/5" },
  { value: "Megasoft Services", label: "Megasoft Services", dot: "bg-ms-green", border: "border-ms-green", text: "text-ms-green", on: "border-ms-green bg-ms-green/5" },
];

/* Étiquette + champ. L'astérisque est porté par le label et non par un
   `required` invisible : le visiteur voit ce qui est obligatoire avant de
   déclencher la validation du navigateur. */
const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <label className="block space-y-1.5">
    <span className="block text-xs font-bold text-ms-ink/50 uppercase tracking-widest ml-1">
      {label} {required && <span className="text-ms-blue">*</span>}
    </span>
    {children}
  </label>
);

/**
 * `coutureHaut` — quelle couture Contact affiche en haut.
 *
 * Normalement celle venue de Références. Quand le client a ajouté des sections
 * libres, c'est le bloc de sections qui suit Références : Contact prend alors
 * la couture de CE bloc, sans quoi les deux moitiés du filigrane se
 * retrouveraient séparées par lui.
 */
const ContactSection = ({
  coutureHaut = "references_contact",
}: {
  coutureHaut?: "references_contact" | "libres_contact";
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pole, setPole] = useState("");
  const [poleErreur, setPoleErreur] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!pole) {
      setPoleErreur(true);
      toast.error("Merci de choisir un pôle.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch("https://formspree.io/f/mwvpgaqg", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        setIsSuccess(true);
        toast.success("Message envoyé !");
      } else {
        toast.error("Erreur lors de l'envoi.");
      }
    } catch {
      toast.error("Erreur de connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section id="contact" ref={sectionRef} className="py-24 md:py-32 relative scroll-mt-24 overflow-hidden">
      {/* Section accent watermark */}
      <SectionWatermark
        sectionRef={sectionRef}
        layers={[
          { text: "PARLONS-EN", position: "top-20 md:top-10 left-[-2%]", size: "text-[12vw] md:text-[7.5vw]", variant: "outline", color: "var(--ms-blue)", parallax: 45, opacity: 0.06 },
        ]}
      />
      {/* Seam with Références above: bottom half of "300+" */}
      <BoundaryWatermark boundary={BOUNDARIES[coutureHaut]} edge="top" />
      {/* Seam into the footer below: top half of "@" */}
      <BoundaryWatermark boundary={BOUNDARIES.contact_footer} edge="bottom" />

      {/* Subtle dot-grid + brand-blue glow, matching the treatment used elsewhere on the page */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black,transparent)]"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--ms-blue)/0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute top-0 right-0 w-[260px] h-[260px] md:w-[500px] md:h-[500px] rounded-full bg-ms-blue/[0.06] blur-[60px] md:blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto text-center mb-12"
      >
        <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
          Contact
        </span>
        <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight mb-4">
          Contactez-nous
        </h2>
        <p className="text-ms-ink/60">
          Une question ? Un projet ? Notre équipe vous répond rapidement.
        </p>
        {/* La FAQ a quitté l'accueil pour sa propre page : c'est ici, juste
            avant le formulaire, qu'elle rend le plus service — beaucoup de
            demandes y trouvent leur réponse sans attendre. */}
        <p className="mt-3 text-sm text-ms-ink/50">
          Conformité, cloud, périmètre :{" "}
          <a
            href="/faq"
            className="font-bold text-ms-blue hover:text-ms-ink underline underline-offset-4 decoration-ms-blue/30 transition-colors"
          >
            consultez les questions fréquentes
          </a>
          .
        </p>
      </motion.div>

      {/*
        * DEUX COLONNES, MAIS PAS MOITIÉ-MOITIÉ.
        *
        * Au départ le formulaire tenait dans une demi-colonne — dix champs sur
        * 480 px de large, la section descendait interminablement. Étalé sur
        * toute la largeur, il devenait au contraire illisible : à quatre champs
        * de front, l'œil traverse tout l'écran entre une étiquette et le champ
        * suivant.
        *
        * Le partage retenu est de deux tiers / un tiers : le formulaire garde
        * une largeur de lecture confortable (~700 px, deux champs par rangée),
        * et les trois coordonnées tiennent à sa droite, visibles sans défiler.
        */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-[3px] rounded-[2rem] bg-ms-blue"
        >
          <div className="bg-white rounded-[calc(2rem-3px)] p-6 sm:p-8">
            {isSuccess ? (
              <div className="text-center py-16">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-ms-blue rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-ms-ink mb-3">Message bien reçu !</h3>
                <p className="text-ms-ink/60">Notre équipe revient vers vous très vite.</p>
                <button
                  onClick={() => { setIsSuccess(false); setPole(""); }}
                  className="mt-8 text-ms-blue hover:text-ms-ink font-bold text-sm uppercase tracking-widest transition-colors"
                >
                  Nouvelle demande
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-extrabold text-ms-ink mb-2">Parlez-nous de votre projet</h3>

                {/* Piège à robots : invisible pour l'humain, rempli par les
                    scripts de spam. Formspree ignore l'envoi si _gotcha est
                    rempli — pas de captcha à imposer au visiteur. */}
                <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                {/*
                 * Huit champs courts, deux par rangée.
                 *
                 * Une version intermédiaire en mettait QUATRE de front, sur un
                 * bloc de 1152 px. La section y gagnait en hauteur, mais un
                 * formulaire aussi large se lit mal : l'œil doit traverser tout
                 * l'écran entre une étiquette et le champ suivant, et les
                 * champs deviennent trop courts pour ce qu'on y saisit. La
                 * largeur de lecture confortable d'un formulaire tourne autour
                 * de 800 à 900 px — c'est le palier retenu.
                 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nom et prénom" required>
                    <input type="text" name="Nom et prénom" required placeholder="Votre nom complet" className={FIELD} />
                  </Field>
                  <Field label="Entreprise" required>
                    <input type="text" name="Entreprise" required placeholder="Raison sociale" className={FIELD} />
                  </Field>
                  <Field label="Fonction">
                    <input type="text" name="Fonction" placeholder="Votre poste" className={FIELD} />
                  </Field>
                  <Field label="Email professionnel" required>
                    <input type="email" name="Email professionnel" required placeholder="nom@entreprise.com" className={FIELD} />
                  </Field>
                  <Field label="Téléphone" required>
                    <input type="tel" name="Téléphone" required placeholder="+213 ..." className={FIELD} />
                  </Field>
                  <Field label="Secteur d'activité" required>
                    <select name="Secteur d'activité" required defaultValue="" className={FIELD_SELECT}>
                      <option value="" disabled>Sélectionnez…</option>
                      {SECTEURS.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Taille de l'entreprise">
                    <select name="Taille de l'entreprise" defaultValue="" className={FIELD_SELECT}>
                      <option value="">Sélectionnez…</option>
                      {TAILLES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Localisation">
                    <input type="text" name="Localisation" placeholder="Ville, wilaya / pays" className={FIELD} />
                  </Field>
                </div>

                {/*
                 * Le pôle et le message partagent une rangée : à eux deux ils
                 * occupaient auparavant toute la hauteur restante l'un sous
                 * l'autre. Les trois pôles s'empilent donc verticalement dans
                 * leur colonne, ce qui les rend d'ailleurs plus lisibles que
                 * côte à côte.
                 */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-5 lg:gap-6 items-start">
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-bold text-ms-ink/50 uppercase tracking-widest ml-1 mb-1.5">
                      Pôle recherché <span className="text-ms-blue">*</span>
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                      {POLES.map((p) => {
                        const actif = pole === p.value;
                        return (
                          <label
                            key={p.value}
                            className={`flex items-center gap-2.5 cursor-pointer rounded-xl border p-3.5 transition-all focus-within:ring-2 focus-within:ring-ms-blue/40 ${
                              actif ? `${p.on} shadow-sm` : "border-black/5 bg-ms-paper hover:border-black/15"
                            }`}
                          >
                            <input
                              type="radio"
                              name="Pôle recherché"
                              value={p.value}
                              checked={actif}
                              onChange={() => { setPole(p.value); setPoleErreur(false); }}
                              className="sr-only"
                            />
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                                actif ? `${p.dot} ${p.border}` : "border-black/20"
                              }`}
                            />
                            <span className={`text-sm font-bold leading-tight ${actif ? p.text : "text-ms-ink/70"}`}>
                              {p.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {poleErreur && (
                      <p className="text-xs font-bold text-red-600 ml-1 pt-1">Sélectionnez le pôle qui vous intéresse.</p>
                    )}
                  </fieldset>

                  <Field label="Décrivez votre besoin / votre projet" required>
                    <textarea
                      name="Besoin / projet"
                      /* 4 lignes : la hauteur juste sur téléphone, où la
                         zone occupait auparavant la moitié de l écran. Sur
                         grand écran, `min-height` la fait descendre au niveau
                         des trois pôles, à côté desquels elle est rangée —
                         l attribut `rows`, lui, ne connaît pas les paliers. */
                      rows={4}
                      required
                      placeholder="Contexte, périmètre, échéance souhaitée…"
                      className={`${FIELD} resize-none lg:min-h-[14rem]`}
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group w-full bg-ms-blue hover:bg-ms-blue/90 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-sm transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSubmitting ? "Envoi..." : (
                    <>
                      Envoyer ma demande <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-xs text-ms-ink/40 text-center leading-relaxed">
                  Les champs marqués <span className="text-ms-blue font-bold">*</span> sont obligatoires.
                  Vos informations servent uniquement à traiter votre demande.
                </p>
              </form>
            )}
          </div>
        </motion.div>

        {/* --- COORDONNÉES ---
            À droite du formulaire, empilées. La carte Google reste dépliable
            depuis la fiche « Adresse » : elle s'ouvre dans la colonne, sans
            décaler le formulaire. */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-4"
        >
          <ContactItem
            icon={MapPin}
            title="Adresse"
            value={CONTACT.coordonnees.adresse}
            mapQuery="Logiciels de gestion Algérie : MEGASOFT OFFICE"
            mapLink="https://maps.app.goo.gl/SmerNMrJcg5AxZrY6"
          />
          <ContactItem
            icon={Phone}
            title="Téléphone"
            value={CONTACT.coordonnees.telephones.map((t) => t.affiche).join(" / ")}
            href={`tel:${CONTACT.coordonnees.telephones[0].appel}`}
          />
          <ContactItem
            icon={Mail}
            title="Email"
            value={CONTACT.coordonnees.email}
            href={`mailto:${CONTACT.coordonnees.email}`}
          />

          <a
            href="https://www.facebook.com/p/MEGASOFT-OFFICE-100057358582033/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white border border-black/5 shadow-sm text-ms-ink/70 hover:text-ms-ink transition-colors"
          >
            <Facebook className="w-5 h-5 text-ms-blue" />
            <span className="text-sm font-bold">Suivez-nous sur Facebook</span>
          </a>
        </motion.div>
      </div>
      </div>
    </section>
  );
};

const ContactItem = ({
  icon: Icon,
  title,
  value,
  href,
  mapQuery,
  mapLink,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  href?: string;
  /** Si fourni, la carte devient dépliable et affiche une Google Maps de ce lieu
   *  (texte d'adresse ou coordonnées "lat,long" pour un repère exact). */
  mapQuery?: string;
  /** Lien Google Maps exact ouvert par le bouton « Ouvrir dans Google Maps ». */
  mapLink?: string;
}) => {
  const [open, setOpen] = useState(false);
  const embedSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=17&output=embed`
    : "";
  const externalSrc = mapLink
    ? mapLink
    : mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
      : "";

  return (
    <div className="relative rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden">
      <div className="relative flex items-start gap-4 p-5">
        {/* Per-card watermark: an oversized ghost of the card's own icon */}
        <Icon className="absolute -bottom-4 -right-3 w-24 h-24 text-ms-blue/[0.05] pointer-events-none" strokeWidth={1.25} />
        <div className="relative w-11 h-11 rounded-full bg-ms-blue/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-ms-blue" />
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="text-xs text-ms-ink/40 font-bold uppercase tracking-wider mb-1">{title}</p>
          {href ? (
            <a href={href} className="text-ms-ink font-semibold hover:text-ms-blue transition-colors">
              {value}
            </a>
          ) : (
            <p className="text-ms-ink font-semibold">{value}</p>
          )}
        </div>

        {/* Bouton + : déplie la carte Google Maps */}
        {mapQuery && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Masquer la carte" : "Afficher la carte"}
            className="relative flex-shrink-0 w-9 h-9 rounded-full bg-ms-blue/10 text-ms-blue flex items-center justify-center hover:bg-ms-blue hover:text-white transition-colors"
          >
            <Plus
              className={`w-5 h-5 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Carte Google Maps dépliable */}
      {mapQuery && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="map"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="relative overflow-hidden"
            >
              <div className="px-5 pb-5">
                <div className="relative rounded-xl overflow-hidden border border-black/5">
                  <iframe
                    title="Localisation de Megasoft sur Google Maps"
                    src={embedSrc}
                    className="w-full h-56 md:h-64"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
                <a
                  href={externalSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-ms-blue hover:text-ms-ink transition-colors"
                >
                  Ouvrir dans Google Maps <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default ContactSection;
