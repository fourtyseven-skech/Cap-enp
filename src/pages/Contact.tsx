import { useState } from "react";
import { motion } from "framer-motion";
// Correction ici : ArrowRight est bien importé
import { CheckCircle, Mail, MapPin, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import ParticleBackground from "@/components/ParticleBackground";

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch("https://formspree.io/f/mvgeqrab", {
        method: "POST", 
        body: formData, 
        headers: { 'Accept': 'application/json' }
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

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center">
      {/* Background */}
      <div className="fixed inset-0 z-0">
         <ParticleBackground />
      </div>
      <div className="texture-overlay fixed inset-0 z-[1] pointer-events-none" />

      <div className="relative z-10 container mx-auto px-6 py-24 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            
            {/* --- COLONNE GAUCHE : INFO VISUELLE --- */}
            <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-10"
            >
                <div>
                    <span className="inline-block px-3 py-1 mb-4 rounded-full bg-cap-blue/10 border border-cap-blue/20 text-cap-blue text-xs font-bold tracking-wider uppercase">
                        <span className="inline-block w-2 h-2 rounded-full bg-cap-blue mr-2 animate-pulse"></span>
                        Ouvert aux collaborations
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black uppercase text-white font-heading leading-none">
                        Let's <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cap-blue to-cap-cyan">
                            Connect
                        </span>.
                    </h1>
                </div>

                <p className="text-xl text-gray-300 max-w-md leading-relaxed font-sans">
                    Vous avez un projet ambitieux ? Une question sur nos activités ? Ou simplement envie de dire bonjour ? Le CAP est à votre écoute.
                </p>

                {/* Info Blocks */}
                <div className="space-y-6">
                    <ContactItem icon={Mail} title="Email" value="cap@enp.edu.dz" href="mailto:cap@enp.edu.dz" />
                    <ContactItem icon={MapPin} title="QG" value="École Nationale Polytechnique, Alger" />
                    <ContactItem icon={Clock} title="Temps de réponse" value="Généralement sous 24h" />
                </div>
            </motion.div>

            {/* --- COLONNE DROITE : FORMULAIRE ASYMÉTRIQUE --- */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
            >
                {/* Decorative Elements behind form */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-cap-cyan/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cap-blue/20 rounded-full blur-3xl animate-pulse delay-700" />

                <div className="relative bg-black/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2rem] shadow-2xl">
                    
                    {isSuccess ? (
                        <div className="text-center py-20">
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-gradient-to-r from-cap-blue to-cap-cyan rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cap-cyan/20">
                                <CheckCircle className="w-12 h-12 text-white" />
                            </motion.div>
                            <h2 className="text-3xl font-bold text-white mb-4 font-heading">Bien reçu !</h2>
                            <p className="text-gray-400">On revient vers vous très vite.</p>
                            <button onClick={() => setIsSuccess(false)} className="mt-8 text-cap-cyan hover:text-white font-bold text-sm uppercase tracking-widest transition-colors">
                                Nouvelle demande
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex items-center gap-3 mb-8">
                                <MessageSquare className="text-cap-cyan w-6 h-6" />
                                <h3 className="text-xl font-bold text-white font-heading">Envoyez un signal</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Identité</label>
                                    <input type="text" name="name" required placeholder="Votre nom" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:bg-white/10 focus:border-cap-blue focus:outline-none transition-all font-sans" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Contact</label>
                                    <input type="email" name="email" required placeholder="Votre email" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:bg-white/10 focus:border-cap-blue focus:outline-none transition-all font-sans" />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Objet</label>
                                <input type="text" name="subject" required placeholder="De quoi s'agit-il ?" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:bg-white/10 focus:border-cap-blue focus:outline-none transition-all font-sans" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-2">Transmission</label>
                                <textarea name="message" rows={4} required placeholder="Votre message..." className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:bg-white/10 focus:border-cap-blue focus:outline-none transition-all resize-none font-sans" />
                            </div>

                            <button type="submit" disabled={isSubmitting} className="group w-full bg-white text-black font-black py-4 rounded-xl shadow-lg hover:bg-cap-cyan hover:text-white transition-all flex items-center justify-center gap-2 uppercase tracking-wide transform hover:scale-[1.02] active:scale-[0.98]">
                                {isSubmitting ? "Transmission..." : <>Envoyer <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
                            </button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
      </div>
    </div>
  );
};

// Composant interne pour les infos (pas besoin d'export default ici)
const ContactItem = ({ icon: Icon, title, value, href }: { icon: any, title: string, value: string, href?: string }) => (
    <div className="flex items-center gap-4 group">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cap-blue group-hover:text-white text-gray-400 transition-all duration-300 border border-white/5">
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">{title}</p>
            {href ? (
                <a href={href} className="text-white font-medium hover:text-cap-cyan transition-colors text-lg font-sans">{value}</a>
            ) : (
                <p className="text-white font-medium text-lg font-sans">{value}</p>
            )}
        </div>
    </div>
);

export default Contact;