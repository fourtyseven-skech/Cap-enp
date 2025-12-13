import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users, Network, Zap, ChevronRight, Target, Briefcase } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";

// --- DONNÉES ---
const structureData = [
  { id: "pres", level: 1, code: "P", title: "Président(e)", category: "Executive", desc: "Porte la vision globale. Représente le club auprès de l'administration et des partenaires stratégiques.", color: "from-blue-600 to-cyan-500", icon: User },
  { id: "vp", level: 2, code: "VP", title: "Vice-Président(e)", category: "Executive", desc: "Coordonne le bureau interne. Assure le suivi opérationnel et remplace le président en cas d'absence.", color: "from-purple-600 to-pink-500", icon: User },
  { id: "rp", level: 3, code: "RP", title: "Resp. Projets", category: "Manager", desc: "Transforme les idées en réalité. Supervise le cycle de vie de chaque événement, du concept au jour J.", color: "from-green-600 to-emerald-500", icon: Zap },
  { id: "rs", level: 3, code: "RS", title: "Resp. Sections", category: "Manager", desc: "Fédère les talents. Assure la cohésion entre les pôles scientifiques, culturels et caritatifs.", color: "from-orange-600 to-red-500", icon: Network },
  { id: "lrh", level: 4, code: "RH", title: "Logistique & RH", category: "Département", desc: "Le moteur humain. Recrutement, intégration des membres et gestion du matériel.", color: "from-teal-600 to-cyan-500", icon: Users },
  { id: "it", level: 4, code: "IT", title: "Info & Tech", category: "Département", desc: "L'ingénierie digitale. Création du site, outils internes et innovation technique.", color: "from-indigo-600 to-blue-500", icon: Users },
  { id: "comm", level: 4, code: "COM", title: "Communication", category: "Département", desc: "La voix du CAP. Stratégie réseaux sociaux, création de contenu et branding.", color: "from-pink-600 to-rose-500", icon: Users },
  { id: "re", level: 4, code: "RE", title: "Relations Ext.", category: "Département", desc: "Le pont vers l'extérieur. Sponsoring, partenariats entreprises et budget.", color: "from-yellow-600 to-amber-500", icon: Users },
];

