import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { Zap, Users, Award, MessageCircle } from "lucide-react";
import valueInnovation from "@/assets/value-innovation.jpg";
import valueCollaboration from "@/assets/value-collaboration.jpg";
import valueExcellence from "@/assets/value-excellence.jpg";
import valueSharing from "@/assets/value-sharing.jpg";

const ValuesDecayStyled = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleImage, setVisibleImage] = useState(valueInnovation);
  const cardRef = useRef(null);
  
  // --- Animation Hooks ---
  const displacementScale = useMotionValue(0);
  
  // Mouse position (0.5 = center, 0 = left/top, 1 = right/bottom)
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  
  // Create rotation based on percentage of mouse position
  const rotateX = useTransform(mouseY, [0, 1], [7, -7]); // Tilt Up/Down
  const rotateY = useTransform(mouseX, [0, 1], [-7, 7]); // Tilt Left/Right
  
  // Shine effect moving opposite to mouse
  const shineOpacity = useTransform(mouseY, [0, 1], [0, 0.4]);
  const shineX = useTransform(mouseX, [0, 1], ["100%", "0%"]);

  const values = [
    {
      id: 1,
      number: "01",
      title: "Innovation",
      description: "Transformer les idées abstraites en solutions concrètes grâce à la technologie.",
      icon: Zap,
      image: valueInnovation,
    },
    {
      id: 2,
      number: "02",
      title: "Collaboration",
      description: "L'intelligence collective est notre moteur. Ensemble, nous allons plus loin.",
      icon: Users,
      image: valueCollaboration,
    },
    {
      id: 3,
      number: "03",
      title: "Excellence",
      description: "Viser la perfection technique et la rigueur dans chaque ligne de code.",
      icon: Award,
      image: valueExcellence,
    },
    {
      id: 4,
      number: "04",
      title: "Partage",
      description: "Transmettre le savoir est la clé. Ateliers, formations et open-source.",
      icon: MessageCircle,
      image: valueSharing,
    },
  ];

  const changeIndex = async (newIndex) => {
    if (newIndex === activeIndex) return;
    await animate(displacementScale, 200, { duration: 0.3, ease: "easeIn" });
    setActiveIndex(newIndex);
    setVisibleImage(values[newIndex].image);
    await animate(displacementScale, 0, { duration: 0.5, ease: "easeOut" });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % values.length;
      changeIndex(nextIndex);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeIndex]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;

    mouseX.set(xPct);
    mouseY.set(yPct);
  };

  const handleMouseLeave = () => {
    animate(mouseX, 0.5, { duration: 0.5 });
    animate(mouseY, 0.5, { duration: 0.5 });
  };

  // --- FILTER LOGIC ---
  const getFilterStyle = (index) => {
    const baseDecay = "url(#decayFilter)";
    
    // SECOND IMAGE (Index 1): NO extra filter, pure image
    if (index === 1) {
      return baseDecay;
    }

    // OTHERS: Higher Contrast & Saturation
    // contrast 1.25 = +25% contrast
    return `${baseDecay} contrast(1.1) saturate(1.2)`;
  };

  return (
    <section id="values" className="py-24 relative overflow-hidden bg-transparent perspective-1000">
      <div className="container mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-black text-white uppercase tracking-wider text-center mb-16"
        >
          Nos <span className="text-cap-blue">Valeurs</span>
        </motion.h2>

        <div className="flex flex-col md:flex-row-reverse gap-8 items-center justify-center">
          
          {/* --- Navigation Panel --- */}
          <div className="w-full md:w-auto">
            <ul className="flex flex-row md:flex-col gap-4">
              {values.map((value, index) => (
                <motion.li
                  key={value.id}
                  onClick={() => changeIndex(index)}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative flex items-center gap-4 p-4 md:p-6 cursor-pointer border-b border-white/10 transition-all ${
                    activeIndex === index ? "opacity-100" : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <span
                    className={`text-3xl md:text-4xl font-black transition-all ${
                      activeIndex === index
                        ? "text-cap-cyan"
                        : "text-transparent"
                    }`}
                    style={{
                      WebkitTextStroke: activeIndex === index ? "0" : "1px #ffffff",
                    }}
                  >
                    {value.number}
                  </span>
                  
                  <span className="text-white text-lg md:text-xl font-bold hidden md:block">
                    {value.title}
                  </span>

                  {activeIndex === index && (
                    <motion.div
                      key={`progress-${index}`} 
                      className="absolute bottom-0 left-0 h-0.5 bg-cap-cyan"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 5, ease: "linear" }} 
                    />
                  )}
                </motion.li>
              ))}
            </ul>
          </div>

          {/* --- Interactive Image Card Panel --- */}
          <div 
            ref={cardRef}
            className="w-full md:w-[600px] h-[400px] md:h-[500px] relative perspective-1000"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <motion.div 
              className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-card relative z-0"
              style={{ 
                rotateX, 
                rotateY,
                transformStyle: "preserve-3d" 
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.8 }}
            >
              
              {/* SVG Filters */}
              <svg className="absolute w-0 h-0 pointer-events-none">
                <defs>
                  <filter id="decayFilter">
                    <feTurbulence 
                      type="turbulence" 
                      baseFrequency="0.015" 
                      numOctaves="5" 
                      seed="4" 
                      stitchTiles="stitch" 
                      result="turbulence"
                    />
                    <motion.feDisplacementMap 
                      in="SourceGraphic" 
                      in2="turbulence" 
                      scale={displacementScale} 
                      xChannelSelector="R" 
                      yChannelSelector="B" 
                    />
                  </filter>
                </defs>
              </svg>

              {/* SVG Image Container */}
              <motion.div className="absolute inset-0 w-full h-full">
                <svg width="100%" height="100%" className="w-full h-full">
                  <image
                    href={visibleImage}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid slice"
                    // Dynamic Filter Application
                    style={{ 
                      filter: getFilterStyle(activeIndex),
                      transition: 'filter 0.5s ease' 
                    }}
                  />
                </svg>
              </motion.div>

              {/* Shine/Glare Effect */}
              <motion.div 
                className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/10 to-transparent"
                style={{ opacity: shineOpacity, x: shineX }}
              />

              {/* Vignette Overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.5)_100%)] pointer-events-none z-10" />
              
              {/* Bottom Gradient for Text */}
              <div className="absolute inset-0 bg-gradient-to-t from-cap-dark via-cap-dark/70 to-transparent pointer-events-none z-10" />

              {/* Text Content */}
              <motion.div
                key={activeIndex} 
                initial={{ y: 20, opacity: 0, z: 30 }} 
                animate={{ y: 0, opacity: 1, z: 60 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative h-full p-8 md:p-12 flex flex-col justify-end z-20"
                style={{ transform: "translateZ(60px)" }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-6 shadow-lg">
                  {(() => {
                    const Icon = values[activeIndex].icon;
                    return <Icon className="w-8 h-8 text-cap-cyan" />;
                  })()}
                </div>

                <h3 className="text-3xl md:text-4xl font-black text-white mb-4 drop-shadow-lg">
                  {values[activeIndex].title}
                </h3>

                <p className="text-gray-200 text-base md:text-lg leading-relaxed drop-shadow-md">
                  {values[activeIndex].description}
                </p>
              </motion.div>

            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ValuesDecayStyled;