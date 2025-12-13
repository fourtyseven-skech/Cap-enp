import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";
// ⚠️ REPLACE THIS WITH YOUR VIDEO PATH
import introVideo from "@/assets/intro.webm"; 

const IntroAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [isMuted, setIsMuted] = useState(true);

  return (
    <motion.div
      // This handles the smooth exit animation
      key="intro-component"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
    >
      <video
        autoPlay
        muted={isMuted}
        playsInline
        onEnded={onComplete} // Triggers the switch to the app when video ends
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={introVideo} type="video/mp4" />
      </video>

      {/* Controls: Mute & Skip */}
      <div className="absolute bottom-10 right-10 z-20 flex flex-col gap-4 items-end">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        <button
          onClick={onComplete}
          className="group flex items-center gap-2 text-white/70 hover:text-white uppercase tracking-widest text-sm transition-colors cursor-pointer"
        >
          Skip Intro 
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      {/* Overlay to ensure controls are visible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default IntroAnimation;