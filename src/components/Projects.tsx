import { useState, useRef, useEffect } from "react";
import { 
  motion, 
  useMotionValue, 
  useTransform, 
  useSpring, 
  useMotionValueEvent,
  AnimatePresence
} from "framer-motion";
import { Code, Users, Heart, ArrowRight, MoveRight, Hand } from "lucide-react";
import { Link } from "react-router-dom"; // <-- IMPORT AJOUTÉ

// Replace with your actual image paths
import projectDevcamp from "@/assets/project-devcamp.jpg";
import projectBusiness from "@/assets/project-business.jpg";
import projectCharity from "@/assets/project-charity.jpg";

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
      when: "beforeChildren"
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 1.2, ease: [0.2, 0.65, 0.3, 0.9] }
  }
};

const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

const Projects = () => {
  // --- REFS ---
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDragHint, setShowDragHint] = useState(true);
  
  const [constraints, setConstraints] = useState({ min: 0, max: 0 });
  const [maxScroll, setMaxScroll] = useState(0);

  // --- MOTION VALUES ---
  const x = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 50, damping: 20, mass: 1 });
  const springScroll = useTransform(xSpring, [0, constraints.max], [0, maxScroll]);

  // --- SETUP DIMENSIONS (FIX: ResizeObserver) ---
  useEffect(() => {
    const updateDimensions = () => {
      if (trackRef.current && handleRef.current && containerRef.current) {
        const trackWidth = trackRef.current.clientWidth;
        const handleWidth = handleRef.current.clientWidth;
        const scrollWidth = containerRef.current.scrollWidth;
        const clientWidth = containerRef.current.clientWidth;

        setConstraints({ min: 0, max: trackWidth - handleWidth });
        setMaxScroll(scrollWidth - clientWidth);
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => updateDimensions());
    
    if (trackRef.current) resizeObserver.observe(trackRef.current);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // --- HINT TIMER ---
  useEffect(() => {
    const timer = setTimeout(() => setShowDragHint(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const stopHint = () => setShowDragHint(false);

  // --- SYNC LOGIC (FIX: Prevent Scroll Fighting) ---
  useMotionValueEvent(springScroll, "change", (latest) => {
    if (containerRef.current && isDragging) {
      containerRef.current.scrollLeft = latest;
    }
  });

  const handleNativeScroll = () => {
    if (showDragHint) stopHint();
    if (!isDragging && containerRef.current && maxScroll > 0) {
        const currentScroll = containerRef.current.scrollLeft;
        const newHandleX = (currentScroll / maxScroll) * constraints.max;
        x.set(newHandleX);
    }
  };

  const projects = [
    {
      id: 1,
      title: "DevCamp",
      description: "48h d'immersion totale. Transformez une idée abstraite en prototype fonctionnel.",
      tag: "Hackathon",
      color: "cyan",
      icon: Code,
      gradient: "from-cap-cyan/20 to-cap-blue/20",
      image: projectDevcamp,
    },
    {
      id: 2,
      title: "Business Ch.",
      description: "Gérez une entreprise virtuelle, négociez et dominez le marché.",
      tag: "Stratégie",
      color: "purple",
      icon: Users,
      gradient: "from-purple-500/20 to-pink-500/20",
      image: projectBusiness,
    },
    {
      id: 3,
      title: "Charity Fest",
      description: "Technologie et solidarité. Un événement pour impacter des vies.",
      tag: "Caritatif",
      color: "green",
      icon: Heart,
      gradient: "from-green-500/20 to-emerald-500/20",
      image: projectCharity,
    },
    {
      id: 4,
      title: "Next Gen",
      description: "Le futur de l'innovation commence ici. Rejoignez le mouvement.",
      tag: "Futur",
      color: "cyan",
      icon: Code,
      gradient: "from-blue-500/20 to-indigo-500/20",
      image: projectDevcamp,
    },
  ];

  return (
    <section id="projects" className="py-24 relative overflow-hidden bg-transparent">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cap-blue/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cap-cyan/5 rounded-full blur-[100px]" />
      </div>

      {/* --- MAIN ORCHESTRATOR --- */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-10%" }} 
        className="relative z-10"
      >
        {/* HEADER */}
        <div className="container mx-auto px-4 mb-12 flex flex-col md:flex-row items-end justify-between gap-6">
          <motion.div variants={itemVariants}>
            <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter">
              Projets <span className="text-transparent bg-clip-text bg-gradient-to-r from-cap-blue to-cap-cyan">Récents</span>
            </h2>
            <p className="text-gray-400 mt-2 text-lg">Glissez pour explorer nos réalisations</p>
          </motion.div>
        </div>

        {/* --- CAROUSEL --- */}
        <motion.div 
          ref={containerRef}
          variants={cardContainerVariants}
          onScroll={handleNativeScroll}
          className="flex gap-6 overflow-x-auto pb-12 px-4 md:px-12 hide-scrollbar will-change-scroll" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'auto' }}
        >
          {projects.map((project, index) => (
            <ProjectCard16x9
              key={project.id}
              project={project}
              index={index}
              isHovered={hoveredCard === project.id}
              onHover={() => setHoveredCard(project.id)}
              onLeave={() => setHoveredCard(null)}
            />
          ))}

          {/* View All Card (MODIFIÉ: Utilise Link) */}
          <Link to="/projets">
              <motion.div
                variants={itemVariants}
                className="relative min-w-[200px] md:min-w-[250px] aspect-[9/16] md:aspect-auto h-full rounded-3xl overflow-hidden border border-white/10 group cursor-pointer shrink-0 flex flex-col items-center justify-center gap-6 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="w-20 h-20 rounded-full border-2 border-cap-cyan/30 group-hover:border-cap-cyan flex items-center justify-center transition-colors">
                  <ArrowRight className="w-8 h-8 text-cap-cyan group-hover:translate-x-1 transition-transform" />
                </div>
                <span className="text-white font-bold uppercase tracking-widest vertical-text md:rotate-0">
                  Tout Voir
                </span>
              </motion.div>
          </Link>
        </motion.div>
        
        {/* --- CONTROLS (Hidden on Mobile) --- */}
        <motion.div 
          variants={itemVariants}
          className="container mx-auto px-4 mt-8 hidden md:flex justify-center"
        >
          <div 
              ref={trackRef}
              className="relative w-full max-w-md h-12 flex items-center"
          >
              <div className="absolute w-full h-[1px] bg-white/10 rounded-full overflow-hidden">
                 <motion.div 
                   className="h-full bg-cap-cyan/30"
                   style={{ width: useTransform(xSpring, [0, constraints.max], ["0%", "100%"]) }}
                 />
              </div>
              
              <AnimatePresence>
                {showDragHint && (
                  <motion.div
                    className="absolute left-0 top-[-45px] z-30 pointer-events-none flex flex-col items-center"
                    initial={{ opacity: 0 }}
                    animate={{
                      x: [0, 140], 
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      times: [0, 0.2, 0.8, 1],
                      repeatDelay: 0.5
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                  >
                    <motion.div
                      animate={{ scale: [1, 0.85, 0.85, 1] }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        times: [0, 0.2, 0.8, 1],
                        ease: "easeInOut"
                      }}
                    >
                      <Hand className="w-8 h-8 text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] fill-white/10" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <motion.div 
                  ref={handleRef}
                  style={{ x: xSpring }}
                  drag="x"
                  dragConstraints={trackRef}
                  dragElastic={0.05}
                  dragMomentum={false}
                  onDragStart={() => { setIsDragging(true); stopHint(); }}
                  onDragEnd={() => setIsDragging(false)}
                  onDrag={(e, info) => x.set(x.get() + info.delta.x)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95, cursor: "grabbing" }}
                  animate={{ 
                      boxShadow: [
                          "0 0 0px rgba(6,182,212,0)", 
                          "0 0 15px rgba(6,182,212,0.4)", 
                          "0 0 0px rgba(6,182,212,0)"
                      ] 
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-20 w-12 h-12 bg-cap-dark border border-cap-cyan rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-grab touch-none"
              >
                 <motion.div
                   animate={{ x: [-2, 2, -2] }}
                   transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                 >
                     <MoveRight className="w-5 h-5 text-cap-cyan" />
                 </motion.div>
              </motion.div>
          </div>
        </motion.div>

        {/* --- NEW BUTTON: VOIR TOUS LES PROJETS --- */}
        <motion.div 
            variants={itemVariants}
            className="mt-16 text-center"
        >
            <Link 
                to="/projets"
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-transparent border border-cap-cyan text-cap-cyan font-bold uppercase tracking-widest rounded-full overflow-hidden hover:text-white transition-colors duration-300"
            >
                <span className="absolute inset-0 bg-cap-cyan transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out z-0" />
                <span className="relative z-10 flex items-center gap-2">
                    Voir tous les projets 
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
            </Link>
        </motion.div>

      </motion.div>
    </section>
  );
};

// --- OPTIMIZED 16:9 CARD COMPONENT ---
const ProjectCard16x9 = ({ 
  project, 
  index, 
  isHovered, 
  onHover, 
  onLeave 
}: { 
  project: any; 
  index: number; 
  isHovered: boolean; 
  onHover: () => void; 
  onLeave: () => void;
}) => {
  const Icon = project.icon;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [5, -5]);
  const rotateY = useTransform(x, [-100, 100], [-5, 5]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  return (
    <motion.div
      variants={itemVariants}
      onMouseMove={handleMouseMove}
      onMouseEnter={onHover}
      onMouseLeave={() => { x.set(0); y.set(0); onLeave(); }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="relative min-w-[85vw] md:min-w-[600px] lg:min-w-[700px] aspect-video rounded-[2rem] overflow-hidden border border-white/10 shrink-0 group cursor-pointer perspective-1000 will-change-transform"
    >
      <div className="absolute inset-0 bg-gray-900" />

      <motion.img 
        src={project.image}
        alt={project.title}
        loading="lazy"      
        decoding="async"    
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        style={{ 
            scale: 1.1,
            x: useTransform(x, [-300, 300], [-15, 15]),
            y: useTransform(y, [-300, 300], [-15, 15]),
        }}
      />
      
      <div className="absolute inset-0 bg-cap-dark/40 group-hover:bg-cap-dark/20 transition-colors duration-500 pointer-events-none" />
      <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-60 mix-blend-overlay pointer-events-none`} />
      <div className="absolute inset-0 bg-gradient-to-t from-cap-dark via-cap-dark/50 to-transparent opacity-90 pointer-events-none" />

      <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end pointer-events-none" style={{ transform: "translateZ(30px)" }}>
        <div className="absolute top-8 right-8 md:top-12 md:right-12">
            <motion.div 
                animate={{ rotate: isHovered ? 360 : 0 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center"
            >
                <Icon className="w-8 h-8 text-white" />
            </motion.div>
        </div>

        <div className="max-w-2xl transform transition-transform duration-500 group-hover:-translate-y-4">
            <div className="flex items-center gap-4 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border bg-black/50 backdrop-blur-sm ${
                    project.color === "cyan" ? "border-cap-cyan text-cap-cyan" :
                    project.color === "purple" ? "border-purple-500 text-purple-400" :
                    "border-green-500 text-green-400"
                }`}>
                    {project.tag}
                </span>
                <div className="h-[1px] w-12 bg-white/30" />
            </div>

            <h3 className="text-4xl md:text-5xl font-black text-white uppercase mb-4 drop-shadow-2xl">
                {project.title}
            </h3>

            <p className="text-lg text-gray-300 line-clamp-2 md:line-clamp-none group-hover:text-white transition-colors">
                {project.description}
            </p>
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
            className="absolute bottom-12 right-12 hidden md:flex items-center gap-3 text-cap-cyan font-bold uppercase tracking-widest"
        >
            <span>Explorer le projet</span>
            <ArrowRight className="w-5 h-5" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Projects;