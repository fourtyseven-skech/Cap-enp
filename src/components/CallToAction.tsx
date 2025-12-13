import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Handshake, ArrowRight } from "lucide-react";

const CallToAction = () => {
  return (
    <section className="py-20 container mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-8">

        {/* --- CARTE GAUCHE : STRUCTURE --- */}
        <Link to="/structure" className="block h-full">
            <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 p-10 flex flex-col justify-between hover:border-cap-blue/50 transition-all duration-500 shadow-2xl"
            >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cap-blue/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-cap-blue/20 transition-all duration-500" />

                <div>
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-cap-blue text-white transition-colors duration-300">
                        <Users className="w-8 h-8" />
                    </div>
                    
                    <h3 className="text-3xl font-black text-white mb-4 font-heading uppercase">
                        Curieux d'en savoir <span className="text-cap-blue">plus ?</span>
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed group-hover:text-gray-300 transition-colors">
                        Découvrez comment le CAP est structuré, nos départements et l'équipe qui fait tourner la machine.
                    </p>
                </div>

                <div className="mt-8 flex items-center gap-3 text-cap-blue font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                    Voir la structure <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </div>
            </motion.div>
        </Link>

        {/* --- CARTE DROITE : CONTACT --- */}
        <Link to="/contact" className="block h-full">
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 p-10 flex flex-col justify-between hover:border-cap-cyan/50 transition-all duration-500 shadow-2xl"
            >
                {/* Background Glow */}
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cap-cyan/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 group-hover:bg-cap-cyan/20 transition-all duration-500" />

                <div>
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-cap-cyan text-white transition-colors duration-300">
                        <Handshake className="w-8 h-8" />
                    </div>
                    
                    <h3 className="text-3xl font-black text-white mb-4 font-heading uppercase">
                        Envie de <span className="text-cap-cyan">Collaborer ?</span>
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed group-hover:text-gray-300 transition-colors">
                        Une idée de projet ? Besoin d'aide ou d'un partenariat ? N'hésitez pas à nous contacter dès maintenant.
                    </p>
                </div>

                <div className="mt-8 flex items-center gap-3 text-cap-cyan font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                    Nous contacter <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </div>
            </motion.div>
        </Link>

      </div>
    </section>
  );
};

export default CallToAction;