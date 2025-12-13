import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import hero1 from "@/assets/hero1.jpg";
import hero2 from "@/assets/hero2.jpg";
import hero3 from "@/assets/hero3.jpg";

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [hero1, hero2, hero3];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <section id="hero" className="relative h-screen w-full overflow-hidden">
      {/* Background Slideshow */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          <img
            src={slides[currentSlide]}
            alt={`Hero ${currentSlide + 1}`}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-cap-dark/80 via-cap-dark/40 to-transparent z-10" />

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col justify-center items-center text-center text-white p-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight mb-2">
            <span className="bg-gradient-to-r from-white to-cap-cyan bg-clip-text text-transparent filter drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
              Engineer by choice,
            </span>
          </h1>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight">
            <span className="text-cap-blue">CAPiste</span> by passion.
          </h1>
        </motion.div>
      </div>

      {/* Glow Effect */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cap-blue/20 rounded-full blur-3xl"
      />
    </section>
  );
};

export default Hero;
