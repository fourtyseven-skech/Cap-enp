import { motion } from "framer-motion";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Instagram, 
  Linkedin, 
  ArrowRight,
  ExternalLink 
} from "lucide-react";

// --- AJOUTER L'IMPORT DE VOTRE LOGO ICI ---
// Assurez-vous que le chemin est correct selon votre structure de dossiers
import logoCap from "../assets/logo.png"; 

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

const quickLinks = [
  { name: "Accueil", href: "#hero" },
  { name: "À propos", href: "#about" },
  { name: "Événements", href: "#events" },
  { name: "Galerie", href: "#gallery" },
];

const Footer = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <footer id="footer" className="relative border-t border-white/10 pt-20 pb-10 overflow-hidden">
      {/* Pattern de fond */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '24px 24px' 
          }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-16"
        >
          {/* Colonne 1: Logo & À propos */}
          <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
            <a href="#" className="inline-block group">
              {/* --- LOGO ICI --- */}
              {/* h-16 définit la hauteur (environ 64px), w-auto garde les proportions */}
              <img 
                src={logoCap} 
                alt="Logo CAP Club" 
                className="h-14 md:h-16 w-auto object-contain brightness-200 group-hover:brightness-100 transition-all duration-300 drop-shadow-[0_0_15px_rgba(0,200,255,0.3)]"
              />
            </a>
            <p className="text-gray-400 leading-relaxed text-sm md:text-base pr-4">
              Depuis 2010, le Club d'Activité Polyvalente rassemble les esprits créatifs de
              l'École Nationale Polytechnique. Innovation, leadership et travail d'équipe.
            </p>
            
            <div className="flex gap-4 pt-2">
              {socialLinks.map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-cap-blue hover:text-white transition-all duration-300 hover:scale-110"
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Colonne 2: Liens Rapides */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-6 border-l-2 border-cap-cyan pl-3">
              Liens Rapides
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href} 
                    className="text-gray-400 hover:text-cap-cyan transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-[1px] bg-cap-cyan transition-all duration-300"></span>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Colonne 3: Contact */}
          <motion.div variants={itemVariants} className="lg:col-span-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-6 border-l-2 border-cap-blue pl-3">
              Contact
            </h3>
            <div className="space-y-4">
              <a href="tel:+213555123456" className="flex items-start gap-3 text-gray-400 hover:text-white transition-colors group">
                <Phone className="w-5 h-5 text-cap-cyan flex-shrink-0 group-hover:rotate-12 transition-transform" />
                <span className="text-sm">+213 555 123 456</span>
              </a>
              <a href="mailto:cap@enp.edu.dz" className="flex items-start gap-3 text-gray-400 hover:text-white transition-colors group">
                <Mail className="w-5 h-5 text-cap-cyan flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-sm">cap@enp.edu.dz</span>
              </a>
              <div className="flex items-start gap-3 text-gray-400">
                <MapPin className="w-5 h-5 text-cap-cyan flex-shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-white">ENP, El Harrach</p>
                  <a href="#" className="text-xs text-cap-blue hover:text-cap-cyan flex items-center gap-1 mt-1 transition-colors">
                    Voir carte <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Colonne 4: CTA */}
          <motion.div variants={itemVariants} className="lg:col-span-3">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-2">
                Rejoignez-nous
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Prêt à innover ? Devenez membre du CAP dès aujourd'hui.
              </p>
              <a
                href="#join"
                className="group w-full bg-gradient-to-r from-cap-blue to-cap-cyan text-white font-bold px-6 py-4 rounded-xl text-sm uppercase tracking-wide hover:shadow-[0_0_20px_rgba(0,200,255,0.3)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                Adhérer
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer Bottom */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm"
        >
          <p className="text-gray-600">
            &copy; {new Date().getFullYear()} CAP Club. Tous droits réservés.
          </p>
          <div className="flex gap-6 text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">Confidentialité</a>
          </div>
        </motion.div>
      </div>
      
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cap-blue/20 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cap-cyan/10 rounded-full blur-[80px] pointer-events-none translate-y-1/3" />
    </footer>
  );
};

export default Footer;