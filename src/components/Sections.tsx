import { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { Beaker, Palette, HeartHandshake, ArrowRight } from "lucide-react";
import sectionScientific from "@/assets/section-scientific.jpg";
import sectionCultural from "@/assets/section-cultural.jpg";
import sectionCharity from "@/assets/section-charity.jpg";

const Sections = () => {
  const sections = [
    {
      id: 1,
      title: "Scientifique",
      short: "R&D",
      description: "Compétitions, prototypage et innovation technique.",
      icon: Beaker,
      image: sectionScientific,
      color: "from-cyan-500 to-blue-500",
      border: "group-hover:border-cyan-500/50",
      shadow: "group-hover:shadow-cyan-500/20",
    },
    {
      id: 2,
      title: "Culturelle",
      short: "Art",
      description: "Débats, soft-skills et ouverture d'esprit.",
      icon: Palette,
      image: sectionCultural,
      color: "from-purple-500 to-pink-500",
      border: "group-hover:border-purple-500/50",
      shadow: "group-hover:shadow-purple-500/20",
    },
    {
      id: 3,
      title: "Caritative",
      short: "Social",
      description: "Solidarité, collectes et impact humain direct.",
      icon: HeartHandshake,
      image: sectionCharity,
      color: "from-emerald-500 to-green-500",
      border: "group-hover:border-emerald-500/50",
      shadow: "group-hover:shadow-emerald-500/20",
    },
  ];

  return (
    <section id="sections" className="py-24 bg-transparent">
      {/* Subtle Background Noise/Grain if desired */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mb-16 md:text-center max-w-3xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter"
          >
            Nos <span className="text-transparent bg-clip-text bg-gradient-to-r from-cap-blue to-cap-cyan">Pôles</span>
          </motion.h2>
          <p className="text-gray-400 mt-4 text-lg">
            Trois piliers, une vision. Explorez nos domaines d'action.
          </p>
        </div>

        {/* BENTO GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {sections.map((section, index) => (
            <SpotlightCard key={section.id} section={section} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

// --- THE MAGIC CARD COMPONENT ---
const SpotlightCard = ({ section, index }: { section: any, index: number }) => {
  const Icon = section.icon;
  const ref = useRef<HTMLDivElement>(null);

  // Mouse tracking logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth out the mouse movement
  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    x.set(clientX - left);
    y.set(clientY - top);
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      className={`group relative h-[450px] rounded-[2rem] bg-gray-900/40 border border-white/10 overflow-hidden cursor-pointer transition-all duration-500 ${section.border} hover:shadow-2xl ${section.shadow}`}
    >
      
      {/* 1. THE SPOTLIGHT EFFECT (Radial Gradient follows mouse) */}
      <motion.div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-10"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.1),
              transparent 80%
            )
          `,
        }}
      />

      {/* 2. BACKGROUND IMAGE (Black & White -> Color on Hover) */}
      <div className="absolute inset-0">
        <img 
            src={section.image} 
            alt={section.title}
            className="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0 scale-100 group-hover:scale-110 opacity-50 group-hover:opacity-100"
            loading="lazy"
        />
        {/* Dark Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-80" />
      </div>

      {/* 3. CONTENT */}
      <div className="absolute inset-0 p-8 flex flex-col justify-end z-20">
        
        {/* Icon Floating Top Right */}
        <div className="absolute top-8 right-8 w-14 h-14 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center group-hover:bg-white/10 transition-colors">
            <Icon className="text-white w-6 h-6" />
        </div>

        {/* Text Content */}
        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div className={`w-fit px-3 py-1 mb-4 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r ${section.color} text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100`}>
                {section.short}
            </div>

            <h3 className="text-4xl font-black text-white uppercase mb-2">
                {section.title}
            </h3>
            
            <p className="text-gray-400 group-hover:text-gray-200 transition-colors duration-300 mb-6 line-clamp-2 group-hover:line-clamp-none">
                {section.description}
            </p>

            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 delay-200">
                Découvrir <ArrowRight className="w-4 h-4" />
            </div>
        </div>
      </div>

    </motion.div>
  );
};

export default Sections;