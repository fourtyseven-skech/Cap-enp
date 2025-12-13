import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Calendar, Users, Trophy, Hash, Filter, ArrowRight } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";

// --- DONNÉES (Riches) ---
const projects = [
  {
    id: "devcamp",
    title: "DevCamp",
    category: "Hackathon",
    date: "Mars 2024",
    tagline: "48h pour coder le futur.",
    desc: "Le plus grand hackathon de l'école. 20 équipes s'affrontent pour résoudre des problématiques réelles proposées par des startups partenaires. Une ambiance électrique, des nuits blanches et de l'innovation pure.",
    stats: { participants: "150+", duration: "48h", partners: "5" },
    image: "/assets/images/devcamp.webp", // Assurez-vous d'avoir ces images ou remplacez par des placeholders
    color: "from-blue-600 to-cyan-500",
    tags: ["Web", "Mobile", "Pitch"]
  },
  {
    id: "business-ch",
    title: "Business Challenge",
    category: "Compétition",
    date: "Janvier 2024",
    tagline: "L'art de la stratégie.",
    desc: "Une simulation d'entreprise grandeur nature. Les participants doivent redresser une entreprise virtuelle en difficulté, gérer le marketing, la finance et les RH face à un jury d'experts intraitables.",
    stats: { participants: "80", duration: "1 Jour", partners: "3" },
    image: "/assets/images/business.webp",
    color: "from-purple-600 to-pink-500",
    tags: ["Finance", "Management", "Strategy"]
  },
  {
    id: "charity",
    title: "Charity Festival",
    category: "Caritatif",
    date: "Décembre 2023",
    tagline: "Ingénierie du coeur.",
    desc: "Un festival solidaire dont 100% des bénéfices sont reversés à des associations orphelines. Concerts, ventes aux enchères et stands de jeux pour la bonne cause.",
    stats: { participants: "500+", duration: "Soirée", partners: "10" },
    image: "/assets/images/hero-background1.webp",
    color: "from-green-600 to-emerald-500",
    tags: ["Solidarité", "Event", "Impact"]
  },
  {
    id: "polyftour",
    title: "Polyftour",
    category: "Culturel",
    date: "Avril 2024",
    tagline: "L'esprit de famille.",
    desc: "L'Iftar géant qui réunit toutes les générations de l'école. Étudiants, profs et anciens élèves partagent un repas dans une ambiance traditionnelle et chaleureuse.",
    stats: { participants: "300+", duration: "Soirée", partners: "N/A" },
    image: "/assets/images/hero-background8.webp",
    color: "from-orange-600 to-red-500",
    tags: ["Tradition", "Ramadan", "Food"]
  },
  // Ajoutez d'autres projets ici pour tester la grille
];

const allCategories = ["Tous", ...new Set(projects.map(p => p.category))];