const Structure = () => {
  const [selectedRole, setSelectedRole] = useState(structureData[0]);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-transparent">
      <ParticleBackground />
      <div className="texture-overlay" />

      {/* Conteneur Large pour plus d'espace */}
      <div className="relative z-10 container mx-auto px-4 py-24 flex-grow flex flex-col max-w-7xl">
        
        {/* --- HEADER --- */}
        <div className="text-center mb-20">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <h1 className="text-4xl md:text-6xl font-black uppercase text-white font-heading mb-4 tracking-tight">
                    L'Architecture <span className="text-transparent bg-clip-text bg-gradient-to-r from-cap-blue to-cap-cyan">CAP</span>
                </h1>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto font-sans">
                    Une organisation conçue pour l'innovation. Cliquez sur un pôle pour explorer son fonctionnement.
                </p>
            </motion.div>
        </div>

        <div className="flex flex-col-reverse xl:flex-row gap-16 items-start">
            
            {/* --- ZONE ARBRE (Agrandi) --- */}
            <div className="w-full xl:w-3/4 relative flex flex-col items-center">
                
                {/* Ligne Troncale Lumineuse */}
                <div className="absolute top-0 bottom-24 left-1/2 w-0.5 bg-gradient-to-b from-cap-blue via-cap-cyan to-transparent -translate-x-1/2 opacity-20 hidden lg:block" />

                {/* NIVEAU 1 : PRÉSIDENCE */}
                <div className="relative z-10 mb-12">
                    <OrgNode role={structureData.find(r => r.id === 'pres')!} current={selectedRole} onClick={setSelectedRole} size="large" />
                </div>

                {/* NIVEAU 2 : VP */}
                <div className="relative z-10 mb-16">
                    <div className="h-12 w-0.5 bg-gradient-to-b from-white/10 to-white/30 mx-auto mb-4 lg:hidden" />
                    <OrgNode role={structureData.find(r => r.id === 'vp')!} current={selectedRole} onClick={setSelectedRole} size="medium" />
                </div>

                {/* NIVEAU 3 : MANAGERS (Split) */}
                {/* Connecteurs Néons */}
                <div className="relative w-2/3 h-10 border-t-2 border-x-2 border-white/10 rounded-t-3xl mb-4 hidden lg:block">
                     <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 border-2 border-cap-cyan rounded-full z-20 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                </div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-32 w-full max-w-4xl mb-16 px-4">
                    <div className="flex justify-center"><OrgNode role={structureData.find(r => r.id === 'rp')!} current={selectedRole} onClick={setSelectedRole} size="medium" /></div>
                    <div className="flex justify-center"><OrgNode role={structureData.find(r => r.id === 'rs')!} current={selectedRole} onClick={setSelectedRole} size="medium" /></div>
                </div>

                {/* NIVEAU 4 : DÉPARTEMENTS */}
                <div className="relative w-full border-t border-white/10 mb-8 hidden lg:block">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 bg-[#0a0a0a] text-xs text-gray-500 uppercase tracking-widest font-bold">
                        Pôles Opérationnels
                    </div>
                </div>
                
                <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {structureData.filter(r => r.level === 4).map((role) => (
                        <div key={role.id} className="flex justify-center">
                            <OrgNode role={role} current={selectedRole} onClick={setSelectedRole} size="small" />
                        </div>
                    ))}
                </div>
            </div>

            {/* --- ZONE DÉTAIL (HUD Style) --- */}
            <div className="w-full xl:w-1/4 xl:sticky xl:top-32">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedRole.id}
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        transition={{ duration: 0.4, type: "spring" }}
                        className="bg-gray-900/80 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden group"
                    >
                        {/* Barre latérale colorée */}
                        <div className={`absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b ${selectedRole.color}`} />
                        
                        {/* Glow Effect */}
                        <div className={`absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br ${selectedRole.color} opacity-20 rounded-full blur-[80px] pointer-events-none group-hover:opacity-30 transition-opacity duration-500`} />

                        <div className="relative z-10">
                            {/* Header Card */}
                            <div className="flex items-start justify-between mb-8">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedRole.color} flex items-center justify-center shadow-lg text-white`}>
                                    <selectedRole.icon className="w-8 h-8" />
                                </div>
                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Niveau {selectedRole.level}
                                </span>
                            </div>

                            <h2 className="text-3xl font-black text-white font-heading uppercase leading-none mb-2">
                                {selectedRole.title}
                            </h2>
                            <p className="text-cap-cyan font-bold text-sm mb-6 uppercase tracking-wider flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> {selectedRole.category}
                            </p>

                            <div className="h-px w-full bg-white/10 mb-6" />

                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Target className="w-4 h-4" /> Mission Principale
                                </h3>
                                <p className="text-gray-300 text-lg leading-relaxed font-sans">
                                    {selectedRole.desc}
                                </p>
                            </div>

                            <button className="w-full py-4 rounded-xl bg-white/5 hover:bg-gradient-to-r hover:from-cap-blue hover:to-cap-cyan hover:text-white border border-white/10 text-gray-300 font-bold transition-all duration-300 flex items-center justify-center gap-2 group">
                                En savoir plus <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

        </div>
      </div>
    </div>
  );
};

// --- COMPOSANT DE NOEUD OPTIMISÉ ---
const OrgNode = ({ role, current, onClick, size }: { role: any, current: any, onClick: any, size: 'small' | 'medium' | 'large' }) => {
    const isSelected = current.id === role.id;
    
    // Tailles dynamiques
    const widthClass = size === 'large' ? 'w-72 md:w-80' : size === 'medium' ? 'w-56 md:w-64' : 'w-full md:w-48';
    const heightClass = size === 'large' ? 'h-32' : size === 'medium' ? 'h-24' : 'h-28 md:h-20'; // Plus haut sur mobile pour small

    return (
        <motion.button
            onClick={() => onClick(role)}
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className={`relative group z-20 outline-none ${widthClass}`}
        >
            {/* Anneau de sélection animé (Style Néon) */}
            {isSelected && (
                <motion.div 
                    layoutId="neon-ring"
                    className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cap-blue to-cap-cyan opacity-100 blur-[2px] shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            <div className={`
                relative flex items-center gap-4 p-4 rounded-xl border backdrop-blur-xl transition-all duration-500 w-full h-full overflow-hidden
                ${isSelected 
                    ? 'bg-gray-900 border-white/50' 
                    : 'bg-black/60 border-white/10 hover:border-cap-cyan/50 hover:bg-gray-900/80'
                }
                ${size === 'small' ? 'flex-col justify-center text-center p-3' : 'flex-row text-left'}
            `}>
                {/* Icône Code */}
                <div className={`
                    shrink-0 rounded-xl flex items-center justify-center font-bold text-white shadow-inner
                    bg-gradient-to-br ${role.color}
                    ${size === 'small' ? 'w-10 h-10 text-sm mb-2' : size === 'large' ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-lg'}
                `}>
                    {role.code}
                </div>
                
                {/* Textes */}
                <div className="min-w-0 flex flex-col justify-center">
                    <p className={`text-white font-black font-heading uppercase leading-none mb-1 ${size === 'large' ? 'text-xl' : size === 'medium' ? 'text-base' : 'text-xs'}`}>
                        {role.title}
                    </p>
                    {size !== 'small' && (
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider truncate">{role.category}</p>
                    )}
                </div>

                {/* Petit indicateur visuel (Arrow) pour Large/Medium */}
                {size !== 'small' && (
                    <div className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-white ${isSelected ? 'opacity-100 text-cap-cyan' : ''}`}>
                         <ChevronRight className="w-5 h-5" />
                    </div>
                )}
            </div>

            {/* Connecteurs CSS (Points d'ancrage) */}
            <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-800 border border-white/20 ${isSelected ? 'bg-cap-cyan border-white' : ''} ${size === 'small' ? 'hidden' : ''}`} />
            {role.level !== 1 && (
                 <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-800 border border-white/20 ${isSelected ? 'bg-cap-cyan border-white' : ''}`} />
            )}
        </motion.button>
    );
}

export default Structure;