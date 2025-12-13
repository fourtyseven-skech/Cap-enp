import Hero from "@/components/Hero";
import Projects from "@/components/Projects";
import Sections from "@/components/Sections";
import Values from "@/components/Values";
import Stats from "@/components/Stats";
import ParticleBackground from "@/components/ParticleBackground";
import CallToAction from "@/components/CallToAction"; // <-- 1. IMPORT AJOUTÉ

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Elements - On ne touche pas */}
      <ParticleBackground />
      <div className="texture-overlay" />
      
      {/* Main Content */}
      <main>
        <section id="hero">
          <Hero />
        </section>
        
        <section id="projects">
          <Projects />
        </section>
        
        <section id="sections">
          <Sections />
        </section>
        
        <section id="values">
          <Values />
        </section>
        
        <Stats />

        {/* 2. COMPOSANT AJOUTÉ ICI (Dernier élément avant le footer) */}
        <CallToAction />

      </main>
    </div>
  );
};

export default Index;