const Projets = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("Tous");

  // Filtrage
  const filteredProjects = activeFilter === "Tous" 
    ? projects 
    : projects.filter(p => p.category === activeFilter);

  // Bloquer le scroll quand un projet est ouvert
  useEffect(() => {
    if (selectedId) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
  }, [selectedId]);

  return (
    <div className="relative min-h-screen bg-transparent">
      <ParticleBackground />
      <div className="texture-overlay" />

      <div className="relative z-10 container mx-auto px-4 py-24 min-h-screen flex flex-col">
        
        {/* --- HEADER --- */}
        <div className="text-center mb-16 space-y-4">
            <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-black uppercase text-white font-heading tracking-tight"
            >
                Nos <span className="text-transparent bg-clip-text bg-gradient-to-r from-cap-blue to-cap-cyan">Réalisations</span>
            </motion.h1>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">
                Explorez l'univers du CAP. Cliquez sur une carte pour plonger dans les détails.
            </p>
        </div>

        {/* --- FILTRES --- */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
            {allCategories.map((cat) => (
                <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className={`px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider border transition-all duration-300 ${
                        activeFilter === cat 
                        ? "bg-cap-cyan text-black border-cap-cyan shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                        : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30 hover:text-white"
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>

        {/* --- GRILLE BENTO (MASONRY) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[350px]">
            <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                    <ProjectCard 
                        key={project.id} 
                        project={project} 
                        onClick={() => setSelectedId(project.id)} 
                    />
                ))}
            </AnimatePresence>
        </div>

        {/* --- MODALE EXPANSIVE (L'EFFET WOW) --- */}
        <AnimatePresence>
            {selectedId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
                    {/* Backdrop Flou */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedId(null)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    
                    {/* La Carte Agrandie */}
                    <motion.div 
                        layoutId={selectedId} // La magie opère ici (liaison avec la petite carte)
                        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0F1115] border border-white/10 rounded-3xl overflow-y-auto overflow-x-hidden shadow-2xl custom-scrollbar"
                    >
                        {/* Bouton Fermer */}
                        <button 
                            onClick={() => setSelectedId(null)}
                            className="absolute top-4 right-4 z-20 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition-colors border border-white/10"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="grid md:grid-cols-2 min-h-full">
                            
                            {/* Colonne Image (Gauche) */}
                            <div className="relative h-64 md:h-auto overflow-hidden">
                                <motion.img 
                                    layoutId={`img-${selectedId}`}
                                    src={projects.find(p => p.id === selectedId)?.image} 
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1115] via-transparent to-transparent md:bg-gradient-to-r" />
                            </div>

                            {/* Colonne Contenu (Droite) */}
                            <div className="p-8 md:p-10 flex flex-col h-full">
                                <div className="mb-auto">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest bg-white/5 text-cap-cyan border border-cap-cyan/20`}>
                                            {projects.find(p => p.id === selectedId)?.category}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                                            <Calendar className="w-3 h-3" /> {projects.find(p => p.id === selectedId)?.date}
                                        </span>
                                    </div>

                                    <motion.h2 
                                        layoutId={`title-${selectedId}`}
                                        className="text-4xl md:text-5xl font-black text-white uppercase font-heading mb-4 leading-none"
                                    >
                                        {projects.find(p => p.id === selectedId)?.title}
                                    </motion.h2>

                                    <p className="text-lg text-gray-300 leading-relaxed font-sans mb-8">
                                        {projects.find(p => p.id === selectedId)?.desc}
                                    </p>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-4 mb-8">
                                        <StatBox icon={Users} label="Participants" value={projects.find(p => p.id === selectedId)?.stats.participants} />
                                        <StatBox icon={Calendar} label="Durée" value={projects.find(p => p.id === selectedId)?.stats.duration} />
                                        <StatBox icon={Trophy} label="Partenaires" value={projects.find(p => p.id === selectedId)?.stats.partners} />
                                    </div>
                                    
                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {projects.find(p => p.id === selectedId)?.tags.map((tag:string) => (
                                            <span key={tag} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white/5 px-2 py-1 rounded">
                                                <Hash className="w-3 h-3" /> {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <button className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest rounded-xl hover:bg-cap-cyan hover:text-white transition-all flex items-center justify-center gap-2 group">
                                    Voir la galerie photo <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

      </div>
    </div>
  );
};

// --- COMPOSANT CARTE (PETITE VUE) ---
const ProjectCard = ({ project, onClick }: { project: any, onClick: () => void }) => {
    return (
        <motion.div
            layoutId={project.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -5, scale: 1.02 }}
            onClick={onClick}
            className="relative group cursor-pointer rounded-3xl overflow-hidden border border-white/10 bg-gray-900 shadow-xl"
        >
            {/* Image de fond avec Parallax simulé par scale */}
            <div className="absolute inset-0 overflow-hidden">
                <motion.img 
                    layoutId={`img-${project.id}`}
                    src={project.image} 
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors duration-500" />
                <div className={`absolute inset-0 bg-gradient-to-t ${project.color} opacity-20 mix-blend-overlay`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
            </div>

            {/* Contenu Overlay */}
            <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className="mb-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 border bg-black/50 backdrop-blur-sm border-white/20 text-white`}>
                        {project.category}
                    </span>
                </div>
                <motion.h3 
                    layoutId={`title-${project.id}`}
                    className="text-3xl font-black text-white uppercase font-heading leading-none mb-1"
                >
                    {project.title}
                </motion.h3>
                <p className="text-gray-300 text-sm line-clamp-2 group-hover:text-white transition-colors">
                    {project.tagline}
                </p>
                
                {/* Indicateur d'interaction */}
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <ExternalLink className="w-5 h-5 text-white" />
                </div>
            </div>
        </motion.div>
    );
};

// --- COMPOSANT STATS (POUR LA MODALE) ---
const StatBox = ({ icon: Icon, label, value }: any) => (
    <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
        <Icon className="w-5 h-5 text-cap-cyan mx-auto mb-1" />
        <div className="text-lg font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
);

export default Projets;